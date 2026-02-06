"""
Project assignment model: assign Technical Managers to projects (many-to-many).
"""
import logging
from typing import List, Optional

from sqlalchemy import text

from core.sqlalchemy_db import get_db_session, engine
from models.sqlalchemy_models import ProjectAssignment, Project, User

logger = logging.getLogger(__name__)


def _ensure_table_exists():
    """Create project_assignments table if it does not exist (raw SQL)."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.project_assignments (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, user_id)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_pa_project_id ON public.project_assignments(project_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_pa_user_id ON public.project_assignments(user_id)"))
        conn.commit()


class ProjectAssignmentModel:
    @staticmethod
    def get_assigned_user_ids(project_id: int) -> List[int]:
        """Return user ids assigned to this project. Tries raw SQL first for consistency with raw writes."""
        try:
            _ensure_table_exists()
            with engine.connect() as conn:
                r = conn.execute(
                    text("SELECT user_id FROM public.project_assignments WHERE project_id = :pid"),
                    {"pid": project_id}
                )
                return [row[0] for row in r]
        except Exception as e:
            logger.warning(f"get_assigned_user_ids raw failed: {e}, trying ORM")
        db = get_db_session()
        try:
            rows = db.query(ProjectAssignment.user_id).filter(
                ProjectAssignment.project_id == project_id
            ).all()
            return [r[0] for r in rows]
        finally:
            db.close()

    @staticmethod
    def get_assigned_project_ids(user_id: int) -> List[int]:
        """Return project ids assigned to this user."""
        db = get_db_session()
        try:
            rows = db.query(ProjectAssignment.project_id).filter(
                ProjectAssignment.user_id == user_id
            ).all()
            return [r[0] for r in rows]
        finally:
            db.close()

    @staticmethod
    def add(project_id: int, user_id: int) -> bool:
        """Assign a user to a project. Idempotent (no-op if already assigned)."""
        db = get_db_session()
        try:
            existing = db.query(ProjectAssignment).filter(
                ProjectAssignment.project_id == project_id,
                ProjectAssignment.user_id == user_id,
            ).first()
            if existing:
                return True
            db.add(ProjectAssignment(project_id=project_id, user_id=user_id))
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error adding project assignment: {str(e)}")
            return False
        finally:
            db.close()

    @staticmethod
    def remove(project_id: int, user_id: int) -> bool:
        """Remove a user's assignment from a project."""
        db = get_db_session()
        try:
            db.query(ProjectAssignment).filter(
                ProjectAssignment.project_id == project_id,
                ProjectAssignment.user_id == user_id,
            ).delete()
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error removing project assignment: {str(e)}")
            return False
        finally:
            db.close()

    @staticmethod
    def set_assignments(project_id: int, user_ids: List[int]) -> bool:
        """Set assignments for a project. Tries raw SQL first (reliable), then ORM."""
        if ProjectAssignmentModel.set_assignments_raw(project_id, user_ids):
            return True
        db = get_db_session()
        try:
            db.query(ProjectAssignment).filter(ProjectAssignment.project_id == project_id).delete()
            db.flush()
            for uid in user_ids:
                db.add(ProjectAssignment(project_id=project_id, user_id=uid))
            db.commit()
            logger.info(f"Saved project_assignments (ORM): project_id={project_id}, user_ids={user_ids}")
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"ORM set_assignments failed: {str(e)}", exc_info=True)
            return False
        finally:
            db.close()

    @staticmethod
    def set_assignments_raw(project_id: int, user_ids: List[int]) -> bool:
        """Persist assignments using raw SQL (avoids ORM/table mapping issues)."""
        try:
            _ensure_table_exists()
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM public.project_assignments WHERE project_id = :pid"), {"pid": project_id})
                for uid in user_ids:
                    conn.execute(
                        text("INSERT INTO public.project_assignments (project_id, user_id) VALUES (:pid, :uid) ON CONFLICT (project_id, user_id) DO NOTHING"),
                        {"pid": project_id, "uid": uid}
                    )
                conn.commit()
            logger.info(f"Saved project_assignments (raw): project_id={project_id}, user_ids={user_ids}")
            return True
        except Exception as e:
            logger.error(f"set_assignments_raw failed: {str(e)}", exc_info=True)
            return False
