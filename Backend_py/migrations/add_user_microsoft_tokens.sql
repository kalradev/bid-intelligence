-- Microsoft Outlook OAuth: allow nullable password (OAuth-only users) and add token table
-- Run once. Safe to run multiple times with IF NOT EXISTS / DO $$ blocks.

-- Allow NULL password for users who sign in only with Microsoft
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Table to store Microsoft refresh token per user (for send/read mail via Graph)
CREATE TABLE IF NOT EXISTS user_microsoft_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS ix_user_microsoft_tokens_user_id ON user_microsoft_tokens(user_id);
