"""
Project Model - PostgreSQL Implementation using SQLAlchemy
Handles all project-related database operations
"""
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from core.sqlalchemy_db import get_db_session
from models.sqlalchemy_models import Project, ProjectDocument, AnalysisRecord

logger = logging.getLogger(__name__)


def _get_visible_project_ids(current_user: dict) -> List[int]:
    from services.role_quota_service import get_visible_project_ids
    return get_visible_project_ids(current_user)

class ProjectModel:
    @staticmethod
    def get_by_tender_id(tender_id: str) -> Optional[Dict[str, Any]]:
        """Get project by unique tender_id."""
        db = get_db_session()
        try:
            project = db.query(Project).filter(Project.tender_id == tender_id).first()
            if not project:
                return None
            return {
                "id": project.id,
                "project_name": project.project_name,
                "tender_id": project.tender_id,
                "client_name": project.client_name,
                "user_id": project.user_id,
                "created_at": project.created_at,
            }
        except Exception as e:
            logger.error(f"Error getting project by tender_id: {str(e)}")
            return None
        finally:
            db.close()

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
                    "created_at": project.created_at
                }
            return None
        except Exception as e:
            logger.error(f"Error getting project: {str(e)}")
            return None
        finally:
            db.close()

    @staticmethod
    def get_by_name_if_visible(project_name: str, visible_user_ids: Optional[List[int]] = None, current_user: Optional[dict] = None) -> Optional[Dict[str, Any]]:
        """Get project by name if visible to the user. Use current_user for role-based visibility (incl. TM assigned projects)."""
        db = get_db_session()
        try:
            project = db.query(Project).filter(Project.project_name == project_name).first()
            if not project:
                return None
            if current_user is not None:
                visible_ids = _get_visible_project_ids(current_user)
                if project.id not in visible_ids:
                    return None
            elif visible_user_ids:
                if project.user_id not in visible_user_ids:
                    return None
            else:
                return None
            return {
                "id": project.id,
                "project_name": project.project_name,
                "tender_id": project.tender_id,
                "client_name": project.client_name,
                "user_id": project.user_id,
                "created_at": project.created_at
            }
        except Exception as e:
            logger.error(f"Error getting project: {str(e)}")
            return None
        finally:
            db.close()

    @staticmethod
    def get_all_visible_projects(current_user: dict) -> List[Dict[str, Any]]:
        """Get all projects visible to the current user (by role: admin all, BM team-owned, TM assigned only)."""
        visible_ids = _get_visible_project_ids(current_user)
        if not visible_ids:
            return []
        return ProjectModel.get_all_by_project_ids(visible_ids)

    @staticmethod
    def get_all_by_project_ids(project_ids: List[int]) -> List[Dict[str, Any]]:
        """Get all projects with id in project_ids."""
        if not project_ids:
            return []
        db = get_db_session()
        try:
            projects = db.query(Project).filter(
                Project.id.in_(project_ids)
            ).order_by(Project.project_name).all()
            return [{
                "id": p.id,
                "project_name": p.project_name,
                "tender_id": p.tender_id,
                "client_name": p.client_name,
                "user_id": p.user_id,
                "created_at": p.created_at
            } for p in projects]
        except Exception as e:
            logger.error(f"Error getting projects by ids: {str(e)}")
            return []
        finally:
            db.close()

    @staticmethod
    def get_all(user_id: int) -> List[Dict[str, Any]]:
        """Get all projects for a single user"""
        return ProjectModel.get_all_by_user_ids([user_id])

    @staticmethod
    def get_all_by_user_ids(user_ids: List[int]) -> List[Dict[str, Any]]:
        """Get all projects owned by any of the given user ids (for role-based visibility)."""
        if not user_ids:
            return []
        db = get_db_session()
        try:
            projects = db.query(Project).filter(
                Project.user_id.in_(user_ids)
            ).order_by(Project.project_name).all()
            return [{
                "id": p.id,
                "project_name": p.project_name,
                "tender_id": p.tender_id,
                "client_name": p.client_name,
                "user_id": p.user_id,
                "created_at": p.created_at
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
                "created_at": r.created_at
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
                "created_at": d.created_at
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
                    "created_at": project.created_at
                },
                "documents": [{
                    "id": d.id,
                    "project_id": d.project_id,
                    "file_hash": d.file_hash,
                    "file_name": d.file_name,
                    "update_type": d.update_type,
                    "extracted_text": d.extracted_text,
                    "analysis_data": d.analysis_data,
                    "created_at": d.created_at
                } for d in documents],
                "analysis_records": [{
                    "id": r.id,
                    "project_id": r.project_id,
                    "document_id": r.document_id,
                    "section": r.section,
                    "content": r.content,
                    "source_type": r.source_type,
                    "created_at": r.created_at
                } for r in analysis_records]
            }
        except Exception as e:
            logger.error(f"Error getting final analysis: {str(e)}")
            return {}
        finally:
            db.close()
