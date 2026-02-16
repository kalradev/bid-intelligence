"""
Outlook / Microsoft Graph integration.
Sends credential emails from the configured mailbox (e.g. techbank@cachedigitech.com)
when Admin creates a Bid Manager or Bid Manager creates a Technical Manager.
"""
import logging
from typing import Optional

import httpx
from core.config import settings

logger = logging.getLogger(__name__)

GRAPH_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_SEND_MAIL_URL = "https://graph.microsoft.com/v1.0/users/{mailbox}/sendMail"


def get_graph_token() -> Optional[str]:
    """Get OAuth2 token for Microsoft Graph using client credentials."""
    tenant = getattr(settings, "OUTLOOK_TENANT_ID", None) or ""
    client_id = getattr(settings, "OUTLOOK_CLIENT_ID", None) or ""
    client_secret = getattr(settings, "OUTLOOK_CLIENT_SECRET", None) or ""
    if not tenant or not client_id or not client_secret:
        logger.warning("Outlook integration not configured (missing OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_ID, or OUTLOOK_CLIENT_SECRET)")
        return None
    url = GRAPH_TOKEN_URL.format(tenant=tenant)
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(url, data=data)
            r.raise_for_status()
            return r.json().get("access_token")
    except Exception as e:
        logger.warning("Failed to get Graph token: %s", e)
        return None


def send_credentials_email(
    to_email: str,
    full_name: str,
    login_email: str,
    password: str,
    role_label: str,
) -> bool:
    """
    Send an email with login credentials to the new user.
    role_label: "Bid Manager" or "Technical Manager"
    Returns True if sent successfully, False otherwise.
    """
    mailbox = getattr(settings, "OUTLOOK_MAILBOX", None) or ""
    if not mailbox:
        logger.warning("Outlook mailbox not configured (OUTLOOK_MAILBOX)")
        return False
    token = get_graph_token()
    if not token:
        return False
    subject = f"Your Bid Intelligence {role_label} account"
    body_plain = (
        f"Hello {full_name},\n\n"
        f"Your {role_label} account has been created.\n\n"
        f"Login ID (email): {login_email}\n"
        f"Password: {password}\n\n"
        "Please sign in and change your password after first login.\n\n"
        "— Bid Intelligence"
    )
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body_plain},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        }
    }
    url = GRAPH_SEND_MAIL_URL.format(mailbox=mailbox)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(url, json=payload, headers=headers)
            r.raise_for_status()
        logger.info("Credential email sent to %s for %s", to_email, role_label)
        return True
    except Exception as e:
        logger.warning("Failed to send credential email to %s: %s", to_email, e)
        return False
