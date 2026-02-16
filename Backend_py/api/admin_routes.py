"""
Admin-only routes: reset quota, delete projects.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.sqlalchemy_db import get_db
from api.auth_routes import get_current_user
from services.role_quota_service import ROLE_BID_ADMIN
from models.sqlalchemy_models import Project, OrgQuota, QuotaTransaction

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/reset-quota-and-projects")
async def reset_quota_and_projects(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bid Admin only. Resets org quota to base 10, deletes all projects, clears transaction history.
    Use to start fresh with proper 10 quota enforcement.
    """
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can reset quota and projects")

    try:
        # Delete all projects (CASCADE handles project_assignments, project_documents, analysis_records)
        deleted_count = db.query(Project).delete()

        # Reset org_quota to base 10, purchased 0
        row = db.query(OrgQuota).filter(OrgQuota.id == 1).first()
        if not row:
            row = OrgQuota(id=1, base_limit=10, purchased_quota=0)
            db.add(row)
        else:
            row.base_limit = 10
            row.purchased_quota = 0
            db.add(row)

        # Clear quota_transactions for clean history
        db.query(QuotaTransaction).delete()

        db.commit()

        logger.info(
            f"Reset: deleted {deleted_count} projects, org_quota reset to base 10, by {current_user.get('email')}"
        )

        return {
            "success": True,
            "message": f"Reset complete. Deleted {deleted_count} projects. Org quota is now 10.",
            "projectsDeleted": deleted_count,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Reset failed: {e}")
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")
