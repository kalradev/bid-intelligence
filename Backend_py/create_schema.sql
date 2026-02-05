-- Bid Intelligence - Full PostgreSQL Schema
-- Run this in pgAdmin Query Tool if Python init fails.
-- Ensure database "Bid2" exists first.

-- 1. Users (must be first - referenced by projects, eligibility_checklist)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'bid_manager',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    project_name TEXT NOT NULL,
    tender_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- 3. Project Documents
CREATE TABLE IF NOT EXISTS project_documents (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_hash TEXT NOT NULL,
    file_name TEXT NOT NULL,
    update_type VARCHAR(50),
    extracted_text TEXT,
    analysis_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_docs_project ON project_documents(project_id);

-- 4. Analysis Records
CREATE TABLE IF NOT EXISTS analysis_records (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES project_documents(id) ON DELETE CASCADE,
    section TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_file_name TEXT,
    source_file_id TEXT,
    linked_section_id INTEGER REFERENCES analysis_records(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_records(project_id);

-- 5. Eligibility Checklist
CREATE TABLE IF NOT EXISTS eligibility_checklist (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES project_documents(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    criteria_text TEXT NOT NULL,
    is_checked INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_eligibility_project ON eligibility_checklist(project_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_user ON eligibility_checklist(user_id);

-- 6. File Cache
CREATE TABLE IF NOT EXISTS file_cache (
    id SERIAL PRIMARY KEY,
    file_hash TEXT NOT NULL,
    processing_version INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    extracted_text TEXT,
    departmental_summaries JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_hash, processing_version)
);
CREATE INDEX IF NOT EXISTS idx_file_cache_hash ON file_cache(file_hash);
