-- Performance indexes for users table (role and parent_id used in dashboard and quota queries).
-- Run once against existing database: psql -d Bid2 -f migrations/add_perf_indexes.sql
CREATE INDEX IF NOT EXISTS ix_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS ix_users_parent_id ON public.users(parent_id);
