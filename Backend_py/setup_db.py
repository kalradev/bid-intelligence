import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def setup_postgres():
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "password")
    host = os.getenv("POSTGRES_HOST", "127.0.0.1")
    port = os.getenv("POSTGRES_PORT", "5432")
    dbname = os.getenv("POSTGRES_DB", "Bid2")

    print(f"🔄 Connecting to PostgreSQL as '{user}' at {host}:{port}...")

    try:
        # Connect to default 'postgres' database to create the target DB
        conn = psycopg2.connect(
            user=user,
            password=password,
            host=host,
            port=port,
            dbname="postgres"
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname='{dbname}'")
        exists = cursor.fetchone()
        
        if not exists:
            print(f"✨ Creating database '{dbname}'...")
            cursor.execute(f'CREATE DATABASE "{dbname}"')
            print("✅ Database created!")
        else:
            print(f"✅ Database '{dbname}' already exists.")
            
        cursor.close()
        conn.close()
        
        # Now test connection to the actual database
        print(f"🔌 Testing connection to '{dbname}'...")
        conn = psycopg2.connect(
            user=user,
            password=password,
            host=host,
            port=port,
            dbname=dbname
        )
        print("✅ Connection verified!")
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error during setup: {str(e)}")
        return False

if __name__ == "__main__":
    setup_postgres()
