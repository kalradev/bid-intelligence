"""
One-command setup: create database (if needed) and apply full schema.
Run from Backend_py:  python setup_db_and_schema.py

Uses .env for POSTGRES_* and runs schema_from_user.sql so you don't need pgAdmin.
"""
import os
import sys
from pathlib import Path

# Load .env from Backend_py directory
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

import psycopg2
from psycopg2 import sql

def get_config():
    return {
        "user": os.getenv("POSTGRES_USER", "postgres"),
        "password": os.getenv("POSTGRES_PASSWORD", "password"),
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": os.getenv("POSTGRES_PORT", "5432"),
        "dbname": os.getenv("POSTGRES_DB", "Bid2"),
    }

def create_database_if_missing(cfg):
    """Create target database if it doesn't exist."""
    try:
        conn = psycopg2.connect(
            user=cfg["user"],
            password=cfg["password"],
            host=cfg["host"],
            port=cfg["port"],
            dbname="postgres",
        )
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (cfg["dbname"],),
        )
        if not cur.fetchone():
            print(f"  Creating database '{cfg['dbname']}'...")
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(cfg["dbname"])))
            print("  Done.")
        else:
            print(f"  Database '{cfg['dbname']}' already exists.")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"  Error: {e}")
        return False

def run_schema_file(cfg, schema_path):
    """Run SQL file on target database. Splits by ';' and executes each statement."""
    if not schema_path.exists():
        print(f"  Schema file not found: {schema_path}")
        return False
    sql_content = schema_path.read_text(encoding="utf-8", errors="replace")
    # Remove single-line comments and split into statements
    lines = []
    for line in sql_content.splitlines():
        if line.strip().startswith("--"):
            continue
        lines.append(line)
    block = "\n".join(lines)
    statements = [s.strip() for s in block.split(";") if s.strip()]
    try:
        conn = psycopg2.connect(
            user=cfg["user"],
            password=cfg["password"],
            host=cfg["host"],
            port=cfg["port"],
            dbname=cfg["dbname"],
        )
        conn.autocommit = True
        cur = conn.cursor()
        run = 0
        for stmt in statements:
            if len(stmt) < 5:
                continue
            try:
                cur.execute(stmt + ";")
                run += 1
            except Exception as e:
                err = str(e).lower()
                if "already exists" in err or "duplicate" in err:
                    pass
                else:
                    print(f"  Warning: {e}")
        cur.close()
        conn.close()
        print(f"  Executed {run} statements.")
        return True
    except Exception as e:
        print(f"  Error: {e}")
        return False

def main():
    print("Bid Intelligence – DB + schema setup")
    print("-------------------------------------")
    cfg = get_config()
    print(f"Host: {cfg['host']}:{cfg['port']}  DB: {cfg['dbname']}")
    print()
    print("Step 1: Ensure database exists...")
    if not create_database_if_missing(cfg):
        sys.exit(1)
    print()
    print("Step 2: Apply schema (schema_from_user.sql)...")
    schema_path = Path(__file__).resolve().parent / "schema_from_user.sql"
    if not run_schema_file(cfg, schema_path):
        sys.exit(1)
    print()
    print("Done. You can start the backend:  python main.py")

if __name__ == "__main__":
    main()
