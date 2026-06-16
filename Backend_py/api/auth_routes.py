from fastapi import APIRouter, HTTPException, Body, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import bcrypt
import jwt
import logging
from datetime import datetime, timedelta
import os

from core.sqlalchemy_db import get_db
from core.config import settings
from models.sqlalchemy_models import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

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


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

class UserResponse(BaseModel):
    id: int  # Integer for PostgreSQL
    fullName: str
    email: str
    role: str
    parentId: Optional[int] = None


class CreateUserRequest(BaseModel):
    fullName: str
    email: str
    password: str
    role: str  # bid_manager (only if caller is bid_admin) | technical_manager (only if caller is bid_manager)

    class Config:
        extra = "forbid"

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

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
        user_id = payload.get("userId")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID")
        
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {
            "id": user.id,
            "fullName": user.full_name,
            "email": user.email,
            "role": user.role or "bid_manager",
            "parentId": getattr(user, "parent_id", None),
            "mustChangePassword": getattr(user, "must_change_password", False),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error")


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: Session = Depends(get_db),
):
    """Like get_current_user but does not raise when Authorization is missing; returns None. Use to avoid 403/404 on missing auth."""
    if not credentials:
        return None
    token = credentials.credentials
    try:
        payload = verify_jwt_token(token)
    except HTTPException:
        raise
    try:
        user_id = payload.get("userId")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {
            "id": user.id,
            "fullName": user.full_name,
            "email": user.email,
            "role": user.role or "bid_manager",
            "parentId": getattr(user, "parent_id", None),
            "mustChangePassword": getattr(user, "must_change_password", False),
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
                    "role": new_user.role,
                    "parentId": getattr(new_user, "parent_id", None),
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

def _verify_password_safe(password: str, hashed: str) -> bool:
    """Verify password; return False on invalid hash or mismatch (avoids 500 from bcrypt)."""
    if not hashed or not isinstance(hashed, str):
        return False
    try:
        return verify_password(password, hashed)
    except (ValueError, TypeError, Exception) as e:
        logger.warning(f"Password verification failed (invalid hash or error): {e}")
        return False


@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login user"""
    try:
        # Find user by email
        email = request.email.strip().lower()
        password = (request.password or "").strip()
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Verify password (safe: malformed hashes don't cause 500)
        if not _verify_password_safe(password, user.password or ""):
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
                "role": user.role or "bid_manager",
                "parentId": getattr(user, "parent_id", None),
                "mustChangePassword": getattr(user, "must_change_password", False),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
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


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password for the current user. Requires current password."""
    if not request.newPassword or len(request.newPassword) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(request.currentPassword, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password = hash_password(request.newPassword)
    user.must_change_password = False
    db.commit()
    logger.info(f"Password changed for user {user.email}")
    return {"success": True, "message": "Password changed successfully", "mustChangePassword": False}


@router.post("/create-user")
async def create_user(
    request: CreateUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Only Bid Admin can create Bid Managers and Technical Managers.
    New user's parent_id is set to current user's id.
    """
    from services.role_quota_service import ROLE_BID_ADMIN, ROLE_BID_MANAGER, ROLE_TECHNICAL_MANAGER

    role = (current_user.get("role") or "").lower()
    requested_role = (request.role or "").strip().lower()

    if role != ROLE_BID_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only Bid Admin can create users (Bid Managers and Technical Managers)",
        )
    if requested_role not in (ROLE_BID_MANAGER, ROLE_TECHNICAL_MANAGER):
        raise HTTPException(
            status_code=400,
            detail="Bid Admin can only create users with role bid_manager or technical_manager",
        )
    parent_id = current_user["id"]
    new_role = requested_role

    email = request.email.strip().lower()
    if not request.fullName or not request.fullName.strip():
        raise HTTPException(status_code=400, detail="Full name is required")
    if not email or "@" not in email or "." not in email.split("@")[1]:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if not request.password or len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    hashed = hash_password(request.password)
    new_user = User(
        full_name=request.fullName.strip(),
        email=email,
        password=hashed,
        role=new_role,
        parent_id=parent_id,
        must_change_password=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"Created user {email} as {new_role} by {current_user.get('email')}")

    # Send credentials email via Outlook (client credentials); failure does not affect response
    role_label = "Bid Manager" if new_role == ROLE_BID_MANAGER else "Technical Manager"
    try:
        from services.outlook_service import send_credentials_email
        send_credentials_email(
            to_email=email,
            full_name=new_user.full_name,
            login_email=email,
            password=request.password,
            role_label=role_label,
        )
    except Exception as e:
        logger.warning("Failed to send credentials email to %s: %s", email, e)

    return {
        "success": True,
        "message": f"User created as {new_role}",
        "user": {
            "id": new_user.id,
            "fullName": new_user.full_name,
            "email": new_user.email,
            "role": new_user.role,
            "parentId": new_user.parent_id,
        },
    }


@router.get("/my-team")
async def get_my_team(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bid Admin: list of Bid Managers (with TM count). Bid Manager: list of their Technical Managers."""
    from services.role_quota_service import get_my_team as get_team
    return {"success": True, "team": get_team(current_user, db=db)}


@router.get("/team-quota")
async def get_team_quota(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Team project quota: used, limit, left (for Bid Manager team / Technical Manager's team)."""
    from services.role_quota_service import get_team_quota as quota
    return {"success": True, **quota(current_user, db=db)}


@router.get("/admin-dashboard")
async def get_admin_dashboard(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Bid Admin dashboard: all Bid Managers with their Technical Managers and team quotas.
    Only accessible by Bid Admin.
    """
    from services.role_quota_service import get_bid_admin_dashboard, ROLE_BID_ADMIN
    
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can access this dashboard")
    
    return {"success": True, **get_bid_admin_dashboard(current_user, db=db)}


@router.delete("/delete-user/{user_id}")
async def delete_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a user account.
    Only Bid Admin can delete users (Bid Managers and Technical Managers).
    """
    from services.role_quota_service import ROLE_BID_ADMIN

    role = (current_user.get("role") or "").lower()
    current_user_id = current_user["id"]

    # Get the user to delete
    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if user_id == current_user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    if role != ROLE_BID_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only Bid Admin can delete users",
        )
    
    # Delete the user
    try:
        db.delete(user_to_delete)
        db.commit()
        logger.info(f"User {user_to_delete.email} (ID: {user_id}) deleted by {current_user.get('email')}")
        return {
            "success": True,
            "message": f"User {user_to_delete.full_name} deleted successfully"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


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

