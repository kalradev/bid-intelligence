"""
Check if eligibility_checklist table exists and create it if needed
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.sqlalchemy_db import get_db_session, engine, Base
from models.sqlalchemy_models import EligibilityChecklist
from sqlalchemy import inspect

def check_and_create_table():
    """Check if eligibility_checklist table exists, create if not"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"📋 Existing tables: {tables}")
    
    if 'eligibility_checklist' not in tables:
        print("❌ eligibility_checklist table does NOT exist!")
        print("✨ Creating table...")
        try:
            EligibilityChecklist.__table__.create(engine, checkfirst=True)
            print("✅ Table created successfully!")
        except Exception as e:
            print(f"❌ Error creating table: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("✅ eligibility_checklist table exists!")
        
        # Show table structure
        columns = inspector.get_columns('eligibility_checklist')
        print("\n📑 Table structure:")
        for col in columns:
            print(f"  - {col['name']}: {col['type']}")

if __name__ == "__main__":
    check_and_create_table()
