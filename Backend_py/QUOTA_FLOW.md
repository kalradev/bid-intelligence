# Quota & Recharge – Where It’s Stored and Who Sees It

## 1. Is the count only on the frontend?

**No.** The “Added by recharge” number is **not** computed on the frontend.

- **Backend** computes it when you load the Bid Admin dashboard or call the recharge-total API:
  - It sums `projects_added` from the **`quota_transactions`** table (or falls back to **`org_quota.purchased_quota`**).
- **Frontend** only shows what the API returns in `orgQuota.purchasedQuota`.

So the counting logic lives in the backend; the frontend just displays it.

---

## 2. Is recharge stored in the database?

**Yes.** When you click “Add 1 project” or “Add 10 projects” (or complete a PayPal recharge), the backend:

1. **Updates `org_quota`**
   - Table: **`org_quota`**
   - Row: `id = 1`
   - Column: **`purchased_quota`** is increased by 1 or 10.
   - So the **total quota limit** = `base_limit` (e.g. 10) + `purchased_quota`.

2. **Inserts into `quota_transactions`**
   - Table: **`quota_transactions`**
   - One row per recharge with: `admin_user_id`, `amount_usd`, **`projects_added`** (1 or 10), `recharge_type`, `paypal_order_id`, etc.

3. **Commits** the transaction (`db.commit()` in `api/payment_routes.py`).

So every recharge is persisted in the database in both tables.

---

## 3. Does the quota limit show up on the Bid Manager dashboard?

**Yes.** The limit that Bid Managers see comes from the same database.

- Bid Manager dashboard calls **`GET /api/auth/team-quota`**.
- That uses **`get_team_quota()`** in `services/role_quota_service.py`.
- **`get_team_quota()`** gets the limit from **`get_org_quota_limit(db)`**, which reads:
  - **`org_quota`** row with `id = 1`
  - and returns **`base_limit + purchased_quota`**.

So:

- When you recharge, **`org_quota.purchased_quota`** increases and is stored in the DB.
- **Bid Managers** get **teamProjectsLimit** and **teamProjectsLeft** from that same `org_quota` row.
- So the **increased quota limit** (e.g. 10 → 11 or 13) **does** apply on the Bid Manager dashboard; they see more “Quota left” and a higher limit (e.g. “1/13” instead of “1/10”).

---

## If “Added by recharge” still shows 0

Then either:

1. **Tables missing**  
   Run the migration so the tables exist:
   - Open `Backend_py/migrations/add_org_quota_and_transactions.sql`
   - Execute it in your PostgreSQL database (e.g. pgAdmin or `psql`).

2. **Recharge never persisted**  
   - Check that “Add 1 project” / “Add 10 projects” returns **success** (no 400/500).
   - If PayPal is configured, the add-quota endpoint returns 400; use the PayPal flow or disable PayPal for “Add 1/10” to work.

3. **Backend not restarted**  
   After code or DB changes, restart the backend so it uses the latest code and a fresh DB connection.

---

## Summary

| What                    | Where it lives        | Used by                          |
|-------------------------|-----------------------|----------------------------------|
| Recharge storage        | DB: `org_quota`, `quota_transactions` | Backend only                     |
| “Added by recharge”     | Computed in backend from DB | Bid Admin dashboard (frontend displays it) |
| Quota limit / Quota left| From `org_quota` in DB | Bid Admin + **Bid Manager** dashboards |

So: **counting is in the backend and in the DB**, **recharge is stored in the database**, and **the same quota limit is used on the Bid Manager dashboard**.
