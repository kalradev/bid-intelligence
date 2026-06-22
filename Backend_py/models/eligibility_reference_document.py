"""Eligibility reference documents - company docs used for auto eligibility checking."""
import logging
import os
from typing import Any, Dict, List, Optional

from core.sqlalchemy_db import get_db_session
from models.sqlalchemy_models import EligibilityReferenceDocument

logger = logging.getLogger(__name__)


class EligibilityReferenceDocumentModel:
    @staticmethod
    def list_for_user(user_id: int) -> List[Dict[str, Any]]:
        db = get_db_session()
        try:
            rows = (
                db.query(EligibilityReferenceDocument)
                .filter(EligibilityReferenceDocument.user_id == user_id)
                .order_by(EligibilityReferenceDocument.created_at.desc())
                .all()
            )
            return [
                {
                    "id": r.id,
                    "label": r.label or r.file_name,
                    "file_name": r.file_name,
                    "file_hash": r.file_hash,
                    "has_text": bool(r.extracted_text and r.extracted_text.strip()),
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
        finally:
            db.close()

    @staticmethod
    def get_texts_for_user(user_id: int) -> List[Dict[str, str]]:
        db = get_db_session()
        try:
            rows = (
                db.query(EligibilityReferenceDocument)
                .filter(EligibilityReferenceDocument.user_id == user_id)
                .order_by(EligibilityReferenceDocument.created_at.desc())
                .all()
            )
            out = []
            for r in rows:
                if r.extracted_text and r.extracted_text.strip():
                    out.append({"label": r.label or r.file_name, "text": r.extracted_text})
            return out
        finally:
            db.close()

    @staticmethod
    def create(
        user_id: int,
        file_name: str,
        file_path: str,
        file_hash: str,
        extracted_text: str,
        label: Optional[str] = None,
    ) -> Optional[int]:
        db = get_db_session()
        try:
            row = EligibilityReferenceDocument(
                user_id=user_id,
                label=(label or file_name).strip() if (label or file_name) else file_name,
                file_name=file_name,
                file_path=file_path,
                file_hash=file_hash,
                extracted_text=extracted_text,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return row.id
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating eligibility reference document: {e}")
            return None
        finally:
            db.close()

    @staticmethod
    def get_owned(user_id: int, doc_id: int) -> Optional[EligibilityReferenceDocument]:
        db = get_db_session()
        try:
            return (
                db.query(EligibilityReferenceDocument)
                .filter(
                    EligibilityReferenceDocument.id == doc_id,
                    EligibilityReferenceDocument.user_id == user_id,
                )
                .first()
            )
        finally:
            db.close()

    @staticmethod
    def delete(user_id: int, doc_id: int) -> bool:
        db = get_db_session()
        try:
            row = (
                db.query(EligibilityReferenceDocument)
                .filter(
                    EligibilityReferenceDocument.id == doc_id,
                    EligibilityReferenceDocument.user_id == user_id,
                )
                .first()
            )
            if not row:
                return False
            file_path = row.file_path
            db.delete(row)
            db.commit()
            if file_path and os.path.isfile(file_path):
                try:
                    os.remove(file_path)
                except OSError as e:
                    logger.warning(f"Could not delete file {file_path}: {e}")
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting eligibility reference document: {e}")
            return False
        finally:
            db.close()
