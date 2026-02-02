from fastapi import APIRouter, HTTPException, Body, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import bcrypt
import jwt
import logging
from datetime import datetime, timedelta
import os
from sqlalchemy.exc import OperationalError

from core.sqlalchemy_db import get_db, get_db_session
from core.config import settings
from models.sqlalchemy_models import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# JWT Secret
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Pydantic models for request/response
class RegisterRequest(BaseModel):
    fullName: str
    email: str  # Changed from EmailStr to str for more flexibility
    password: str
    role: Optional[str] = "bid_manager"
    
    class Config:
        # Allow extra fields to be ignored
        extra = "forbid"

class LoginRequest(BaseModel):
    email: str  # Changed from EmailStr to str for more flexibility
    password: str

class UserResponse(BaseModel):
    id: int  # Integer for PostgreSQL
    fullName: str
    email: str
    role: str

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash. Returns False if hashed is invalid or verification fails."""
    if not hashed or not isinstance(hashed, str):
        return False
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except (ValueError, TypeError, AttributeError):
        return False

def create_jwt_token(user_id: int, email: str, role: str) -> str:
    """Create a JWT token for a user"""
    payload = {
        "userId": user_id,  # Integer for PostgreSQL
        "email": email,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> dict:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> dict:
    """Dependency to get current user from JWT token"""
    token = credentials.credentials
    payload = verify_jwt_token(token)
    
    try:
        user_id = payload["userId"]
        if not user_id:
            raise HTTPException(status_code=404, detail="Invalid user ID")
        
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "id": user.id,
            "fullName": user.full_name,
            "email": user.email,
            "role": user.role or "bid_manager"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error")

@router.post("/register")
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        # Validation
        if not request.fullName or not request.fullName.strip():
            raise HTTPException(
                status_code=400,
                detail="Full name is required"
            )
        
        if not request.email or not request.email.strip():
            raise HTTPException(
                status_code=400,
                detail="Email is required"
            )
        
        # Basic email validation
        email = request.email.strip().lower()
        if "@" not in email or "." not in email.split("@")[1]:
            raise HTTPException(
                status_code=400,
                detail="Please enter a valid email address"
            )
        
        if not request.password or len(request.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters long"
            )
        
        try:
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == email).first()
            
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="User with this email already exists"
                )
            
            # Hash password
            hashed_password = hash_password(request.password)
            
            # Create user
            new_user = User(
                full_name=request.fullName.strip(),
                email=email,
                password=hashed_password,
                role=request.role or "bid_manager"
            )
            
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            # Generate JWT token
            token = create_jwt_token(new_user.id, email, new_user.role)
            
            logger.info(f"✅ User registered: {email}")
            
            return {
                "success": True,
                "message": "User registered successfully",
                "token": token,
                "user": {
                    "id": new_user.id,
                    "fullName": new_user.full_name,
                    "email": email,
                    "role": new_user.role
                }
            }
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Registration error: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Internal server error during registration: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during registration: {str(e)}"
        )

@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login user"""
    try:
        # Find user by email
        email = request.email.strip().lower()
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        if not user.password:
            logger.warning(f"Login attempted for user {email} but password field is empty")
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Verify password (handles invalid/legacy hashes without raising)
        if not verify_password(request.password, user.password):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Generate JWT token
        token = create_jwt_token(user.id, user.email, user.role or "bid_manager")
        
        logger.info(f"✅ User logged in: {user.email}")
        
        return {
            "success": True,
            "message": "Login successful",
            "token": token,
            "user": {
                "id": user.id,
                "fullName": user.full_name,
                "email": user.email,
                "role": user.role or "bid_manager"
            }
        }
    except HTTPException:
        raise
    except OperationalError as e:
        logger.error(f"Login failed: database unreachable - {e}")
        raise HTTPException(
            status_code=503,
            detail="Database unavailable. Check that PostgreSQL is running and POSTGRES_HOST in .env is correct (use localhost if Postgres is on this machine)."
        )
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during login: {str(e)}"
        )

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return {
        "success": True,
        "user": current_user
    }

@router.post("/logout")
async def logout():
    """Logout user (client-side token removal)"""
    return {
        "success": True,
        "message": "Logout successful"
    }

@router.get("/test")
async def test_auth(db: Session = Depends(get_db)):
    """Test endpoint to verify auth routes are working"""
    try:
        # Get user count
        user_count = db.query(User).count()
        
        return {
            "success": True,
            "message": "Auth routes are working!",
            "database": "connected",
            "database_type": "PostgreSQL",
            "user_count": user_count,
            "endpoints": {
                "register": "POST /api/auth/register",
                "login": "POST /api/auth/login",
                "me": "GET /api/auth/me",
                "logout": "POST /api/auth/logout"
            }
        }
    except Exception as e:
        return {
            "success": True,
            "message": "Auth routes are working!",
            "database": "error",
            "database_type": "PostgreSQL",
            "error": str(e),
            "endpoints": {
                "register": "POST /api/auth/register",
                "login": "POST /api/auth/login",
                "me": "GET /api/auth/me",
                "logout": "POST /api/auth/logout"
            }
        }

