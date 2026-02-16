-- Org-wide quota and recharge transactions for Bid Admin
-- Run this migration to add the new tables

-- Single row: org quota (base 10 + purchased)
CREATE TABLE IF NOT EXISTS org_quota (
    id SERIAL PRIMARY KEY,
    base_limit INTEGER NOT NULL DEFAULT 10,
    purchased_quota INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default row if not exists
INSERT INTO org_quota (id, base_limit, purchased_quota)
SELECT 1, 10, 0
WHERE NOT EXISTS (SELECT 1 FROM org_quota WHERE id = 1);

-- Recharge transaction history
CREATE TABLE IF NOT EXISTS quota_transactions (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount_usd NUMERIC(10, 2) NOT NULL,
    projects_added INTEGER NOT NULL,
    recharge_type VARCHAR(20) NOT NULL,  -- 'single' (1 @ $3) or 'bulk' (10 @ $25)
    paypal_order_id VARCHAR(255),
    paypal_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quota_transactions_admin_user ON quota_transactions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_quota_transactions_paypal_order ON quota_transactions(paypal_order_id);
