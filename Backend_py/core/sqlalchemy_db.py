"""
SQLAlchemy Database Connection and Session Management
"""
from sqlalchemy import create_engine, MetaData, Table, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
import logging
from typing import Generator
from core.config import settings

logger = logging.getLogger(__name__)

# Create Base class for declarative models
Base = declarative_base()

# Database URL construction
def get_database_url() -> str:
    """Construct database URL from settings or use DATABASE_URL if provided"""
    if settings.DATABASE_URL:
        return settings.DATABASE_URL
    
    return (
        f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )

# Create engine
database_url = get_database_url()
engine = create_engine(
    database_url,
    poolclass=NullPool,  # Use NullPool for development, can switch to QueuePool for production
    echo=False,  # Set to True for SQL query logging
    pool_pre_ping=True,  # Verify connections before using
    connect_args={
        "connect_timeout": 10,
        "options": "-c timezone=utc"
    }
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Metadata for reflection
metadata = MetaData()

def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session.
    Use this in FastAPI route dependencies.
    
    Example:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_session() -> Session:
    """
    Get a database session directly.
    Remember to close it when done.
    
    Example:
        db = get_db_session()
        try:
            # Use db here
            pass
        finally:
            db.close()
    """
    return SessionLocal()

def init_db():
    """
    Initialize database tables.
    Creates all tables defined in Base.metadata
    """
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ SQLAlchemy database tables initialized")
    except Exception as e:
        logger.error(f"❌ Error initializing database tables: {str(e)}")
        raise

def test_connection() -> bool:
    """
    Test database connection.
    Returns True if connection is successful, False otherwise.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection successful")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {str(e)}")
        return False

# Test connection on import
if __name__ != "__main__":
    try:
        test_connection()
    except Exception as e:
        logger.warning(f"⚠️ Could not test database connection on import: {str(e)}")
