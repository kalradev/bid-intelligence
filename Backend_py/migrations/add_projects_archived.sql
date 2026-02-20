-- Add archived flag to projects (Bid Admin archive feature)
-- Archived projects are hidden from main lists; unarchive increases org quota by 1.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
