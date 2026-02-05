-- Add parent_id to users for Bid Admin / Bid Manager / Technical Manager hierarchy.
-- Run once on existing DB: Query Tool in pgAdmin on Bid2, then execute.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_users_parent_id ON public.users(parent_id);

-- Optional: backfill first user as bid_admin (run manually if needed):
-- UPDATE public.users SET role = 'bid_admin', parent_id = NULL WHERE id = 1;
