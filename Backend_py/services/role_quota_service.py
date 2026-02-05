"""
Role-based visibility and team project quota.
- bid_admin: sees all users and all projects.
- bid_manager: sees self + technical_managers (parent_id = self); projects owned by that set.
- technical_manager: sees self only; projects owned by self.
Team quota: 10 projects total per Bid Manager team (BM + their TMs).
"""
import logging
from typing import List, Dict, Any, Tuple

from core.sqlalchemy_db import get_db_session
from core.config import settings
from models.sqlalchemy_models import User, Project

logger = logging.getLogger(__name__)

ROLE_BID_ADMIN = "bid_admin"
ROLE_BID_MANAGER = "bid_manager"
ROLE_TECHNICAL_MANAGER = "technical_manager"

TEAM_PROJECT_LIMIT = getattr(settings, "TEAM_PROJECT_LIMIT", 10)


def get_visible_user_ids(current_user: dict) -> List[int]:
    """
    Return list of user ids whose projects the current user can see.
    - bid_admin: all user ids
    - bid_manager: self + all technical_managers (users with parent_id = self)
    - technical_manager: self only
    """
    user_id = current_user["id"]
    role = (current_user.get("role") or "bid_manager").lower()

    if role == ROLE_BID_ADMIN:
        db = get_db_session()
        try:
            rows = db.query(User.id).all()
            return [r[0] for r in rows]
        finally:
            db.close()

    if role == ROLE_BID_MANAGER:
        db = get_db_session()
        try:
            # self + users who have parent_id = me (my technical managers)
            ids = [user_id]
            children = db.query(User.id).filter(User.parent_id == user_id).all()
            ids.extend(r[0] for r in children)
            return ids
        finally:
            db.close()

    # technical_manager or fallback
    return [user_id]


def get_team_member_ids_for_quota(current_user: dict) -> List[int]:
    """
    For team project quota: who counts as "the team"?
    - bid_admin: not applicable (no team limit for admin) — return [] to mean no quota check
    - bid_manager: self + all technical_managers (parent_id = self)
    - technical_manager: self + siblings + parent (same team as parent's team)
    """
    user_id = current_user["id"]
    role = (current_user.get("role") or "bid_manager").lower()

    if role == ROLE_BID_ADMIN:
        return []  # no team quota for admin

    if role == ROLE_BID_MANAGER:
        db = get_db_session()
        try:
            ids = [user_id]
            children = db.query(User.id).filter(User.parent_id == user_id).all()
            ids.extend(r[0] for r in children)
            return ids
        finally:
            db.close()

    # technical_manager: my team = my parent (bid_manager) + their children (me + siblings)
    db = get_db_session()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.parent_id:
            return [user_id]
        bid_manager_id = user.parent_id
        ids = [bid_manager_id]
        siblings = db.query(User.id).filter(User.parent_id == bid_manager_id).all()
        ids.extend(r[0] for r in siblings)
        return ids
    finally:
        db.close()


def get_team_project_count(team_user_ids: List[int]) -> int:
    """Count projects owned by any of the given user ids."""
    if not team_user_ids:
        return 0
    db = get_db_session()
    try:
        return db.query(Project).filter(Project.user_id.in_(team_user_ids)).count()
    finally:
        db.close()


def get_team_quota(current_user: dict) -> Dict[str, Any]:
    """
    Returns teamProjectsUsed, teamProjectsLimit, teamProjectsLeft for current user's team.
    For bid_admin returns org-wide or null (no quota).
    """
    limit = TEAM_PROJECT_LIMIT
    team_ids = get_team_member_ids_for_quota(current_user)

    if not team_ids:
        # bid_admin: no team quota
        return {
            "teamProjectsUsed": None,
            "teamProjectsLimit": None,
            "teamProjectsLeft": None,
            "appliesToTeam": False,
        }

    used = get_team_project_count(team_ids)
    left = max(0, limit - used)
    return {
        "teamProjectsUsed": used,
        "teamProjectsLimit": limit,
        "teamProjectsLeft": left,
        "appliesToTeam": True,
    }


def can_create_project(current_user: dict) -> Tuple[bool, str]:
    """
    Returns (allowed, error_message). If not allowed, error_message explains why.
    """
    team_ids = get_team_member_ids_for_quota(current_user)
    if not team_ids:
        return True, ""
    used = get_team_project_count(team_ids)
    if used >= TEAM_PROJECT_LIMIT:
        return False, f"Your team has reached the limit of {TEAM_PROJECT_LIMIT} projects. No more projects can be created."
    return True, ""


def get_my_team(current_user: dict) -> List[Dict[str, Any]]:
    """
    For bid_manager: list of their technical_managers (users with parent_id = self).
    For bid_admin: list of all bid_managers (users with role bid_manager, parent_id = admin or null).
    For technical_manager: empty list (or could return siblings).
    """
    user_id = current_user["id"]
    role = (current_user.get("role") or "bid_manager").lower()

    db = get_db_session()
    try:
        if role == ROLE_BID_ADMIN:
            # All bid_managers (and optionally their TMs) - return bid_managers with child count
            bms = db.query(User).filter(User.role == ROLE_BID_MANAGER).order_by(User.full_name).all()
            out = []
            for u in bms:
                child_count = db.query(User).filter(User.parent_id == u.id).count()
                out.append({
                    "id": u.id,
                    "fullName": u.full_name,
                    "email": u.email,
                    "role": u.role or ROLE_BID_MANAGER,
                    "technicalManagersCount": child_count,
                })
            return out

        if role == ROLE_BID_MANAGER:
            children = db.query(User).filter(User.parent_id == user_id).order_by(User.full_name).all()
            return [
                {"id": u.id, "fullName": u.full_name, "email": u.email, "role": u.role or ROLE_TECHNICAL_MANAGER}
                for u in children
            ]

        return []
    finally:
        db.close()


def get_bid_admin_dashboard(current_user: dict) -> Dict[str, Any]:
    """
    For Bid Admin: returns full dashboard with all Bid Managers, their Technical Managers, and team quotas.
    Returns: {
        "bidManagers": [
            {
                "id": ...,
                "fullName": ...,
                "email": ...,
                "technicalManagers": [...],
                "teamProjectsUsed": X,
                "teamProjectsLimit": 10,
                "teamProjectsLeft": Y
            }
        ]
    }
    """
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        return {"bidManagers": []}

    db = get_db_session()
    try:
        bms = db.query(User).filter(User.role == ROLE_BID_MANAGER).order_by(User.full_name).all()
        result = []
        
        for bm in bms:
            # Get Technical Managers under this Bid Manager
            tms = db.query(User).filter(User.parent_id == bm.id).order_by(User.full_name).all()
            technical_managers = [
                {"id": tm.id, "fullName": tm.full_name, "email": tm.email, "role": tm.role}
                for tm in tms
            ]
            
            # Calculate team quota (BM + their TMs)
            team_ids = [bm.id] + [tm.id for tm in tms]
            team_project_count = db.query(Project).filter(Project.user_id.in_(team_ids)).count()
            
            result.append({
                "id": bm.id,
                "fullName": bm.full_name,
                "email": bm.email,
                "role": bm.role,
                "technicalManagers": technical_managers,
                "teamProjectsUsed": team_project_count,
                "teamProjectsLimit": TEAM_PROJECT_LIMIT,
                "teamProjectsLeft": max(0, TEAM_PROJECT_LIMIT - team_project_count),
            })
        
        return {"bidManagers": result}
    finally:
        db.close()
