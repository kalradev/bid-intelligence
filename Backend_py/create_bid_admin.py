"""
Create Bid Admin user account
Run this script once to create a Bid Admin account in your database.
"""
import sys
from pathlib import Path

# Add Backend_py to path
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

# Load .env
_env_file = _backend_dir / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

import bcrypt
from core.sqlalchemy_db import get_db_session
from models.sqlalchemy_models import User

# Bid Admin credentials
BID_ADMIN_EMAIL = "admin@bidintelligence.ai"
BID_ADMIN_PASSWORD = "BidAdmin@2024"
BID_ADMIN_NAME = "Bid Admin"

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_bid_admin():
    """Create or update Bid Admin user"""
    db = get_db_session()
    try:
        # Check if user already exists
        existing = db.query(User).filter(User.email == BID_ADMIN_EMAIL).first()
        
        if existing:
            print(f"[OK] User {BID_ADMIN_EMAIL} already exists (ID: {existing.id})")
            print(f"     Updating role to 'bid_admin'...")
            existing.role = "bid_admin"
            existing.parent_id = None
            db.commit()
            print(f"[OK] Updated user {existing.id} to Bid Admin")
        else:
            print(f"Creating new Bid Admin user: {BID_ADMIN_EMAIL}")
            hashed_password = hash_password(BID_ADMIN_PASSWORD)
            
            new_admin = User(
                full_name=BID_ADMIN_NAME,
                email=BID_ADMIN_EMAIL,
                password=hashed_password,
                role="bid_admin",
                parent_id=None
            )
            
            db.add(new_admin)
            db.commit()
            db.refresh(new_admin)
            
            print(f"[OK] Created Bid Admin user (ID: {new_admin.id})")
        
        print("\n" + "="*60)
        print("BID ADMIN CREDENTIALS")
        print("="*60)
        print(f"Email:    {BID_ADMIN_EMAIL}")
        print(f"Password: {BID_ADMIN_PASSWORD}")
        print("="*60)
        print("\n[!] IMPORTANT: Save these credentials securely!")
        print("    You can change the password after first login.\n")
        
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error creating Bid Admin: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating Bid Admin account...\n")
    create_bid_admin()
