"""
File Cache Model - PostgreSQL/SQLAlchemy Implementation
Handles file caching operations
"""
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from core.sqlalchemy_db import get_db_session
from models.sqlalchemy_models import FileCache as FileCacheModel

logger = logging.getLogger(__name__)

class FileCache:
    @staticmethod
    def find_by_hash(file_hash: str, version: int) -> Optional[Dict[str, Any]]:
        """Find cached file by hash and version"""
        db = get_db_session()
        try:
            cached_file = db.query(FileCacheModel).filter(
                FileCacheModel.file_hash == file_hash,
                FileCacheModel.processing_version == version
            ).first()
            
            if cached_file:
                # Update last accessed time
                cached_file.last_accessed_at = datetime.utcnow()
                db.commit()
                
                result = {
                    "id": cached_file.id,
                    "fileHash": cached_file.file_hash,
                    "processingVersion": cached_file.processing_version,
                    "originalFilename": cached_file.original_filename,
                    "extractedText": cached_file.extracted_text,
                    "departmentalSummaries": cached_file.departmental_summaries,
                    "metadata": cached_file.metadata_json,
                    "createdAt": cached_file.created_at.isoformat() if cached_file.created_at else None,
                    "lastAccessedAt": cached_file.last_accessed_at.isoformat() if cached_file.last_accessed_at else None
                }
                
                # Handle JSON strings if they exist (backward compatibility)
                if isinstance(result.get("departmentalSummaries"), str):
                    result["departmentalSummaries"] = json.loads(result["departmentalSummaries"])
                if result.get("metadata") and isinstance(result["metadata"], str):
                    result["metadata"] = json.loads(result["metadata"])
                
                return result
            return None
        except Exception as e:
            logger.error(f"Error finding in cache: {str(e)}")
            return None
        finally:
            db.close()

    @staticmethod
    def create(data: Dict[str, Any]):
        """Create or update a cached file"""
        db = get_db_session()
        try:
            file_hash = data["fileHash"]
            version = data["processingVersion"]
            filename = data["originalFilename"]
            text = data["extractedText"]
            summaries = data["departmentalSummaries"]
            metadata = data.get("metadata")

            # Check if exists
            existing = db.query(FileCacheModel).filter(
                FileCacheModel.file_hash == file_hash,
                FileCacheModel.processing_version == version
            ).first()
            
            if existing:
                # Update existing
                existing.original_filename = filename
                existing.extracted_text = text
                existing.departmental_summaries = summaries
                existing.metadata_json = metadata
                existing.last_accessed_at = datetime.utcnow()
            else:
                # Create new
                new_cache = FileCacheModel(
                    file_hash=file_hash,
                    processing_version=version,
                    original_filename=filename,
                    extracted_text=text,
                    departmental_summaries=summaries,
                    metadata_json=metadata
                )
                db.add(new_cache)
            
            db.commit()
            logger.info(f"✅ Cached file: {filename} (hash: {file_hash[:8]}..., v{version})")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating cache: {str(e)}")
        finally:
            db.close()
