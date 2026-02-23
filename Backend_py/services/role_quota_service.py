"""
Role-based visibility and org-wide project quota.
- bid_admin: sees all users and all projects. Org quota: 10 base + purchased. Recharge via PayPal.
- bid_manager: sees self + technical_managers; projects owned by that set. Shares org-wide quota.
- technical_manager: sees self only; projects owned by self. Shares org-wide quota.
Org quota: 10 base + purchased (shared by Bid Admin + all Bid Managers). Recharge: 1 @ $3, 10 @ $25.
"""
import logging
from typing import List, Dict, Any, Tuple, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from core.sqlalchemy_db import get_db_session
from core.config import settings
from models.sqlalchemy_models import User, Project, ProjectAssignment, OrgQuota, QuotaTransaction

logger = logging.getLogger(__name__)

ROLE_BID_ADMIN = "bid_admin"
ROLE_BID_MANAGER = "bid_manager"
ROLE_TECHNICAL_MANAGER = "technical_manager"

ORG_QUOTA_BASE = getattr(settings, "ORG_QUOTA_BASE", 10)


def get_org_quota_limit(db: Optional[Session] = None) -> int:
    """Org-wide project limit = base (10) + purchased."""
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        row = db.query(OrgQuota).filter(OrgQuota.id == 1).first()
        if not row:
            db.add(OrgQuota(id=1, base_limit=ORG_QUOTA_BASE, purchased_quota=0))
            db.commit()
            return ORG_QUOTA_BASE
        return (row.base_limit or ORG_QUOTA_BASE) + (row.purchased_quota or 0)
    finally:
        if own_session:
            db.close()


def get_org_project_count(db: Optional[Session] = None) -> int:
    """Quota 'used' = count(ALL projects) + unarchive_quota_used.
    Archiving does NOT reduce used (quota left must not increase). Unarchiving increases used by 1."""
    from sqlalchemy import text
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        # Count ALL projects (archived + active) so archiving does not change this count
        result = db.execute(text("SELECT COUNT(*) FROM projects"))
        row = result.fetchone()
        total_projects = int(row[0]) if row else 0
        # unarchive_quota_used: extra slot consumed each time a project is unarchived
        try:
            extra_row = db.execute(text("SELECT COALESCE(unarchive_quota_used, 0) FROM org_quota WHERE id = 1")).fetchone()
            extra = int(extra_row[0]) if extra_row else 0
        except Exception:
            extra = 0
        return total_projects + extra
    except Exception as e:
        logger.warning(f"get_org_project_count: {e}, using ORM fallback")
        total = db.query(Project).count()
        try:
            extra_row = db.execute(text("SELECT COALESCE(unarchive_quota_used, 0) FROM org_quota WHERE id = 1")).fetchone()
            extra = int(extra_row[0]) if extra_row else 0
        except Exception:
            extra = 0
        return total + extra
    finally:
        if own_session:
            db.close()


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
        not_archived = Project.archived.is_(False)
        if role == ROLE_BID_ADMIN:
            rows = db.query(Project.id).filter(not_archived).all()
            return [r[0] for r in rows]
        if role == ROLE_BID_MANAGER:
            visible_ids = get_visible_user_ids(current_user, db=db)
            rows = db.query(Project.id).filter(Project.user_id.in_(visible_ids), not_archived).all()
            return [r[0] for r in rows]
        rows = db.query(ProjectAssignment.project_id).filter(
            ProjectAssignment.user_id == user_id
        ).join(Project, ProjectAssignment.project_id == Project.id).filter(not_archived).all()
        return [r[0] for r in rows]
    finally:
        if own_session:
            db.close()


def get_team_member_ids_for_quota(current_user: dict, db: Optional[Session] = None) -> List[int]:
    """
    For per-BM team breakdown (display only). Org quota is shared.
    - bid_admin: all user ids (for dashboard display)
    - bid_manager: self + technical_managers
    - technical_manager: self + siblings + parent
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
    Returns org-wide teamProjectsUsed, teamProjectsLimit, teamProjectsLeft.
    Applies to all roles (Bid Admin + Bid Managers + Technical Managers share org quota).
    """
    limit = get_org_quota_limit(db=db)
    used = get_org_project_count(db=db)
    left = max(0, limit - used)
    return {
        "teamProjectsUsed": used,
        "teamProjectsLimit": limit,
        "teamProjectsLeft": left,
        "appliesToTeam": True,
    }


def can_create_project(current_user: dict, db: Optional[Session] = None) -> Tuple[bool, str]:
    """
    Returns (allowed, error_message). Checks org-wide quota.
    """
    limit = get_org_quota_limit(db=db)
    used = get_org_project_count(db=db)
    if used >= limit:
        return False, f"The organization has reached the limit of {limit} projects. Please recharge quota to add more projects."
    return True, ""


def get_my_team(current_user: dict, db: Optional[Session] = None) -> List[Dict[str, Any]]:
    """
    For bid_manager: list of their technical_managers (users with parent_id = self).
    For bid_admin: list of all bid_managers (users with role bid_manager).
    For technical_manager: empty list.
    """
    user_id = current_user["id"]
    role = (current_user.get("role") or "bid_manager").lower()
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        if role == ROLE_BID_ADMIN:
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
    For Bid Admin: returns full dashboard with org quota, all Bid Managers, their Technical Managers, and per-BM project counts.
    """
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        return {"bidManagers": [], "orgQuota": None}
    own_session = db is None
    if own_session:
        db = get_db_session()
    try:
        org_limit = get_org_quota_limit(db=db)
        org_used = get_org_project_count(db=db)
        org_left = max(0, org_limit - org_used)
        org_row = db.query(OrgQuota).filter(OrgQuota.id == 1).first()
        base_limit = org_row.base_limit if org_row else ORG_QUOTA_BASE
        # "Added by recharge" = sum(projects_added) from quota_transactions (source of truth)
        purchased_quota = 0
        try:
            total = db.query(func.coalesce(func.sum(QuotaTransaction.projects_added), 0)).select_from(QuotaTransaction).scalar()
            if total is not None:
                purchased_quota = int(total)
        except Exception as e:
            logger.warning("QuotaTransaction sum failed: %s", e)
            if org_row:
                purchased_quota = int(org_row.purchased_quota or 0)
        if purchased_quota == 0 and org_row and (org_row.purchased_quota or 0) > 0:
            purchased_quota = int(org_row.purchased_quota or 0)
        org_quota_payload = {
            "teamProjectsUsed": org_used,
            "teamProjectsLimit": org_limit,
            "teamProjectsLeft": org_left,
            "baseLimit": base_limit,
            "purchasedQuota": purchased_quota,
        }

        bms = db.query(User).filter(User.role == ROLE_BID_MANAGER).order_by(User.full_name).all()
        if not bms:
            return {
                "bidManagers": [],
                "orgQuota": org_quota_payload,
            }


        bm_ids = [bm.id for bm in bms]
        tms_all = db.query(User).filter(User.parent_id.in_(bm_ids)).order_by(User.full_name).all()
        tms_by_bm: Dict[int, list] = {bid: [] for bid in bm_ids}
        for tm in tms_all:
            if tm.parent_id:
                tms_by_bm.setdefault(tm.parent_id, []).append(tm)

        team_user_ids = set(bm_ids)
        for tms in tms_by_bm.values():
            team_user_ids.update(tm.id for tm in tms)
        project_counts = (
            db.query(Project.user_id, func.count(Project.id).label("cnt"))
            .filter(Project.user_id.in_(list(team_user_ids)), or_(Project.archived.is_(False), Project.archived.is_(None)))
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
            team_project_count = sum(count_by_user.get(uid, 0) for uid in team_ids)
            result.append({
                "id": bm.id,
                "fullName": bm.full_name,
                "email": bm.email,
                "role": bm.role,
                "technicalManagers": technical_managers,
                "teamProjectsUsed": team_project_count,
                "teamProjectsLimit": org_limit,
                "teamProjectsLeft": org_left,
            })
        return {
            "bidManagers": result,
            "orgQuota": org_quota_payload,
        }
    finally:
        if own_session:
            db.close()
