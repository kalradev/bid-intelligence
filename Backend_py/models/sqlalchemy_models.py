"""
SQLAlchemy Models for PostgreSQL Database
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.sqlalchemy_db import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default='bid_manager')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    eligibility_checklists = relationship("EligibilityChecklist", back_populates="user", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(Text, nullable=False, index=True)
    tender_id = Column(Text, nullable=False)
    client_name = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="projects")
    documents = relationship("ProjectDocument", back_populates="project", cascade="all, delete-orphan")
    analysis_records = relationship("AnalysisRecord", back_populates="project", cascade="all, delete-orphan")
    eligibility_checklists = relationship("EligibilityChecklist", back_populates="project", cascade="all, delete-orphan")

class ProjectDocument(Base):
    __tablename__ = "project_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    file_hash = Column(Text, nullable=False, index=True)
    file_name = Column(Text, nullable=False)
    update_type = Column(String(50))  # BASE_RFP, CORRIGENDUM, REFERENCE_UPDATE
    extracted_text = Column(Text)
    analysis_data = Column(JSON)  # JSONB in PostgreSQL
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="documents")
    analysis_records = relationship("AnalysisRecord", back_populates="document", cascade="all, delete-orphan")
    eligibility_checklists = relationship("EligibilityChecklist", back_populates="document", cascade="all, delete-orphan")

class AnalysisRecord(Base):
    __tablename__ = "analysis_records"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=True)
    section = Column(Text, nullable=False, index=True)
    content = Column(Text, nullable=False)
    source_type = Column(Text, nullable=False)
    source_file_name = Column(Text)
    source_file_id = Column(Text)
    linked_section_id = Column(Integer, ForeignKey("analysis_records.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="analysis_records")
    document = relationship("ProjectDocument", back_populates="analysis_records")
    linked_section = relationship("AnalysisRecord", remote_side=[id])

class FileCache(Base):
    __tablename__ = "file_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    file_hash = Column(Text, nullable=False, index=True)
    processing_version = Column(Integer, nullable=False, default=1)
    original_filename = Column(Text, nullable=False)
    extracted_text = Column(Text, nullable=False)
    departmental_summaries = Column(JSON)  # Stored as JSONB in PostgreSQL
    metadata_json = Column("metadata", JSON)  # Stored as JSONB in PostgreSQL, mapped to 'metadata' column
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), server_default=func.now())

class EligibilityChecklist(Base):
    __tablename__ = "eligibility_checklist"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    criteria_text = Column(Text, nullable=False)
    is_checked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="eligibility_checklists")
    document = relationship("ProjectDocument", back_populates="eligibility_checklists")
    user = relationship("User", back_populates="eligibility_checklists")
