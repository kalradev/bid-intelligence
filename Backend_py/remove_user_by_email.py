"""
One-off script to remove a user by email (e.g. Harsh harsh65@gmail.com).
Run from Backend_py:  python remove_user_by_email.py
"""
import sys
from pathlib import Path

_backend = Path(__file__).resolve().parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))
env_file = _backend / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(env_file)

from core.sqlalchemy_db import get_db_session
from models.sqlalchemy_models import User, Project, ProjectAssignment

EMAIL_TO_REMOVE = "harsh65@gmail.com"


def main():
    db = get_db_session()
    try:
        user = db.query(User).filter(User.email == EMAIL_TO_REMOVE).first()
        if not user:
            print(f"User with email {EMAIL_TO_REMOVE} not found.")
            return
        name = user.full_name or user.email
        uid = user.id
        # Delete user; DB/ORM cascades will remove projects, project_assignments, etc.
        db.delete(user)
        db.commit()
        print(f"Removed user: {name} ({EMAIL_TO_REMOVE}, id={uid})")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
