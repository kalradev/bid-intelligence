"""
Project Model - PostgreSQL/SQLAlchemy Implementation
Handles all project-related database operations
"""
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from core.sqlalchemy_db import get_db_session
from models.sqlalchemy_models import Project, ProjectDocument, AnalysisRecord

logger = logging.getLogger(__name__)

class ProjectModel:
    @staticmethod
    def get_by_name(project_name: str, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Get project by name and optionally user_id"""
        db = get_db_session()
        try:
            query = db.query(Project).filter(Project.project_name == project_name)
            
            if user_id:
                query = query.filter(Project.user_id == user_id)
            
            project = query.first()
            if project:
                return {
                    "id": project.id,
                    "project_name": project.project_name,
                    "tender_id": project.tender_id,
                    "client_name": project.client_name,
                    "user_id": project.user_id,
                    "created_at": project.created_at.isoformat() if project.created_at else None
                }
            return None
        except Exception as e:
            logger.error(f"Error getting project: {str(e)}")
            return None
        finally:
            db.close()

    @staticmethod
    def get_all(user_id: int) -> List[Dict[str, Any]]:
        """Get all projects for a user"""
        db = get_db_session()
        try:
            projects = db.query(Project).filter(Project.user_id == user_id).order_by(Project.project_name).all()
            return [{
                "id": p.id,
                "project_name": p.project_name,
                "tender_id": p.tender_id,
                "client_name": p.client_name,
                "user_id": p.user_id,
                "created_at": p.created_at.isoformat() if p.created_at else None
            } for p in projects]
        except Exception as e:
            logger.error(f"Error getting all projects: {str(e)}")
            return []
        finally:
            db.close()

    @staticmethod
    def create(project_name: str, tender_id: str, client_name: str, user_id: int) -> Optional[int]:
        """Create a new project"""
        db = get_db_session()
        try:
            # Check if project already exists for this user
            existing = db.query(Project).filter(
                Project.project_name == project_name,
                Project.user_id == user_id
            ).first()
            
            if existing:
                logger.warning(f"Project {project_name} already exists for user {user_id}")
                return existing.id
            
            new_project = Project(
                project_name=project_name,
                tender_id=tender_id,
                client_name=client_name,
                user_id=user_id
            )
            
            db.add(new_project)
            db.commit()
            db.refresh(new_project)
            
            return new_project.id
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating project: {str(e)}")
            return None
        finally:
            db.close()

    @staticmethod
    def add_document(project_id: int, file_hash: str, file_name: str, update_type: str, extracted_text: str, analysis_data: Dict[str, Any]) -> Optional[int]:
        """Add a document to a project"""
        db = get_db_session()
        try:
            new_document = ProjectDocument(
                project_id=project_id,
                file_hash=file_hash,
                file_name=file_name,
                update_type=update_type,
                extracted_text=extracted_text,
                analysis_data=analysis_data
            )
            
            db.add(new_document)
            db.commit()
            db.refresh(new_document)
            
            return new_document.id
        except Exception as e:
            db.rollback()
            logger.error(f"Error adding document: {str(e)}")
            return None
        finally:
            db.close()

    @staticmethod
    def add_analysis_record(project_id: int, document_id: int, section: str, content: str, source_type: str, source_file_name: str, source_file_id: str, linked_section_id: Optional[int] = None):
        """Add an analysis record"""
        db = get_db_session()
        try:
            new_record = AnalysisRecord(
                project_id=project_id,
                document_id=document_id,
                section=section,
                content=content,
                source_type=source_type,
                source_file_name=source_file_name,
                source_file_id=source_file_id,
                linked_section_id=linked_section_id
            )
            
            db.add(new_record)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error adding analysis record: {str(e)}")
        finally:
            db.close()

    @staticmethod
    def get_merged_analysis(project_id: int) -> List[Dict[str, Any]]:
        """Get all analysis records for a project"""
        db = get_db_session()
        try:
            records = db.query(AnalysisRecord).filter(
                AnalysisRecord.project_id == project_id
            ).order_by(AnalysisRecord.created_at).all()
            
            return [{
                "id": r.id,
                "project_id": r.project_id,
                "document_id": r.document_id,
                "section": r.section,
                "content": r.content,
                "source_type": r.source_type,
                "source_file_name": r.source_file_name,
                "source_file_id": r.source_file_id,
                "linked_section_id": r.linked_section_id,
                "created_at": r.created_at.isoformat() if r.created_at else None
            } for r in records]
        except Exception as e:
            logger.error(f"Error getting merged analysis: {str(e)}")
            return []
        finally:
            db.close()
    
    @staticmethod
    def get_documents_by_project(project_id: int) -> List[Dict[str, Any]]:
        """Get all documents for a project"""
        db = get_db_session()
        try:
            documents = db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project_id
            ).order_by(ProjectDocument.created_at).all()
            
            return [{
                "id": d.id,
                "project_id": d.project_id,
                "file_hash": d.file_hash,
                "file_name": d.file_name,
                "update_type": d.update_type,
                "extracted_text": d.extracted_text,
                "analysis_data": d.analysis_data,
                "created_at": d.created_at.isoformat() if d.created_at else None
            } for d in documents]
        except Exception as e:
            logger.error(f"Error getting documents: {str(e)}")
            return []
        finally:
            db.close()
    
    @staticmethod
    def get_final_analysis(project_id: int) -> Dict[str, Any]:
        """Get final merged analysis with documents"""
        db = get_db_session()
        try:
            # Get project
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                return {}
            
            # Get all documents
            documents = db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project_id
            ).order_by(ProjectDocument.created_at).all()
            
            # Get all analysis records
            analysis_records = db.query(AnalysisRecord).filter(
                AnalysisRecord.project_id == project_id
            ).order_by(AnalysisRecord.created_at).all()
            
            return {
                "project": {
                    "id": project.id,
                    "project_name": project.project_name,
                    "tender_id": project.tender_id,
                    "client_name": project.client_name,
                    "user_id": project.user_id,
                    "created_at": project.created_at.isoformat() if project.created_at else None
                },
                "documents": [{
                    "id": d.id,
                    "project_id": d.project_id,
                    "file_hash": d.file_hash,
                    "file_name": d.file_name,
                    "update_type": d.update_type,
                    "extracted_text": d.extracted_text,
                    "analysis_data": d.analysis_data,
                    "created_at": d.created_at.isoformat() if d.created_at else None
                } for d in documents],
                "analysis_records": [{
                    "id": r.id,
                    "project_id": r.project_id,
                    "document_id": r.document_id,
                    "section": r.section,
                    "content": r.content,
                    "source_type": r.source_type,
                    "source_file_name": r.source_file_name,
                    "source_file_id": r.source_file_id,
                    "linked_section_id": r.linked_section_id,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                } for r in analysis_records]
            }
        except Exception as e:
            logger.error(f"Error getting final analysis: {str(e)}")
            return {}
        finally:
            db.close()