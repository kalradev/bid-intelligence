import psycopg2
import sys

def test_connection():
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user="postgres",
            password="password",
            host="localhost",
            port=5432
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
            user="postgres",
            password="password",
            host="localhost",
            port=5432
        )
        print("✅ Connection to 'bid_intelligence' successful!")
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_connection()
