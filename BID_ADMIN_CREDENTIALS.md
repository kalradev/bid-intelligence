# Bid Admin Credentials

## Login Information

**Email:** `admin@bidintelligence.ai`  
**Password:** `BidAdmin@2024`

---

## How to Access

1. Go to your application: `http://localhost:5173/login`
2. Enter the email and password above
3. After login, you'll be redirected to the home page
4. Click **"Team & Quota"** button to access the Bid Admin Dashboard

---

## Bid Admin Dashboard Features

As a Bid Admin, you can:

### 1. **View All Bid Managers**
- See complete list of all Bid Managers in the organization
- View each Bid Manager's email and contact information

### 2. **View Technical Managers**
- See all Technical Managers under each Bid Manager
- Expandable view showing the team structure

### 3. **Monitor Team Quotas**
- Each Bid Manager's team has a limit of **10 projects**
- Dashboard shows:
  - **Projects Used** (e.g., 9/10)
  - **Projects Left** (e.g., 1 left)
  - Color-coded indicators (green = available, red = limit reached)

### 4. **Create New Bid Managers**
- Use the "Create Bid Manager" form on the Team page
- New Bid Managers can then create their own Technical Managers

---

## Role Hierarchy

```
Bid Admin (you)
  └── Bid Manager 1
       ├── Technical Manager 1
       ├── Technical Manager 2
       └── Technical Manager 3
  └── Bid Manager 2
       ├── Technical Manager 4
       └── Technical Manager 5
```

- **Bid Admin**: Sees everything, creates Bid Managers
- **Bid Manager**: Sees their own Technical Managers and team projects (max 10 per team)
- **Technical Manager**: Sees only their own projects

---

## Important Notes

1. **Change Password**: You should change this password after first login (feature to be added)
2. **Keep Secure**: This is the only Bid Admin account - keep credentials safe
3. **Team Quota**: Each Bid Manager + their Technical Managers share 10 projects total
4. **Self-Registration**: Public signup only creates Bid Managers (Technical Managers must be created by their Bid Manager)

---

## Troubleshooting

If you can't log in:
1. Make sure the backend is running (`python main.py` in Backend_py folder)
2. Make sure the frontend is running (`npm run dev` in Frontend folder)
3. Check that the database migration was run (parent_id column exists)
4. Verify the user exists: Run `SELECT * FROM users WHERE email = 'admin@bidintelligence.ai';` in pgAdmin

---

**Created:** February 1, 2026  
**Script Location:** `Backend_py/create_bid_admin.py`
