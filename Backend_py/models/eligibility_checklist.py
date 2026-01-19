import json
import logging
from typing import Optional, Dict, Any, List
from core.database import get_db_connection
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

class EligibilityChecklistModel:
    @staticmethod
    def get_by_project_and_document(project_id: int, document_id: Optional[int], user_id: int) -> Dict[str, bool]:
        """Get all eligibility checklist items for a project/document"""
        conn = get_db_connection()
        if not conn: return {}
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if document_id:
                cursor.execute("""
                    SELECT criteria_text, is_checked 
                    FROM eligibility_checklist 
                    WHERE project_id = %s AND document_id = %s AND user_id = %s
                """, (project_id, document_id, user_id))
            else:
                cursor.execute("""
                    SELECT criteria_text, is_checked 
                    FROM eligibility_checklist 
                    WHERE project_id = %s AND document_id IS NULL AND user_id = %s
                """, (project_id, user_id))
            
            results = cursor.fetchall()
            checklist = {}
            for row in results:
                checklist[row['criteria_text']] = row['is_checked']
            return checklist
        except Exception as e:
            logger.error(f"Error getting eligibility checklist: {str(e)}")
            return {}
        finally:
            conn.close()

    @staticmethod
    def save_checklist(project_id: int, document_id: Optional[int], user_id: int, checklist: Dict[str, bool]) -> bool:
        """Save or update eligibility checklist items"""
        conn = get_db_connection()
        if not conn: return False
        try:
            cursor = conn.cursor()
            
            for criteria_text, is_checked in checklist.items():
                # First try to update existing record
                if document_id:
                    cursor.execute("""
                        UPDATE eligibility_checklist 
                        SET is_checked = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE project_id = %s AND document_id = %s AND user_id = %s AND criteria_text = %s
                    """, (is_checked, project_id, document_id, user_id, criteria_text))
                else:
                    cursor.execute("""
                        UPDATE eligibility_checklist 
                        SET is_checked = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE project_id = %s AND document_id IS NULL AND user_id = %s AND criteria_text = %s
                    """, (is_checked, project_id, user_id, criteria_text))
                
                # If no row was updated, insert new record
                if cursor.rowcount == 0:
                    cursor.execute("""
                        INSERT INTO eligibility_checklist 
                        (project_id, document_id, user_id, criteria_text, is_checked, updated_at)
                        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    """, (project_id, document_id, user_id, criteria_text, is_checked))
            
            conn.commit()
            logger.info(f"✅ Saved eligibility checklist for project {project_id}, document {document_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving eligibility checklist: {str(e)}")
            conn.rollback()
            return False
        finally:
            conn.close()

    @staticmethod
    def update_item(project_id: int, document_id: Optional[int], user_id: int, criteria_text: str, is_checked: bool) -> bool:
        """Update a single eligibility checklist item"""
        conn = get_db_connection()
        if not conn: return False
        try:
            cursor = conn.cursor()
            
            # First try to update existing record
            if document_id:
                cursor.execute("""
                    UPDATE eligibility_checklist 
                    SET is_checked = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE project_id = %s AND document_id = %s AND user_id = %s AND criteria_text = %s
                """, (is_checked, project_id, document_id, user_id, criteria_text))
            else:
                cursor.execute("""
                    UPDATE eligibility_checklist 
                    SET is_checked = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE project_id = %s AND document_id IS NULL AND user_id = %s AND criteria_text = %s
                """, (is_checked, project_id, user_id, criteria_text))
            
            # If no row was updated, insert new record
            if cursor.rowcount == 0:
                cursor.execute("""
                    INSERT INTO eligibility_checklist 
                    (project_id, document_id, user_id, criteria_text, is_checked, updated_at)
                    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                """, (project_id, document_id, user_id, criteria_text, is_checked))
            
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error updating eligibility checklist item: {str(e)}")
            conn.rollback()
            return False
        finally:
            conn.close()

