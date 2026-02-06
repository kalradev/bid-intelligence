-- Bid Intelligence - Schema matching your provided DDL
-- Run in pgAdmin on database Bid2 (or your POSTGRES_DB). Create DB first if needed.

-- 1. users
CREATE TABLE IF NOT EXISTS public.users (
    id serial NOT NULL,
    name text,
    full_name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role character varying(50) DEFAULT 'bid_manager',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

-- 2. projects (unique on tender_id)
CREATE TABLE IF NOT EXISTS public.projects (
    id serial NOT NULL,
    tender_id text NOT NULL,
    project_name text NOT NULL,
    client_name text,
    user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT projects_pkey PRIMARY KEY (id),
    CONSTRAINT projects_tender_id_key UNIQUE (tender_id)
);
ALTER TABLE IF EXISTS public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;

-- 3. project_documents
CREATE TABLE IF NOT EXISTS public.project_documents (
    id serial NOT NULL,
    project_id integer,
    file_hash text NOT NULL,
    file_name text NOT NULL,
    update_type text,
    extracted_text text,
    analysis_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_documents_pkey PRIMARY KEY (id)
);
ALTER TABLE IF EXISTS public.project_documents
    ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;

-- 4. analysis_records (no FK in your DDL)
CREATE TABLE IF NOT EXISTS public.analysis_records (
    id serial NOT NULL,
    project_id integer,
    document_id integer,
    section text NOT NULL,
    content text NOT NULL,
    source_type text NOT NULL,
    source_file_name text,
    source_file_id text,
    linked_section_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT analysis_records_pkey PRIMARY KEY (id)
);

-- 5. eligibility_checklist
CREATE TABLE IF NOT EXISTS public.eligibility_checklist (
    id serial NOT NULL,
    project_id integer NOT NULL,
    document_id integer,
    user_id integer NOT NULL,
    criteria_text text NOT NULL,
    is_checked integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT eligibility_checklist_pkey PRIMARY KEY (id)
);
ALTER TABLE IF EXISTS public.eligibility_checklist
    ADD CONSTRAINT eligibility_checklist_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.project_documents (id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.eligibility_checklist
    ADD CONSTRAINT eligibility_checklist_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.eligibility_checklist
    ADD CONSTRAINT eligibility_checklist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_eligibility_checklist_document_id ON public.eligibility_checklist(document_id);
CREATE INDEX IF NOT EXISTS ix_eligibility_checklist_project_id ON public.eligibility_checklist(project_id);
CREATE INDEX IF NOT EXISTS ix_eligibility_checklist_user_id ON public.eligibility_checklist(user_id);

-- 5b. project_assignments (Bid Manager assigns Technical Managers to projects)
CREATE TABLE IF NOT EXISTS public.project_assignments (
    id serial NOT NULL,
    project_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT project_assignments_project_id_user_id_key UNIQUE (project_id, user_id)
);
ALTER TABLE IF EXISTS public.project_assignments
    ADD CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.project_assignments
    ADD CONSTRAINT project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_project_assignments_project_id ON public.project_assignments(project_id);
CREATE INDEX IF NOT EXISTS ix_project_assignments_user_id ON public.project_assignments(user_id);

-- 6. file_cache (UUID, NOT NULL extracted_text/departmental_summaries, extra columns)
CREATE TABLE IF NOT EXISTS public.file_cache (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    file_hash character varying(64) NOT NULL,
    processing_version integer NOT NULL DEFAULT 1,
    original_filename character varying(500) NOT NULL,
    extracted_text text NOT NULL,
    departmental_summaries jsonb NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tender_id text,
    corrigendum_number text,
    corrigendum_date text,
    CONSTRAINT file_cache_pkey PRIMARY KEY (id),
    CONSTRAINT file_cache_file_hash_processing_version_key UNIQUE (file_hash, processing_version)
);
CREATE INDEX IF NOT EXISTS ix_file_cache_file_hash ON public.file_cache(file_hash);

-- 7. documents (standalone UUID table)
CREATE TABLE IF NOT EXISTS public.documents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    file_hash character varying(64) NOT NULL,
    original_filename character varying(500) NOT NULL,
    file_size bigint NOT NULL,
    mime_type character varying(100) NOT NULL,
    file_path text,
    processing_version integer NOT NULL DEFAULT 1,
    extracted_text text,
    word_count integer,
    page_count integer,
    status character varying(50) DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT documents_pkey PRIMARY KEY (id),
    CONSTRAINT documents_file_hash_processing_version_key UNIQUE (file_hash, processing_version)
);

-- 8. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    document_id uuid,
    action character varying(100) NOT NULL,
    user_id character varying(200),
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

-- 9. departmental_summaries
CREATE TABLE IF NOT EXISTS public.departmental_summaries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL,
    department character varying(50) NOT NULL,
    summary_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT departmental_summaries_pkey PRIMARY KEY (id),
    CONSTRAINT departmental_summaries_document_id_department_key UNIQUE (document_id, department)
);

-- 10. document_analyses
CREATE TABLE IF NOT EXISTS public.document_analyses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL,
    analysis_type character varying(50) NOT NULL,
    model_used character varying(100),
    processing_time_seconds numeric(10, 2),
    tokens_used integer,
    cost_usd numeric(10, 4),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_analyses_pkey PRIMARY KEY (id),
    CONSTRAINT document_analyses_document_id_analysis_type_key UNIQUE (document_id, analysis_type)
);

-- 11. document_pages
CREATE TABLE IF NOT EXISTS public.document_pages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL,
    page_number integer NOT NULL,
    page_text text,
    word_count integer,
    extracted_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_pages_pkey PRIMARY KEY (id),
    CONSTRAINT document_pages_document_id_page_number_key UNIQUE (document_id, page_number)
);

-- 12. document_statistics
CREATE TABLE IF NOT EXISTS public.document_statistics (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL,
    total_products integer DEFAULT 0,
    total_oems integer DEFAULT 0,
    indian_oems_count integer DEFAULT 0,
    global_oems_count integer DEFAULT 0,
    products_mapped integer DEFAULT 0,
    products_unmapped integer DEFAULT 0,
    mii_compliance_percentage numeric(5, 2),
    mii_mapped_count integer DEFAULT 0,
    mii_unmapped_count integer DEFAULT 0,
    average_confidence numeric(5, 2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_statistics_pkey PRIMARY KEY (id),
    CONSTRAINT document_statistics_document_id_key UNIQUE (document_id)
);

-- 13. project_overviews
CREATE TABLE IF NOT EXISTS public.project_overviews (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL,
    project_name character varying(500),
    client character varying(500),
    tender_id character varying(200),
    bid_value character varying(100),
    emd character varying(100),
    completion_period character varying(200),
    last_submission_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_overviews_pkey PRIMARY KEY (id),
    CONSTRAINT project_overviews_document_id_key UNIQUE (document_id)
);

-- 14. oems
CREATE TABLE IF NOT EXISTS public.oems (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(200) NOT NULL,
    category character varying(200),
    mii_status character varying(50) NOT NULL,
    country character varying(100),
    industry character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oems_pkey PRIMARY KEY (id),
    CONSTRAINT oems_name_key UNIQUE (name)
);

-- 15. products
CREATE TABLE IF NOT EXISTS public.products (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL,
    product_name character varying(1000) NOT NULL,
    category character varying(200),
    quantity integer,
    unit character varying(50),
    unit_price numeric(15, 2),
    total_price numeric(15, 2),
    specifications text,
    description text,
    row_number integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- 16. product_oems
CREATE TABLE IF NOT EXISTS public.product_oems (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    oem_id uuid,
    oem_name character varying(200),
    mii_status character varying(50),
    confidence_score integer,
    model_name character varying(200),
    source character varying(50),
    is_primary boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_oems_pkey PRIMARY KEY (id)
);

-- Indexes for app lookups
CREATE INDEX IF NOT EXISTS ix_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS ix_projects_project_name ON public.projects(project_name);
CREATE INDEX IF NOT EXISTS ix_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS ix_project_documents_project_id ON public.project_documents(project_id);
