# Quota & Recharge Setup

## Overview

- **Org-wide quota**: 10 projects base (shared by Bid Admin + all Bid Managers)
- **Recharge options**: 1 project @ $3, or 10 projects @ $25 (bulk discount)

## Database Migration

Run the migration to create `org_quota` and `quota_transactions` tables:

```bash
cd Backend_py
psql -U postgres -d Bid2 -f migrations/add_org_quota_and_transactions.sql
```

Or, if using SQLAlchemy `init_db()`, the tables are created automatically on app startup (models are in `models/sqlalchemy_models.py`).

## PayPal Setup

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create a sandbox app (for testing) or live app (for production)
3. Copy **Client ID** and **Secret**

4. Add to `Backend_py/.env`:

```
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
```

5. For production, set `PAYPAL_MODE=live` and use live credentials.

## How It Works

1. **Quota**: All projects (Bid Admin + Bid Managers) count toward one org-wide limit (10 base + purchased).
2. **Recharge**: When quota is exhausted, Bid Admin clicks "Recharge quota" on the dashboard.
3. **Payment**: PayPal buttons for $3 (1 project) or $25 (10 projects). After successful payment, quota is increased immediately.
