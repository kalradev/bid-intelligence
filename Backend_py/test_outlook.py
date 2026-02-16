"""
Test Outlook / Microsoft Graph integration.
Run from Backend_py:  python test_outlook.py
Sends a test credential email to the configured mailbox (yourself) to verify token + send.
"""
import sys
from pathlib import Path

# Ensure Backend_py is on path and .env is loaded
_backend = Path(__file__).resolve().parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))
env_file = _backend / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(env_file)

from core.config import settings
from services.outlook_service import get_graph_token, send_credentials_email


def main():
    mailbox = getattr(settings, "OUTLOOK_MAILBOX", None) or ""
    if not mailbox:
        print("FAIL: OUTLOOK_MAILBOX not set in .env")
        return
    print("Testing Outlook integration...")
    print(f"  Mailbox (from): {mailbox}")
    print(f"  Sending test email to: {mailbox} (self)")

    token = get_graph_token()
    if not token:
        print("  Token: FAIL - check OUTLOOK_CLIENT_ID, OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_SECRET and Azure permissions")
        return
    print("  Token: OK")

    ok = send_credentials_email(
        to_email=mailbox,
        full_name="Test User",
        login_email="test@example.com",
        password="TestPass123",
        role_label="Bid Manager",
    )
    if ok:
        print("  Send: OK - check inbox (and Junk) for techbank@cachedigitech.com")
    else:
        print("  Send: FAIL - check logs above for Graph error (e.g. Mail.Send permission)")


if __name__ == "__main__":
    main()
