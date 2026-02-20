"""
Outlook service: send credentials email via Microsoft Graph using OAuth2 client credentials.
Uses MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, MICROSOFT_MAILBOX.
Application permission Mail.Send required; send as MICROSOFT_MAILBOX (user in tenant).
"""
import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# In-memory token cache: (access_token, expires_at_epoch)
_token_cache: Optional[tuple[str, float]] = None
_BUFFER_SECONDS = 300  # Refresh token 5 minutes before expiry


def _get_config() -> tuple[str, str, str, str]:
    """Return (client_id, client_secret, tenant_id, mailbox). Empty strings if not set."""
    client_id = (os.getenv("MICROSOFT_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("MICROSOFT_CLIENT_SECRET") or "").strip()
    tenant_id = (os.getenv("MICROSOFT_TENANT_ID") or "common").strip()
    mailbox = (os.getenv("MICROSOFT_MAILBOX") or "").strip()
    return client_id, client_secret, tenant_id, mailbox


def get_token() -> Optional[str]:
    """
    Get OAuth2 access token using client credentials flow.
    Caches token in memory and reuses until buffer seconds before expiry.
    """
    client_id, client_secret, tenant_id, _ = _get_config()
    if not client_id or not client_secret:
        return None

    global _token_cache
    now = time.time()
    if _token_cache:
        token, expires_at = _token_cache
        if expires_at > now + _BUFFER_SECONDS:
            return token
        _token_cache = None

    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default",
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, data=data)
        if resp.status_code != 200:
            logger.warning("Microsoft token request failed: %s %s", resp.status_code, resp.text[:200])
            return None
        body = resp.json()
        access_token = body.get("access_token")
        expires_in = int(body.get("expires_in", 3600))
        if access_token:
            _token_cache = (access_token, now + expires_in)
        return access_token
    except Exception as e:
        logger.warning("Microsoft get_token error: %s", e)
        return None


def send_mail(
    to_email: str,
    subject: str,
    body_html: str,
    body_plain: Optional[str] = None,
) -> None:
    """
    Send an email via Microsoft Graph as MICROSOFT_MAILBOX.
    Raises on HTTP error or missing config.
    """
    _, _, _, mailbox = _get_config()
    if not mailbox:
        raise ValueError("MICROSOFT_MAILBOX is not set")

    token = get_token()
    if not token:
        raise ValueError("Failed to obtain Microsoft Graph token")

    to_address = (to_email or "").strip()
    if not to_address:
        raise ValueError("to_email is required")

    # Graph API: https://learn.microsoft.com/en-us/graph/api/user-sendmail
    payload = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "html",
                "content": body_html,
            },
            "toRecipients": [
                {"emailAddress": {"address": to_address, "name": to_address}}
            ],
        }
    }

    url = f"https://graph.microsoft.com/v1.0/users/{mailbox}/sendMail"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, json=payload, headers=headers)
    if resp.status_code not in (200, 202):
        raise RuntimeError(f"Graph sendMail failed: {resp.status_code} {resp.text[:300]}")


def send_credentials_email(
    to_email: str,
    full_name: str,
    login_email: str,
    password: str,
    role_label: str,
) -> None:
    """
    Send credentials email to the new user. Does not raise; logs a warning on failure.
    Skips sending if Microsoft env vars are missing.
    """
    client_id, client_secret, _, mailbox = _get_config()
    if not client_id or not client_secret or not mailbox:
        logger.warning(
            "Outlook credentials email skipped: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, or MICROSOFT_MAILBOX not set"
        )
        return

    subject = "Your Bid Intelligence login credentials"
    body_html = f"""
    <p>Hello {full_name},</p>
    <p>Your Bid Intelligence account has been created with the role <strong>{role_label}</strong>.</p>
    <p><strong>Login details:</strong></p>
    <ul>
        <li>Email: {login_email}</li>
        <li>Password: (the password you were given when the account was created)</li>
    </ul>
    <p>Use the email and password above to sign in to Bid Intelligence. We recommend changing your password after first login from your account settings.</p>
    <p>If you did not expect this email, please contact your administrator.</p>
    <p>— Bid Intelligence</p>
    """
    # Include password in the email body as specified
    body_html = body_html.replace("(the password you were given when the account was created)", password)

    try:
        send_mail(to_email=to_email, subject=subject, body_html=body_html)
        logger.info("Credentials email sent to %s", to_email)
    except Exception as e:
        logger.warning("Failed to send credentials email to %s: %s", to_email, e)
