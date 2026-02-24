-- =============================================================================
-- Bid Intelligence - Database deployment schema (PostgreSQL)
-- Use on a fresh database for deployment. Creates all tables and seed data.
-- Run: psql -U postgres -d Bid2 -f database_deployment.sql
-- Or in pgAdmin: open and execute this file.
-- =============================================================================

-- 1. users
CREATE TABLE IF NOT EXISTS public.users (
    id serial NOT NULL,
    name text,
    full_name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role character varying(50) DEFAULT 'bid_manager',
    parent_id integer,
    must_change_password boolean DEFAULT FALSE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'parent_id') THEN
        ALTER TABLE public.users ADD COLUMN parent_id integer;
        ALTER TABLE public.users ADD CONSTRAINT users_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'must_change_password') THEN
        ALTER TABLE public.users ADD COLUMN must_change_password boolean DEFAULT FALSE;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS ix_users_parent_id ON public.users(parent_id);
CREATE INDEX IF NOT EXISTS ix_users_email ON public.users(email);

-- 2. projects
CREATE TABLE IF NOT EXISTS public.projects (
    id serial NOT NULL,
    tender_id text NOT NULL,
    project_name text NOT NULL,
    client_name text,
    user_id integer,
    archived boolean DEFAULT FALSE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT projects_pkey PRIMARY KEY (id),
    CONSTRAINT projects_tender_id_key UNIQUE (tender_id)
);
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE public.projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived boolean DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS ix_projects_project_name ON public.projects(project_name);
CREATE INDEX IF NOT EXISTS ix_projects_user_id ON public.projects(user_id);

-- 3. project_assignments
CREATE TABLE IF NOT EXISTS public.project_assignments (
    id serial NOT NULL,
    project_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT project_assignments_project_id_user_id_key UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_project_id_fkey;
ALTER TABLE public.project_assignments ADD CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;
ALTER TABLE public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_user_id_fkey;
ALTER TABLE public.project_assignments ADD CONSTRAINT project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_project_assignments_project_id ON public.project_assignments(project_id);
CREATE INDEX IF NOT EXISTS ix_project_assignments_user_id ON public.project_assignments(user_id);

-- 4. project_documents
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
ALTER TABLE public.project_documents DROP CONSTRAINT IF EXISTS project_documents_project_id_fkey;
ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_project_documents_project_id ON public.project_documents(project_id);

-- 5. analysis_records
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

-- 6. eligibility_checklist
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
ALTER TABLE public.eligibility_checklist DROP CONSTRAINT IF EXISTS eligibility_checklist_document_id_fkey;
ALTER TABLE public.eligibility_checklist ADD CONSTRAINT eligibility_checklist_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.project_documents (id) ON DELETE CASCADE;
ALTER TABLE public.eligibility_checklist DROP CONSTRAINT IF EXISTS eligibility_checklist_project_id_fkey;
ALTER TABLE public.eligibility_checklist ADD CONSTRAINT eligibility_checklist_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;
ALTER TABLE public.eligibility_checklist DROP CONSTRAINT IF EXISTS eligibility_checklist_user_id_fkey;
ALTER TABLE public.eligibility_checklist ADD CONSTRAINT eligibility_checklist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;

-- 7. file_cache
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

-- 8. org_quota (single row: base 10 + purchased)
CREATE TABLE IF NOT EXISTS public.org_quota (
    id serial NOT NULL,
    base_limit integer NOT NULL DEFAULT 10,
    purchased_quota integer NOT NULL DEFAULT 0,
    unarchive_quota_used integer NOT NULL DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT org_quota_pkey PRIMARY KEY (id)
);
ALTER TABLE public.org_quota ADD COLUMN IF NOT EXISTS unarchive_quota_used integer NOT NULL DEFAULT 0;
INSERT INTO public.org_quota (id, base_limit, purchased_quota, unarchive_quota_used)
SELECT 1, 10, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.org_quota WHERE id = 1);

-- 9. quota_transactions
CREATE TABLE IF NOT EXISTS public.quota_transactions (
    id serial NOT NULL,
    admin_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    amount_usd numeric(10, 2) NOT NULL,
    projects_added integer NOT NULL,
    recharge_type character varying(20) NOT NULL,
    paypal_order_id character varying(255),
    paypal_status character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quota_transactions_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_quota_transactions_admin_user ON public.quota_transactions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_quota_transactions_paypal_order ON public.quota_transactions(paypal_order_id);

-- End of deployment schema
