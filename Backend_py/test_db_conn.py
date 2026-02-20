import os
import psycopg2
import sys

def test_connection():
    host = os.getenv("POSTGRES_HOST", "127.0.0.1")
    port = int(os.getenv("POSTGRES_PORT", "5432"))
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "password")
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=user,
            password=password,
            host=host,
            port=port
        )
        print("✅ Connection to 'postgres' database successful!")
        
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM pg_database WHERE datname='bid_intelligence'")
        exists = cursor.fetchone()
        if not exists:
            print("❌ Database 'bid_intelligence' does not exist.")
            conn.autocommit = True
            cursor.execute("CREATE DATABASE bid_intelligence")
            print("✅ Database 'bid_intelligence' created!")
        else:
            print("✅ Database 'bid_intelligence' already exists.")
            
        cursor.close()
        conn.close()
        
        # Test connection to bid_intelligence
        conn = psycopg2.connect(
            dbname="bid_intelligence",
            user=user,
            password=password,
            host=host,
            port=port
        )
        print("✅ Connection to 'bid_intelligence' successful!")
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_connection()
