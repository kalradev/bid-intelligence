import json
import logging
from typing import Optional, Dict, Any, List
from core.database import get_db_connection
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

class ProjectModel:
    @staticmethod
    def get_by_name(project_name: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        if not conn: return None
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM projects WHERE project_name = %s", (project_name,))
            return cursor.fetchone()
        except Exception as e:
            logger.error(f"Error getting project: {str(e)}")
            return None
        finally:
            conn.close()

    @staticmethod
    def get_all() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        if not conn: return []
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM projects ORDER BY project_name ASC")
            return list(cursor.fetchall())
        except Exception as e:
            logger.error(f"Error getting all projects: {str(e)}")
            return []
        finally:
            conn.close()

    @staticmethod
    def create(project_name: str, tender_id: str, client_name: str) -> Optional[int]:
        conn = get_db_connection()
        if not conn: return None
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO projects (project_name, tender_id, client_name) VALUES (%s, %s, %s) RETURNING id",
                (project_name, tender_id, client_name)
            )
            project_id = cursor.fetchone()[0]
            conn.commit()
            return project_id
        except Exception as e:
            logger.error(f"Error creating project: {str(e)}")
            return None
        finally:
            conn.close()

    @staticmethod
    def add_document(project_id: int, file_hash: str, file_name: str, update_type: str, extracted_text: str, analysis_data: Dict[str, Any]) -> Optional[int]:
        conn = get_db_connection()
        if not conn: return None
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO project_documents (project_id, file_hash, file_name, update_type, extracted_text, analysis_data) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (project_id, file_hash, file_name, update_type, extracted_text, json.dumps(analysis_data))
            )
            doc_id = cursor.fetchone()[0]
            conn.commit()
            return doc_id
        except Exception as e:
            logger.error(f"Error adding document: {str(e)}")
            return None
        finally:
            conn.close()

    @staticmethod
    def add_analysis_record(project_id: int, document_id: int, section: str, content: str, source_type: str, source_file_name: str, source_file_id: str, linked_section_id: Optional[int] = None):
        conn = get_db_connection()
        if not conn: return
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO analysis_records (project_id, document_id, section, content, source_type, source_file_name, source_file_id, linked_section_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (project_id, document_id, section, content, source_type, source_file_name, source_file_id, linked_section_id)
            )
            conn.commit()
        except Exception as e:
            logger.error(f"Error adding analysis record: {str(e)}")
        finally:
            conn.close()

    @staticmethod
    def get_merged_analysis(project_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        if not conn: return []
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            # Priority: CORRIGENDUM (1), REFERENCE_UPDATE (2), BASE_RFP (3)
            # We want the latest record for each "section+content" or similar unique key?
            # Actually, the user says "identify amended or superseded clauses".
            # For now, let's get all records and the service can handle merging logic.
            cursor.execute("""
                SELECT * FROM analysis_records 
                WHERE project_id = %s 
                ORDER BY created_at ASC
            """, (project_id,))
            return list(cursor.fetchall())
        except Exception as e:
            logger.error(f"Error getting merged analysis: {str(e)}")
            return []
        finally:
            conn.close()
