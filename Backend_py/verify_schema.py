"""
Verify PostgreSQL schema for Bid Intelligence.
Run from Backend_py: python verify_schema.py

Fixes common issues:
- Password: Set POSTGRES_PASSWORD in .env to match your pgAdmin login
- Port: Set PORT=3001 in .env if 3000 is in use
"""
import os
import sys

# Load .env before importing config
from pathlib import Path
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

from core.config import settings

# Expected schema (table -> columns)
EXPECTED_SCHEMA = {
    "users": [
        "id", "full_name", "email", "password", "role",
        "created_at", "updated_at"
    ],
    "projects": [
        "id", "project_name", "tender_id", "client_name", "user_id",
        "created_at"
    ],
    "project_documents": [
        "id", "project_id", "file_hash", "file_name", "update_type",
        "extracted_text", "analysis_data", "created_at"
    ],
    "analysis_records": [
        "id", "project_id", "document_id", "section", "content",
        "source_type", "source_file_name", "source_file_id", "linked_section_id",
        "created_at"
    ],
    "eligibility_checklist": [
        "id", "project_id", "document_id", "user_id", "criteria_text",
        "is_checked", "created_at", "updated_at"
    ],
    "file_cache": [
        "id", "file_hash", "processing_version", "original_filename",
        "extracted_text", "departmental_summaries", "metadata",
        "created_at", "last_accessed_at"
    ],
}

def get_conn():
    import psycopg2
    try:
        if settings.DATABASE_URL:
            return psycopg2.connect(settings.DATABASE_URL)
        return psycopg2.connect(
            dbname=settings.POSTGRES_DB,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )
    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        print("\n📋 Fix in .env:")
        print(f"   POSTGRES_USER={settings.POSTGRES_USER}")
        print(f"   POSTGRES_PASSWORD=<your actual pgAdmin password>")
        print(f"   POSTGRES_HOST={settings.POSTGRES_HOST}")
        print(f"   POSTGRES_PORT={settings.POSTGRES_PORT}")
        print(f"   POSTGRES_DB={settings.POSTGRES_DB}")
        return None

def main():
    print("🔍 Bid Intelligence - Schema Verification")
    print("=" * 50)
    print(f"Connecting to: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print()

    conn = get_conn()
    if not conn:
        sys.exit(1)

    cur = conn.cursor()

    # List existing tables
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    existing_tables = {r[0] for r in cur.fetchall()}

    all_ok = True

    for table, expected_cols in EXPECTED_SCHEMA.items():
        if table not in existing_tables:
            print(f"❌ Table missing: {table}")
            all_ok = False
            continue

        cur.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = %s
        """, (table,))
        actual_cols = {r[0] for r in cur.fetchall()}

        missing = set(expected_cols) - actual_cols
        extra = actual_cols - set(expected_cols)

        if missing:
            print(f"⚠️  {table}: missing columns {missing}")
            all_ok = False
        elif extra and table != "file_cache":  # file_cache may have 'metadata' vs cache_metadata
            print(f"ℹ️  {table}: extra columns (OK) {extra}")
        else:
            print(f"✅ {table}")

    cur.close()
    conn.close()

    print()
    if all_ok:
        print("✅ Schema is complete!")
    else:
        print("⚠️  Run the app once with correct credentials - it will create missing tables.")
        print("   Or run: python -c \"from core.sqlalchemy_db import init_db; init_db()\"")

if __name__ == "__main__":
    main()
