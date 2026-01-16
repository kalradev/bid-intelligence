import json
import logging
from typing import Optional, Dict, Any
from core.database import get_db_connection

logger = logging.getLogger(__name__)

class FileCache:
    @staticmethod
    def find_by_hash(file_hash: str, version: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        if not conn: return None
        try:
            from psycopg2.extras import RealDictCursor
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                "SELECT * FROM file_cache WHERE file_hash = %s AND processing_version = %s",
                (file_hash, version)
            )
            row = cursor.fetchone()
            if row:
                # Update last accessed
                cursor.execute(
                    "UPDATE file_cache SET last_accessed_at = CURRENT_TIMESTAMP WHERE file_hash = %s AND processing_version = %s",
                    (file_hash, version)
                )
                conn.commit()
                
                result = dict(row)
                result["departmental_summaries"] = json.loads(result["departmental_summaries"])
                if result["metadata"]:
                    result["metadata"] = json.loads(result["metadata"])
                return result
            return None
        except Exception as e:
            logger.error(f"Error finding in cache: {str(e)}")
            return None
        finally:
            conn.close()

    @staticmethod
    def create(data: Dict[str, Any]):
        file_hash = data["fileHash"]
        version = data["processingVersion"]
        filename = data["originalFilename"]
        text = data["extractedText"]
        summaries = data["departmentalSummaries"]
        metadata = data.get("metadata")

        conn = get_db_connection()
        if not conn: return
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO file_cache (
                    file_hash,
                    processing_version,
                    original_filename,
                    extracted_text,
                    departmental_summaries,
                    metadata
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (file_hash, processing_version) 
                DO UPDATE SET 
                    original_filename = EXCLUDED.original_filename,
                    extracted_text = EXCLUDED.extracted_text,
                    departmental_summaries = EXCLUDED.departmental_summaries,
                    metadata = EXCLUDED.metadata,
                    last_accessed_at = CURRENT_TIMESTAMP
            """, (
                file_hash,
                version,
                filename,
                text,
                json.dumps(summaries),
                json.dumps(metadata) if metadata else None
            ))
            conn.commit()
            logger.info(f"✅ Cached file: {filename} (hash: {file_hash[:8]}..., v{version})")
        except Exception as e:
            logger.error(f"Error creating cache: {str(e)}")
        finally:
            conn.close()
