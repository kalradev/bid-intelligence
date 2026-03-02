"""
SQLAlchemy Models for PostgreSQL - Matches provided schema
"""
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, ForeignKey, JSON, UniqueConstraint,
    Numeric, Boolean, BigInteger, text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, INET
from core.sqlalchemy_db import Base


# --- Core app tables (integer IDs) ---

class User(Base):
    """User model - roles: bid_admin, bid_manager, technical_manager. parent_id = who they report to."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=True)
    full_name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False, index=True)
    password = Column(Text, nullable=False)
    role = Column(String(50), default="bid_manager")  # bid_admin | bid_manager | technical_manager
    parent_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    must_change_password = Column(Boolean, default=False)  # True for BM/TM created by admin; must change on first login
    created_at = Column(DateTime(timezone=False), server_default=func.now())
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    parent = relationship("User", remote_side=[id], foreign_keys=[parent_id], backref="children")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    project_assignments_link = relationship("ProjectAssignment", back_populates="user", cascade="all, delete-orphan")


class ProjectAssignment(Base):
    """Assigns a Technical Manager (user) to a project. Many-to-many between Project and User."""
    __tablename__ = "project_assignments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=False), server_default=func.now())

    project = relationship("Project", back_populates="assigned_users_link")
    user = relationship("User", back_populates="project_assignments_link")

    __table_args__ = (UniqueConstraint("project_id", "user_id", name="project_assignments_project_id_user_id_key"),)


class Project(Base):
    """Project model - matches public.projects (unique on tender_id)"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Text, nullable=False, unique=True)
    project_name = Column(Text, nullable=False, index=True)
    client_name = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=False), server_default=func.now())
    archived = Column(Boolean, default=False)

    user = relationship("User", back_populates="projects")
    assigned_users_link = relationship("ProjectAssignment", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("ProjectDocument", back_populates="project", cascade="all, delete-orphan")


class ProjectDocument(Base):
    """Project document - matches public.project_documents"""
    __tablename__ = "project_documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    file_hash = Column(Text, nullable=False)
    file_name = Column(Text, nullable=False)
    update_type = Column(Text)
    extracted_text = Column(Text)
    analysis_data = Column(JSON)  # JSONB in PostgreSQL
    created_at = Column(DateTime(timezone=False), server_default=func.now())

    project = relationship("Project", back_populates="documents")
    analysis_records = relationship(
        "AnalysisRecord",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class AnalysisRecord(Base):
    """Analysis record - matches public.analysis_records (logical FK for ORM; DB may not have constraint)"""
    __tablename__ = "analysis_records"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=True)
    document_id = Column(Integer, ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=True, index=True)
    section = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    source_type = Column(Text, nullable=False)
    source_file_name = Column(Text)
    source_file_id = Column(Text)
    linked_section_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=False), server_default=func.now())

    document = relationship("ProjectDocument", back_populates="analysis_records")


class EligibilityChecklist(Base):
    """Eligibility checklist - matches public.eligibility_checklist"""
    __tablename__ = "eligibility_checklist"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    criteria_text = Column(Text, nullable=False)
    is_checked = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FinalBidUpload(Base):
    """User-uploaded final bid document per project (fallback model)."""
    __tablename__ = "final_bid_uploads"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    description = Column(Text, nullable=True)  # user-written note about what they uploaded
    status = Column(String(20), default="pending")  # pending | processed
    uploaded_at = Column(DateTime(timezone=False), server_default=func.now())


class ComparisonResult(Base):
    """Comparison of tool-generated analysis vs uploaded final bid."""
    __tablename__ = "comparison_results"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_document_id = Column(Integer, ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=True, index=True)
    final_bid_upload_id = Column(Integer, ForeignKey("final_bid_uploads.id", ondelete="CASCADE"), nullable=False, index=True)
    comparison_output = Column(JSON, nullable=False)  # { sections, differences: [{ section, field, tool_value, user_value, summary }], summary }
    created_at = Column(DateTime(timezone=False), server_default=func.now())


class LearningFeedback(Base):
    """Stored differences for improving future tool accuracy (prompt-level learning)."""
    __tablename__ = "learning_feedback"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    source_comparison_id = Column(Integer, ForeignKey("comparison_results.id", ondelete="SET NULL"), nullable=True, index=True)
    section_or_key = Column(Text, nullable=False)
    tool_value = Column(Text, nullable=True)
    user_value = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=False), server_default=func.now())


class FileCache(Base):
    """File cache - matches public.file_cache (UUID id, extra columns)"""
    __tablename__ = "file_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    file_hash = Column(String(64), nullable=False, index=True)
    processing_version = Column(Integer, nullable=False)
    original_filename = Column(String(500), nullable=False)
    extracted_text = Column(Text, nullable=False)
    departmental_summaries = Column(JSON, nullable=False)  # JSONB in PostgreSQL
    cache_metadata = Column(JSON, name="metadata")  # JSONB in PostgreSQL
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), server_default=func.now())
    tender_id = Column(Text, nullable=True)
    corrigendum_number = Column(Text, nullable=True)
    corrigendum_date = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("file_hash", "processing_version", name="file_cache_file_hash_processing_version_key"),
    )


# --- Extended schema tables (UUID-based, referenced by document_id uuid) ---

class Document(Base):
    """Standalone documents table - matches public.documents (UUID)"""
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    file_hash = Column(String(64), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_path = Column(Text)
    processing_version = Column(Integer, nullable=False, default=1)
    extracted_text = Column(Text)
    word_count = Column(Integer)
    page_count = Column(Integer)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_accessed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("file_hash", "processing_version", name="documents_file_hash_processing_version_key"),
    )


class AuditLog(Base):
    """Audit logs - matches public.audit_logs"""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String(100), nullable=False)
    user_id = Column(String(200))
    details = Column(JSON)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DepartmentalSummary(Base):
    """Departmental summaries - matches public.departmental_summaries"""
    __tablename__ = "departmental_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id = Column(UUID(as_uuid=True), nullable=False)
    department = Column(String(50), nullable=False)
    summary_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("document_id", "department", name="departmental_summaries_document_id_department_key"),
    )


class DocumentAnalysis(Base):
    """Document analyses - matches public.document_analyses"""
    __tablename__ = "document_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id = Column(UUID(as_uuid=True), nullable=False)
    analysis_type = Column(String(50), nullable=False)
    model_used = Column(String(100))
    processing_time_seconds = Column(Numeric(10, 2))
    tokens_used = Column(Integer)
    cost_usd = Column(Numeric(10, 4))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("document_id", "analysis_type", name="document_analyses_document_id_analysis_type_key"),
    )


class DocumentPage(Base):
    """Document pages - matches public.document_pages"""
    __tablename__ = "document_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id = Column(UUID(as_uuid=True), nullable=False)
    page_number = Column(Integer, nullable=False)
    page_text = Column(Text)
    word_count = Column(Integer)
    extracted_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("document_id", "page_number", name="document_pages_document_id_page_number_key"),
    )


class DocumentStatistics(Base):
    """Document statistics - matches public.document_statistics"""
    __tablename__ = "document_statistics"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id = Column(UUID(as_uuid=True), nullable=False)
    total_products = Column(Integer, default=0)
    total_oems = Column(Integer, default=0)
    indian_oems_count = Column(Integer, default=0)
    global_oems_count = Column(Integer, default=0)
    products_mapped = Column(Integer, default=0)
    products_unmapped = Column(Integer, default=0)
    mii_compliance_percentage = Column(Numeric(5, 2))
    mii_mapped_count = Column(Integer, default=0)
    mii_unmapped_count = Column(Integer, default=0)
    average_confidence = Column(Numeric(5, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("document_id", name="document_statistics_document_id_key"),
    )


class ProjectOverview(Base):
    """Project overviews - matches public.project_overviews"""
    __tablename__ = "project_overviews"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id = Column(UUID(as_uuid=True), nullable=False)
    project_name = Column(String(500))
    client = Column(String(500))
    tender_id = Column(String(200))
    bid_value = Column(String(100))
    emd = Column(String(100))
    completion_period = Column(String(200))
    last_submission_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("document_id", name="project_overviews_document_id_key"),
    )


class Oem(Base):
    """OEMs - matches public.oems"""
    __tablename__ = "oems"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(200), nullable=False, unique=True)
    category = Column(String(200))
    mii_status = Column(String(50), nullable=False)
    country = Column(String(100))
    industry = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Product(Base):
    """Products - matches public.products"""
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id = Column(UUID(as_uuid=True), nullable=False)
    product_name = Column(String(1000), nullable=False)
    category = Column(String(200))
    quantity = Column(Integer)
    unit = Column(String(50))
    unit_price = Column(Numeric(15, 2))
    total_price = Column(Numeric(15, 2))
    specifications = Column(Text)
    description = Column(Text)
    row_number = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class OrgQuota(Base):
    """Organization-wide project quota. Single row: base 10 + purchased.
    unarchive_quota_used: extra quota consumed by unarchiving (each unarchive uses 1; archiving does not free quota)."""
    __tablename__ = "org_quota"

    id = Column(Integer, primary_key=True, index=True)
    base_limit = Column(Integer, nullable=False, default=10)
    purchased_quota = Column(Integer, nullable=False, default=0)
    unarchive_quota_used = Column(Integer, nullable=False, default=0)  # incremented on each unarchive so 1 quota used per unarchive
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now())


class QuotaTransaction(Base):
    """Recharge transaction history."""
    __tablename__ = "quota_transactions"

    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    amount_usd = Column(Numeric(10, 2), nullable=False)
    projects_added = Column(Integer, nullable=False)
    recharge_type = Column(String(20), nullable=False)  # 'single' or 'bulk'
    paypal_order_id = Column(String(255), nullable=True, index=True)
    paypal_status = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=False), server_default=func.now())


class ProductOem(Base):
    """Product-OEM mapping - matches public.product_oems"""
    __tablename__ = "product_oems"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    product_id = Column(UUID(as_uuid=True), nullable=False)
    oem_id = Column(UUID(as_uuid=True))
    oem_name = Column(String(200))
    mii_status = Column(String(50))
    confidence_score = Column(Integer)
    model_name = Column(String(200))
    source = Column(String(50))
    is_primary = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
