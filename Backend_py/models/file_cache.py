"""
File Cache Model - PostgreSQL Implementation
Handles file caching operations
"""
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
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
                    "file_hash": cached_file.file_hash,
                    "processing_version": cached_file.processing_version,
                    "original_filename": cached_file.original_filename,
                    "extracted_text": cached_file.extracted_text,
                    "departmental_summaries": cached_file.departmental_summaries or {},
                    "metadata": cached_file.cache_metadata or {},
                    "created_at": cached_file.created_at,
                    "last_accessed_at": cached_file.last_accessed_at
                }
                
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
            
            # Try to find existing cache entry
            cached_file = db.query(FileCacheModel).filter(
                FileCacheModel.file_hash == file_hash,
                FileCacheModel.processing_version == version
            ).first()
            
            if cached_file:
                # Update existing entry
                cached_file.original_filename = filename
                cached_file.extracted_text = text
                cached_file.departmental_summaries = summaries
                cached_file.cache_metadata = metadata
                cached_file.last_accessed_at = datetime.utcnow()
            else:
                # Create new entry
                cached_file = FileCacheModel(
                    file_hash=file_hash,
                    processing_version=version,
                    original_filename=filename,
                    extracted_text=text,
                    departmental_summaries=summaries,
                    cache_metadata=metadata,
                    last_accessed_at=datetime.utcnow()
                )
                db.add(cached_file)
            
            db.commit()
            logger.info(f"✅ Cached file: {filename} (hash: {file_hash[:8]}..., v{version})")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating cache: {str(e)}")
        finally:
            db.close()
