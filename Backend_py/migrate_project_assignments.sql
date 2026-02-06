-- Run this in pgAdmin (or psql) if Technical Manager assignments are not saving.
-- Creates project_assignments table if it does not exist.

CREATE TABLE IF NOT EXISTS public.project_assignments (
    id serial NOT NULL,
    project_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT project_assignments_project_id_user_id_key UNIQUE (project_id, user_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'project_assignments'
        AND constraint_name = 'project_assignments_project_id_fkey'
    ) THEN
        ALTER TABLE public.project_assignments
            ADD CONSTRAINT project_assignments_project_id_fkey
            FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'project_assignments'
        AND constraint_name = 'project_assignments_user_id_fkey'
    ) THEN
        ALTER TABLE public.project_assignments
            ADD CONSTRAINT project_assignments_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_project_assignments_project_id ON public.project_assignments(project_id);
CREATE INDEX IF NOT EXISTS ix_project_assignments_user_id ON public.project_assignments(user_id);
