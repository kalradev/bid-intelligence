"""
Role-based visibility and team project quota.
- bid_admin: sees all users and all projects.
- bid_manager: sees self + technical_managers (parent_id = self); projects owned by that set.
- technical_manager: sees self only; projects owned by self.
Team quota: 10 projects total per Bid Manager team (BM + their TMs).
"""
import logging
from typing import List, Dict, Any, Tuple, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session
from core.sqlalchemy_db import get_db_session
from core.config import settings
from models.sqlalchemy_models import User, Project, ProjectAssignment

logger = logging.getLogger(__name__)

ROLE_BID_ADMIN = "bid_admin"
ROLE_BID_MANAGER = "bid_manager"
ROLE_TECHNICAL_MANAGER = "technical_manager"

TEAM_PROJECT_LIMIT = getattr(settings, "TEAM_PROJECT_LIMIT", 10)


def get_visible_user_ids(current_user: dict, db: Optional[Session] = None) -> List[int]:
    """
    Return list of user ids whose projects the current user can see.
    - bid_admin: all user ids
    - bid_manager: self + all technical_managers (users with parent_id = self)
    - technical_manager: self only
    """
    user_id = current_user["id"]
    role = (current_user.get("role") or "bid_manager").lower()
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        if role == ROLE_BID_ADMIN:
            rows = db.query(User.id).all()
            return [r[0] for r in rows]
        if role == ROLE_BID_MANAGER:
            ids = [user_id]
            children = db.query(User.id).filter(User.parent_id == user_id).all()
            ids.extend(r[0] for r in children)
            return ids
        return [user_id]
    finally:
        if own_session:
            db.close()


def get_visible_project_ids(current_user: dict, db: Optional[Session] = None) -> List[int]:
    """
    Return list of project ids the current user can see.
    - bid_admin: all project ids
    - bid_manager: project ids owned by visible_user_ids (self + their TMs)
    - technical_manager: only project ids assigned to this user (project_assignments)
    """
    user_id = current_user["id"]
    role = (current_user.get("role") or "bid_manager").lower()
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        if role == ROLE_BID_ADMIN:
            rows = db.query(Project.id).all()
            return [r[0] for r in rows]
        if role == ROLE_BID_MANAGER:
            visible_ids = get_visible_user_ids(current_user, db=db)
            rows = db.query(Project.id).filter(Project.user_id.in_(visible_ids)).all()
            return [r[0] for r in rows]
        rows = db.query(ProjectAssignment.project_id).filter(ProjectAssignment.user_id == user_id).all()
        return [r[0] for r in rows]
    finally:
        if own_session:
            db.close()


def get_team_member_ids_for_quota(current_user: dict, db: Optional[Session] = None) -> List[int]:
    """
    For team project quota: who counts as "the team"?
    - bid_admin: not applicable (no team limit for admin) — return [] to mean no quota check
    - bid_manager: self + all technical_managers (parent_id = self)
    - technical_manager: self + siblings + parent (same team as parent's team)
    """
    user_id = current_user["id"]
    role = (current_user.get("role") or "bid_manager").lower()

    if role == ROLE_BID_ADMIN:
        return []
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        if role == ROLE_BID_MANAGER:
            ids = [user_id]
            children = db.query(User.id).filter(User.parent_id == user_id).all()
            ids.extend(r[0] for r in children)
            return ids
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.parent_id:
            return [user_id]
        bid_manager_id = user.parent_id
        ids = [bid_manager_id]
        siblings = db.query(User.id).filter(User.parent_id == bid_manager_id).all()
        ids.extend(r[0] for r in siblings)
        return ids
    finally:
        if own_session:
            db.close()


def get_team_project_count(team_user_ids: List[int], db: Optional[Session] = None) -> int:
    """Count projects owned by any of the given user ids."""
    if not team_user_ids:
        return 0
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        return db.query(Project).filter(Project.user_id.in_(team_user_ids)).count()
    finally:
        if own_session:
            db.close()


def get_team_quota(current_user: dict, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Returns teamProjectsUsed, teamProjectsLimit, teamProjectsLeft for current user's team.
    Quota display is capped at limit so used never exceeds 10. When over quota, teamProjectsOverQuota=True.
    For bid_admin returns org-wide or null (no quota).
    """
    limit = TEAM_PROJECT_LIMIT
    team_ids = get_team_member_ids_for_quota(current_user, db=db)
    if not team_ids:
        return {
            "teamProjectsUsed": None,
            "teamProjectsLimit": None,
            "teamProjectsLeft": None,
            "appliesToTeam": False,
        }
    actual_used = get_team_project_count(team_ids, db=db)
    # Cap displayed "used" at limit so quota never shows greater than 10
    used = min(actual_used, limit)
    left = max(0, limit - used)
    return {
        "teamProjectsUsed": used,
        "teamProjectsLimit": limit,
        "teamProjectsLeft": left,
        "appliesToTeam": True,
        "teamProjectsOverQuota": actual_used > limit,
        "actualProjectCount": actual_used,
    }


def can_create_project(current_user: dict, db: Optional[Session] = None) -> Tuple[bool, str]:
    """
    Returns (allowed, error_message). If not allowed, error_message explains why.
    """
    team_ids = get_team_member_ids_for_quota(current_user, db=db)
    if not team_ids:
        return True, ""
    used = get_team_project_count(team_ids, db=db)
    if used >= TEAM_PROJECT_LIMIT:
        return False, f"Your team has reached the limit of {TEAM_PROJECT_LIMIT} projects. No more projects can be created."
    return True, ""


def get_my_team(current_user: dict, db: Optional[Session] = None) -> List[Dict[str, Any]]:
    """
    For bid_manager: list of their technical_managers (users with parent_id = self).
    For bid_admin: list of all bid_managers (users with role bid_manager, parent_id = admin or null).
    For technical_manager: empty list (or could return siblings).
    """
    user_id = current_user["id"]
    role = (current_user.get("role") or "bid_manager").lower()
    own_session = db is None
    if own_session:
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
        if own_session:
            db.close()


def get_bid_admin_dashboard(current_user: dict, db: Optional[Session] = None) -> Dict[str, Any]:
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
    Optimized: single query for BMs, single query for all TMs, single query for project counts.
    """
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        return {"bidManagers": []}
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        bms = db.query(User).filter(User.role == ROLE_BID_MANAGER).order_by(User.full_name).all()
        if not bms:
            return {"bidManagers": []}

        bm_ids = [bm.id for bm in bms]
        # Single query: all Technical Managers for all Bid Managers
        tms_all = db.query(User).filter(User.parent_id.in_(bm_ids)).order_by(User.full_name).all()
        tms_by_bm: Dict[int, list] = {bid: [] for bid in bm_ids}
        for tm in tms_all:
            if tm.parent_id:
                tms_by_bm.setdefault(tm.parent_id, []).append(tm)

        # Single query: project counts per user (BM + all TMs)
        team_user_ids = set(bm_ids)
        for tms in tms_by_bm.values():
            team_user_ids.update(tm.id for tm in tms)
        project_counts = (
            db.query(Project.user_id, func.count(Project.id).label("cnt"))
            .filter(Project.user_id.in_(list(team_user_ids)))
            .group_by(Project.user_id)
            .all()
        )
        count_by_user = {uid: cnt for uid, cnt in project_counts}

        result = []
        for bm in bms:
            tms_list = tms_by_bm.get(bm.id, [])
            technical_managers = [
                {"id": tm.id, "fullName": tm.full_name, "email": tm.email, "role": tm.role}
                for tm in tms_list
            ]
            team_ids = [bm.id] + [tm.id for tm in tms_list]
            actual_count = sum(count_by_user.get(uid, 0) for uid in team_ids)
            # Cap displayed used at limit so quota never shows greater than 10
            used_capped = min(actual_count, TEAM_PROJECT_LIMIT)
            result.append({
                "id": bm.id,
                "fullName": bm.full_name,
                "email": bm.email,
                "role": bm.role,
                "technicalManagers": technical_managers,
                "teamProjectsUsed": used_capped,
                "teamProjectsLimit": TEAM_PROJECT_LIMIT,
                "teamProjectsLeft": max(0, TEAM_PROJECT_LIMIT - used_capped),
                "teamProjectsOverQuota": actual_count > TEAM_PROJECT_LIMIT,
                "actualProjectCount": actual_count,
            })
        return {"bidManagers": result}
    finally:
        if own_session:
            db.close()
