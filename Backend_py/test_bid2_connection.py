"""
Test connection to Bid2 database using the actual configuration
"""
from core.database import get_db_connection
from core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_bid2_connection():
    """Test connection to Bid2 database"""
    print("=" * 70)
    print("🧪 Testing Bid2 Database Connection")
    print("=" * 70)
    
    print(f"\n📋 Configuration:")
    print(f"   Database: {settings.POSTGRES_DB}")
    print(f"   Host: {settings.POSTGRES_HOST}")
    print(f"   Port: {settings.POSTGRES_PORT}")
    print(f"   User: {settings.POSTGRES_USER}")
    print(f"   Password: {'***' if settings.POSTGRES_PASSWORD else 'NOT SET'}")
    
    print(f"\n🔌 Attempting connection...")
    
    try:
        conn = get_db_connection()
        
        if not conn:
            print("❌ Failed to get database connection")
            return False
        
        print("✅ Connection successful!")
        
        # Test query
        cursor = conn.cursor()
        
        # Check tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public' 
            AND table_type='BASE TABLE'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        
        print(f"\n📊 Found {len(tables)} tables in Bid2:")
        for table in tables[:10]:  # Show first 10
            cursor.execute(f'SELECT COUNT(*) FROM "{table[0]}"')
            count = cursor.fetchone()[0]
            print(f"   ✓ {table[0]}: {count} rows")
        
        if len(tables) > 10:
            print(f"   ... and {len(tables) - 10} more tables")
        
        # Check critical tables
        print(f"\n🎯 Critical Tables Status:")
        critical_tables = ['users', 'projects', 'analysis_records', 'project_documents']
        
        all_good = True
        for table_name in critical_tables:
            cursor.execute(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '{table_name}'
                )
            """)
            exists = cursor.fetchone()[0]
            
            if exists:
                cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                count = cursor.fetchone()[0]
                print(f"   ✅ {table_name}: {count} rows")
            else:
                print(f"   ❌ {table_name}: NOT FOUND")
                all_good = False
        
        cursor.close()
        conn.close()
        
        print("\n" + "=" * 70)
        if all_good:
            print("✅ All systems operational! Bid2 database is ready.")
        else:
            print("⚠️  Some tables are missing. Check schema.")
        print("=" * 70)
        
        return all_good
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_bid2_connection()
    exit(0 if success else 1)

