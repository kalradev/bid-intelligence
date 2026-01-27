"""
Example usage of SQLAlchemy database connection

This file demonstrates how to use the SQLAlchemy database connection
in your FastAPI routes and services.
"""

from sqlalchemy.orm import Session
from core.sqlalchemy_db import get_db, get_db_session, Base, engine
from fastapi import Depends

# ============================================
# Example 1: Using in FastAPI route with dependency
# ============================================

"""
from fastapi import FastAPI, Depends
from core.sqlalchemy_db import get_db

app = FastAPI()

@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    # Use db session here
    # Example: users = db.query(User).all()
    return {"message": "Users endpoint"}
"""

# ============================================
# Example 2: Using directly in a function
# ============================================

"""
def get_all_projects():
    db = get_db_session()
    try:
        # Your database operations here
        # Example: projects = db.query(Project).all()
        return []
    finally:
        db.close()
"""

# ============================================
# Example 3: Creating a model
# ============================================

"""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from core.sqlalchemy_db import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default='bid_manager')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
"""

# ============================================
# Example 4: Using the model in a route
# ============================================

"""
from fastapi import FastAPI, Depends, HTTPException
from core.sqlalchemy_db import get_db
from sqlalchemy.orm import Session

app = FastAPI()

@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role
    }

@app.post("/users")
def create_user(user_data: dict, db: Session = Depends(get_db)):
    new_user = User(**user_data)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
"""

# ============================================
# Example 5: Initialize database tables
# ============================================

"""
from core.sqlalchemy_db import init_db

# This will create all tables defined in your models
if __name__ == "__main__":
    init_db()
"""

if __name__ == "__main__":
    # Test the connection
    from core.sqlalchemy_db import test_connection
    test_connection()
    
    # Initialize tables (uncomment when you have models)
    # init_db()
