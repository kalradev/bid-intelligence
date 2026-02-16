"""
PayPal service for quota recharge.
- Create order: $3 (1 project) or $25 (10 projects)
- Capture order: complete payment and add quota
"""
import logging
from typing import Optional, Dict, Any

import httpx
from core.config import settings

logger = logging.getLogger(__name__)

PAYPAL_BASE_SANDBOX = "https://api-m.sandbox.paypal.com"
PAYPAL_BASE_LIVE = "https://api-m.paypal.com"

RECHARGE_SINGLE = {
    "amount_usd": 3.0,
    "projects": 1,
    "recharge_type": "single",
}
RECHARGE_BULK = {
    "amount_usd": 25.0,
    "projects": 10,
    "recharge_type": "bulk",
}


def _get_base_url() -> str:
    mode = (settings.PAYPAL_MODE or "sandbox").lower()
    return PAYPAL_BASE_LIVE if mode == "live" else PAYPAL_BASE_SANDBOX


def _get_auth() -> tuple:
    client_id = settings.PAYPAL_CLIENT_ID or ""
    client_secret = settings.PAYPAL_CLIENT_SECRET or ""
    return (client_id, client_secret)


async def get_access_token() -> Optional[str]:
    """Get PayPal OAuth2 access token."""
    client_id, client_secret = _get_auth()
    if not client_id or not client_secret:
        logger.warning("PayPal credentials not configured (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)")
        return None
    base = _get_base_url()
    url = f"{base}/v1/oauth2/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
        )
    if resp.status_code != 200:
        logger.error(f"PayPal auth failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    return data.get("access_token")


async def create_order(recharge_type: str) -> Optional[Dict[str, Any]]:
    """
    Create PayPal order for recharge.
    recharge_type: 'single' (1 @ $3) or 'bulk' (10 @ $25)
    Returns: {"orderId": "...", "amount": 3.0, "projects": 1, "recharge_type": "single"} or None
    """
    if recharge_type == "single":
        info = RECHARGE_SINGLE
    elif recharge_type == "bulk":
        info = RECHARGE_BULK
    else:
        logger.error(f"Invalid recharge_type: {recharge_type}")
        return None

    token = await get_access_token()
    if not token:
        return None

    amount = info["amount_usd"]
    base = _get_base_url()
    url = f"{base}/v2/checkout/orders"
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {"currency_code": "USD", "value": f"{amount:.2f}"},
                "description": f"Bid Intelligence - Recharge {info['projects']} project(s)",
            }
        ],
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
        )
    if resp.status_code not in (200, 201):
        logger.error(f"PayPal create order failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    order_id = data.get("id")
    if not order_id:
        return None
    return {
        "orderId": order_id,
        "amount": amount,
        "projects": info["projects"],
        "recharge_type": info["recharge_type"],
    }


async def capture_order(order_id: str) -> Optional[Dict[str, Any]]:
    """
    Capture PayPal order and return capture details.
    Returns: {"status": "COMPLETED", "amount": 3.0} or None
    """
    token = await get_access_token()
    if not token:
        return None

    base = _get_base_url()
    url = f"{base}/v2/checkout/orders/{order_id}/capture"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json={},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
        )
    if resp.status_code not in (200, 201):
        logger.error(f"PayPal capture failed: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    status = data.get("status")
    if status != "COMPLETED":
        return None
    purchase_units = data.get("purchase_units") or []
    amount = 0.0
    for pu in purchase_units:
        pay = pu.get("payments", {}).get("captures", [{}])[0]
        amt = pay.get("amount", {}).get("value")
        if amt:
            amount += float(amt)
    return {"status": "COMPLETED", "amount": amount}
