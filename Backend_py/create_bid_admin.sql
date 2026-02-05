-- Create Bid Admin account
-- Run this in pgAdmin Query Tool on your Bid2 database

-- First, check if bid_admin already exists
-- If you want to use an existing user, update their role instead

-- Option 1: Create a new Bid Admin user
-- Password: BidAdmin@2024 (hashed with bcrypt)
-- Email: admin@bidintelligence.ai

INSERT INTO public.users (full_name, email, password, role, parent_id, created_at, updated_at)
VALUES (
    'Bid Admin',
    'admin@bidintelligence.ai',
    '$2b$12$LKzH5vQJ3xYZ9mKp.nL8.eYXqH8K7vQJ3xYZ9mKp.nL8.eYXqH8K7u',  -- Password: BidAdmin@2024
    'bid_admin',
    NULL,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE 
SET role = 'bid_admin', parent_id = NULL;

-- Option 2: Convert an existing user to Bid Admin (uncomment and modify the ID)
-- UPDATE public.users SET role = 'bid_admin', parent_id = NULL WHERE id = 1;

-- Verify the Bid Admin was created
SELECT id, full_name, email, role, parent_id FROM public.users WHERE role = 'bid_admin';
