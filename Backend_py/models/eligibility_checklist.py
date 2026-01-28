"""
Eligibility Checklist Model - PostgreSQL Implementation
Handles eligibility checklist operations
"""
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from core.sqlalchemy_db import get_db_session
from models.sqlalchemy_models import EligibilityChecklist

logger = logging.getLogger(__name__)

class EligibilityChecklistModel:
    @staticmethod
    def get_by_project_and_document(project_id, document_id: Optional[str], user_id) -> Dict[str, bool]:
        """Get all eligibility checklist items for a project/document"""
        db = get_db_session()
        try:
            query = db.query(EligibilityChecklist).filter(
                EligibilityChecklist.project_id == project_id,
                EligibilityChecklist.user_id == user_id
            )
            
            if document_id:
                query = query.filter(EligibilityChecklist.document_id == int(document_id))
            else:
                query = query.filter(EligibilityChecklist.document_id.is_(None))
            
            results = query.all()
            
            # Convert to dictionary format
            checklist = {}
            for item in results:
                checklist[item.criteria_text] = bool(item.is_checked)
            
            return checklist
        except Exception as e:
            logger.error(f"Error getting eligibility checklist: {str(e)}")
            return {}
        finally:
            db.close()

    @staticmethod
    def save_checklist(project_id, document_id: Optional[str], user_id, checklist: Dict[str, bool]) -> bool:
        """Save or update eligibility checklist items"""
        db = get_db_session()
        try:
            # Save each checklist item
            for criteria_text, is_checked in checklist.items():
                query = db.query(EligibilityChecklist).filter(
                    EligibilityChecklist.project_id == project_id,
                    EligibilityChecklist.document_id == (int(document_id) if document_id else None),
                    EligibilityChecklist.user_id == user_id,
                    EligibilityChecklist.criteria_text == criteria_text
                )
                
                existing_item = query.first()
                
                if existing_item:
                    # Update existing item
                    existing_item.is_checked = 1 if is_checked else 0
                    existing_item.updated_at = datetime.utcnow()
                else:
                    # Create new item
                    new_item = EligibilityChecklist(
                        project_id=project_id,
                        document_id=int(document_id) if document_id else None,
                        user_id=user_id,
                        criteria_text=criteria_text,
                        is_checked=1 if is_checked else 0
                    )
                    db.add(new_item)
            
            db.commit()
            logger.info(f"✅ Saved eligibility checklist for project {project_id}, document {document_id}")
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving eligibility checklist: {str(e)}")
            return False
        finally:
            db.close()

    @staticmethod
    def update_item(project_id, document_id: Optional[str], user_id, criteria_text: str, is_checked: bool) -> bool:
        """Update a single eligibility checklist item"""
        db = get_db_session()
        try:
            query = db.query(EligibilityChecklist).filter(
                EligibilityChecklist.project_id == project_id,
                EligibilityChecklist.document_id == (int(document_id) if document_id else None),
                EligibilityChecklist.user_id == user_id,
                EligibilityChecklist.criteria_text == criteria_text
            )
            
            existing_item = query.first()
            
            if existing_item:
                # Update existing item
                existing_item.is_checked = 1 if is_checked else 0
                existing_item.updated_at = datetime.utcnow()
            else:
                # Create new item
                new_item = EligibilityChecklist(
                    project_id=project_id,
                    document_id=int(document_id) if document_id else None,
                    user_id=user_id,
                    criteria_text=criteria_text,
                    is_checked=1 if is_checked else 0
                )
                db.add(new_item)
            
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating eligibility checklist item: {str(e)}")
            return False
        finally:
            db.close()
