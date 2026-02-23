"""
Outlook service: send credentials email via Microsoft Graph using OAuth2 client credentials.
Uses MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, MICROSOFT_MAILBOX.
Application permission Mail.Send required; send as MICROSOFT_MAILBOX (user in tenant).
"""
import html
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


def _credentials_email_html(full_name: str, login_email: str, password: str, role_label: str) -> str:
    """Build branded Bid Intelligence credentials email HTML. Escapes user input."""
    first_name = html.escape((full_name or "").strip())
    email_esc = html.escape((login_email or "").strip())
    password_esc = html.escape((password or "").strip())
    role_esc = html.escape((role_label or "").strip())

    login_base = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if not login_base:
        login_base = "https://yourdomain.com"
    login_url = f"{login_base}/login" if "/login" not in login_base else login_base

    logo_url = (os.getenv("LOGO_URL") or "").strip()
    if not logo_url and login_base and login_base != "https://yourdomain.com":
        logo_url = f"{login_base}/assets/bid-intelligence-logo.svg"
    if logo_url:
        logo_block = (
            f'<img src="{html.escape(logo_url)}" alt="Bid Intelligence" width="160" style="display:block; margin-bottom:8px;">'
            '<span style="font-size:22px; font-weight:800; color:#2d3319; letter-spacing:-0.02em;">'
            'Bid <span style="color:#E87878;">Intelligence</span></span>'
        )
    else:
        logo_block = (
            '<span style="font-size:22px; font-weight:800; color:#2d3319; letter-spacing:-0.02em;">'
            'Bid <span style="color:#E87878;">Intelligence</span></span>'
        )

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Bid Intelligence</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f9; font-family:Arial, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9; padding:30px 0;">
<tr>
<td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; padding:40px;">
<tr>
<td align="center" style="padding-bottom:20px;">
    {logo_block}
</td>
</tr>
<tr>
<td align="center" style="padding-bottom:10px;">
    <h2 style="margin:0; color:#2d3319;">Welcome to Bid Intelligence!</h2>
</td>
</tr>
<tr>
<td align="center" style="padding-bottom:4px;">
    <p style="margin:0; font-size:14px; color:#5a6340;">Your account has been created as <strong>{role_esc}</strong>.</p>
</td>
</tr>
<tr>
<td style="color:#555555; font-size:15px; line-height:24px; padding-top:16px;">
    Hi {first_name},<br><br>
    Your account has been successfully created on <strong style="color:#2d3319;">Bid Intelligence</strong>.<br>
    Please use the credentials below to access your account.
</td>
</tr>
<tr>
<td style="padding:20px 0;">
    <table width="100%" cellpadding="15" cellspacing="0" style="background:#fef2f2; border-radius:6px; border:1px solid #FECACA;">
        <tr>
            <td style="font-size:14px; color:#333;">
                <strong>Portal link:</strong> <a href="{html.escape(login_url)}" style="color:#E87878;">{html.escape(login_url)}</a><br><br>
                <strong>Email:</strong> {email_esc}<br><br>
                <strong>Temporary password:</strong> {password_esc}
            </td>
        </tr>
    </table>
</td>
</tr>
<tr>
<td align="center" style="padding:20px 0;">
    <a href="{html.escape(login_url)}"
       style="background-color:#FF8F8F; color:#ffffff; text-decoration:none; padding:12px 30px;
       border-radius:6px; font-size:15px; display:inline-block; font-weight:600;">
       Login to your account
    </a>
</td>
</tr>
<tr>
<td style="font-size:13px; color:#888888; line-height:20px;">
    For security purposes, we recommend changing your password immediately after your first login.
</td>
</tr>
<tr>
<td align="center" style="padding-top:30px; font-size:12px; color:#999999;">
    If you require assistance, please contact support.<br><br>
    © 2026 Bid Intelligence. All rights reserved.
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>"""


def send_credentials_email(
    to_email: str,
    full_name: str,
    login_email: str,
    password: str,
    role_label: str,
) -> None:
    """
    Send credentials email to the new user (Bid Manager or Technical Manager). Does not raise; logs a warning on failure.
    Skips sending if Microsoft env vars are missing.
    """
    client_id, client_secret, _, mailbox = _get_config()
    if not client_id or not client_secret or not mailbox:
        logger.warning(
            "Outlook credentials email skipped: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, or MICROSOFT_MAILBOX not set"
        )
        return

    subject = "Welcome to Bid Intelligence – your login credentials"
    body_html = _credentials_email_html(full_name=full_name, login_email=login_email, password=password, role_label=role_label)

    try:
        send_mail(to_email=to_email, subject=subject, body_html=body_html)
        logger.info("Credentials email sent to %s", to_email)
    except Exception as e:
        logger.warning("Failed to send credentials email to %s: %s", to_email, e)
