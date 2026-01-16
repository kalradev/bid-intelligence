from fastapi import APIRouter, HTTPException, Body, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import bcrypt
import jwt
import logging
from datetime import datetime, timedelta
import os

from core.database import get_db_connection
from core.config import settings

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
    id: int
    fullName: str
    email: str
    role: str

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: int, email: str, role: str) -> str:
    """Create a JWT token for a user"""
    payload = {
        "userId": user_id,
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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency to get current user from JWT token"""
    token = credentials.credentials
    payload = verify_jwt_token(token)
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, full_name, email, role FROM users WHERE id = %s",
            (payload["userId"],)
        )
        user = cursor.fetchone()
        cursor.close()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "id": user[0],
            "fullName": user[1],
            "email": user[2],
            "role": user[3]
        }
    finally:
        conn.close()

@router.post("/register")
async def register(request: RegisterRequest):
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
        
        conn = get_db_connection()
        if not conn:
            logger.error("❌ Database connection failed")
            raise HTTPException(
                status_code=500, 
                detail="Database connection failed. Please check your PostgreSQL server."
            )
        
        try:
            cursor = conn.cursor()
            
            # Check if user already exists
            cursor.execute("SELECT id, email FROM users WHERE email = %s", (email,))
            existing_user = cursor.fetchone()
            
            if existing_user:
                cursor.close()
                conn.close()
                raise HTTPException(
                    status_code=400,
                    detail="User with this email already exists"
                )
            
            # Hash password
            hashed_password = hash_password(request.password)
            
            # Create user
            cursor.execute(
                """INSERT INTO users (full_name, email, password, role) 
                   VALUES (%s, %s, %s, %s) 
                   RETURNING id, full_name, email, role, created_at""",
                (request.fullName.strip(), email, hashed_password, request.role or "bid_manager")
            )
            
            user_data = cursor.fetchone()
            conn.commit()
            
            user_id = user_data[0]
            full_name = user_data[1]
            email = user_data[2]
            role = user_data[3]
            
            # Generate JWT token
            token = create_jwt_token(user_id, email, role)
            
            cursor.close()
            conn.close()
            
            logger.info(f"✅ User registered: {email}")
            
            return {
                "success": True,
                "message": "User registered successfully",
                "token": token,
                "user": {
                    "id": user_id,
                    "fullName": full_name,
                    "email": email,
                    "role": role
                }
            }
        except HTTPException:
            if conn:
                conn.close()
            raise
        except Exception as e:
            if conn:
                conn.rollback()
                conn.close()
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
async def login(request: LoginRequest):
    """Login user"""
    try:
        conn = get_db_connection()
        if not conn:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            cursor = conn.cursor()
            
            # Find user
            cursor.execute(
                "SELECT id, full_name, email, password, role FROM users WHERE email = %s",
                (request.email,)
            )
            user = cursor.fetchone()
            
            if not user:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid email or password"
                )
            
            user_id, full_name, email, hashed_password, role = user
            
            # Verify password
            if not verify_password(request.password, hashed_password):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid email or password"
                )
            
            # Generate JWT token
            token = create_jwt_token(user_id, email, role)
            
            cursor.close()
            
            logger.info(f"✅ User logged in: {email}")
            
            return {
                "success": True,
                "message": "Login successful",
                "token": token,
                "user": {
                    "id": user_id,
                    "fullName": full_name,
                    "email": email,
                    "role": role
                }
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Internal server error during login"
            )
        finally:
            conn.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during login"
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
async def test_auth():
    """Test endpoint to verify auth routes are working"""
    # Test database connection
    conn = get_db_connection()
    db_status = "connected" if conn else "failed"
    
    if conn:
        try:
            cursor = conn.cursor()
            # Check if users table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'users'
                );
            """)
            table_exists = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            
            return {
                "success": True,
                "message": "Auth routes are working!",
                "database": db_status,
                "users_table_exists": table_exists,
                "endpoints": {
                    "register": "POST /api/auth/register",
                    "login": "POST /api/auth/login",
                    "me": "GET /api/auth/me",
                    "logout": "POST /api/auth/logout"
                }
            }
        except Exception as e:
            if conn:
                conn.close()
            return {
                "success": True,
                "message": "Auth routes are working!",
                "database": db_status,
                "error": str(e),
                "endpoints": {
                    "register": "POST /api/auth/register",
                    "login": "POST /api/auth/login",
                    "me": "GET /api/auth/me",
                    "logout": "POST /api/auth/logout"
                }
            }
    
    return {
        "success": True,
        "message": "Auth routes are working!",
        "database": db_status,
        "warning": "Database connection failed - check your PostgreSQL settings",
        "endpoints": {
            "register": "POST /api/auth/register",
            "login": "POST /api/auth/login",
            "me": "GET /api/auth/me",
            "logout": "POST /api/auth/logout"
        }
    }

