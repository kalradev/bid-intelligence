"""
Payment routes for quota recharge via PayPal.
Informal/demo mode: when PayPal not configured, add-quota endpoint allows free top-up.
"""
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from sqlalchemy import text
from core.sqlalchemy_db import get_db, engine
from core.config import settings
from api.auth_routes import get_current_user
from services.paypal_service import create_order as paypal_create_order, capture_order as paypal_capture_order
from services.role_quota_service import ROLE_BID_ADMIN
from models.sqlalchemy_models import OrgQuota, QuotaTransaction

logger = logging.getLogger(__name__)

router = APIRouter()


def _ensure_quota_tables():
    """Create org_quota and quota_transactions if they don't exist (e.g. migration not run)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS org_quota (
                    id SERIAL PRIMARY KEY,
                    base_limit INTEGER NOT NULL DEFAULT 10,
                    purchased_quota INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("""
                INSERT INTO org_quota (id, base_limit, purchased_quota)
                SELECT 1, 10, 0 WHERE NOT EXISTS (SELECT 1 FROM org_quota WHERE id = 1)
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS quota_transactions (
                    id SERIAL PRIMARY KEY,
                    admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    amount_usd NUMERIC(10, 2) NOT NULL,
                    projects_added INTEGER NOT NULL,
                    recharge_type VARCHAR(20) NOT NULL,
                    paypal_order_id VARCHAR(255),
                    paypal_status VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
    except Exception as e:
        logger.warning("ensure quota tables: %s", e)

PAYPAL_CONFIGURED = bool(settings.PAYPAL_CLIENT_ID and settings.PAYPAL_CLIENT_ID.strip())


@router.get("/recharge-total")
async def get_recharge_total(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return total projects added by recharge (sum of quota_transactions). Bid Admin only."""
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin")
    from sqlalchemy import func
    total = db.query(func.coalesce(func.sum(QuotaTransaction.projects_added), 0)).select_from(QuotaTransaction).scalar()
    recharge_total = int(total) if total is not None else 0
    if recharge_total == 0:
        row = db.query(OrgQuota).filter(OrgQuota.id == 1).first()
        if row and (row.purchased_quota or 0) > 0:
            recharge_total = int(row.purchased_quota or 0)
    return {"success": True, "rechargeTotal": recharge_total}


@router.get("/config")
async def get_payment_config(current_user: dict = Depends(get_current_user)):
    """
    Return PayPal client ID for frontend SDK. Bid Admin only.
    paypalConfigured: True if PayPal is set up; False enables informal Add 1/10 buttons.
    """
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can access payment config")
    client_id = settings.PAYPAL_CLIENT_ID or ""
    return {"success": True, "clientId": client_id, "paypalConfigured": PAYPAL_CONFIGURED}


class CreateOrderRequest(BaseModel):
    type: str  # "single" or "bulk"


class CaptureOrderRequest(BaseModel):
    orderId: str


class AddQuotaRequest(BaseModel):
    type: str  # "single" or "bulk"


@router.post("/add-quota")
async def api_add_quota(
    body: AddQuotaRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Informal/demo recharge when PayPal is not configured.
    Directly adds 1 or 10 projects to purchased_quota.
    Returns 400 if PayPal is configured (use normal flow instead).
    """
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can recharge quota")
    if PAYPAL_CONFIGURED:
        raise HTTPException(status_code=400, detail="PayPal is configured. Use the Recharge button to pay.")
    rtype = (body.type or "single").lower()
    if rtype not in ("single", "bulk"):
        raise HTTPException(status_code=400, detail="type must be 'single' or 'bulk'")
    projects_added = 10 if rtype == "bulk" else 1
    order_id = f"demo-{uuid.uuid4().hex[:12]}"

    _ensure_quota_tables()

    row = db.query(OrgQuota).filter(OrgQuota.id == 1).first()
    if not row:
        row = OrgQuota(id=1, base_limit=10, purchased_quota=0)
        db.add(row)
        db.flush()
    row.purchased_quota = (row.purchased_quota or 0) + projects_added

    txn = QuotaTransaction(
        admin_user_id=current_user["id"],
        amount_usd=0.0,
        projects_added=projects_added,
        recharge_type="demo",
        paypal_order_id=order_id,
        paypal_status="DEMO",
    )
    db.add(txn)
    db.commit()

    logger.info(f"Demo quota recharge: +{projects_added} projects by {current_user.get('email')}")

    return {
        "success": True,
        "message": f"Added {projects_added} project(s) to your quota (informal mode)",
        "projectsAdded": projects_added,
    }


@router.post("/create-order")
async def api_create_order(
    body: CreateOrderRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create PayPal order for recharge. Bid Admin only.
    type: "single" (1 project @ $3) or "bulk" (10 projects @ $25)
    """
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can recharge quota")
    rtype = (body.type or "single").lower()
    if rtype not in ("single", "bulk"):
        raise HTTPException(status_code=400, detail="type must be 'single' or 'bulk'")
    result = await paypal_create_order(rtype)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create PayPal order. Check PayPal configuration.")
    return {"success": True, **result}


@router.post("/capture-order")
async def api_capture_order(
    body: CaptureOrderRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Capture PayPal order and add quota. Bid Admin only.
    Verifies order on PayPal, records transaction, and increases org purchased_quota.
    """
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can recharge quota")
    order_id = (body.orderId or "").strip()
    if not order_id:
        raise HTTPException(status_code=400, detail="orderId is required")

    # Check if order already captured (idempotency)
    existing = db.query(QuotaTransaction).filter(QuotaTransaction.paypal_order_id == order_id).first()
    if existing:
        return {"success": True, "message": "Order already captured", "projectsAdded": existing.projects_added}

    capture_result = await paypal_capture_order(order_id)
    if not capture_result:
        raise HTTPException(status_code=400, detail="Failed to capture PayPal order. Payment may have failed or already captured.")

    # Determine projects added from amount
    amount = capture_result.get("amount", 0.0)
    if amount >= 25.0:
        projects_added = 10
        recharge_type = "bulk"
    else:
        projects_added = 1
        recharge_type = "single"

    # Update org_quota
    row = db.query(OrgQuota).filter(OrgQuota.id == 1).first()
    if not row:
        row = OrgQuota(id=1, base_limit=10, purchased_quota=0)
        db.add(row)
        db.flush()
    row.purchased_quota = (row.purchased_quota or 0) + projects_added

    # Record transaction
    txn = QuotaTransaction(
        admin_user_id=current_user["id"],
        amount_usd=amount,
        projects_added=projects_added,
        recharge_type=recharge_type,
        paypal_order_id=order_id,
        paypal_status=capture_result.get("status", "COMPLETED"),
    )
    db.add(txn)
    db.commit()

    logger.info(f"Quota recharge: +{projects_added} projects, order {order_id}, by {current_user.get('email')}")

    return {
        "success": True,
        "message": f"Successfully added {projects_added} project(s) to your quota",
        "projectsAdded": projects_added,
    }
