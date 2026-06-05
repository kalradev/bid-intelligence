# Fix 503: Target Group (port 80) + HTTP→HTTPS Redirect

## What’s wrong

1. **Target group MHP-FE-TG** has **two targets** for the same instance:
   - Port **8080** (Node app – correct)
   - Port **80** (nginx – wrong for this ALB)
   Both were in **Draining** in your screenshot. The ALB must send traffic **only to port 8080**.

2. **HTTP:80 redirect** may be sending:
   `https://#{host}:443/#{path}?#{query}`
   Browsers expect HTTPS on port 443; showing **:443** in the URL can cause redirect/503 issues on some setups.

---

## Step 1 — Target group: only port 8080

1. Open **EC2 → Target Groups → MHP-FE-TG**.
2. Open the **Targets** tab.
3. You should see **two** rows for instance `i-0f25a2cef946d8edb`:
   - One with **Port 8080**
   - One with **Port 80**
4. Select the row where **Port = 80** (checkbox).
5. Click **Deregister** (or **Actions → Deregister**).
6. Confirm. Wait until the **8080** target is **Healthy** (draining on 80 will finish).

Result: ALB forwards **only** to **instance:8080** (Node app). Port 80 is no longer in the target group.

---

## Step 2 — HTTP:80 redirect (no :443 in URL)

1. Open **EC2 → Load Balancers → MHP-FE-DEV**.
2. Open the **Listeners** tab.
3. Click **HTTP : 80** (or “View/Edit rules”).
4. Edit the **redirect** rule so the **resulting URL** does **not** contain **:443**:
   - **Protocol:** HTTPS  
   - **Host:** `#{host}`  
   - **Port:** leave **blank** or **443** (ALB uses it internally; the important part is that the **Location** header is not `https://...#{host}:443/...`).  
   - **Path:** `/#{path}`  
   - **Query:** `#{query}`  

   So the redirect should be effectively:
   - `https://#{host}/#{path}?#{query}`  
   **Not:**
   - `https://#{host}:443/#{path}?#{query}`  

5. Save.

---

## Step 3 — Optional: HTTPS:443 host rule

If 503 persists after Step 1 and 2:

1. **EC2 → Load Balancers → MHP-FE-DEV → Listeners → HTTPS : 443**.
2. **View/Edit rules**.
3. **Add rule** (above default):
   - **Condition:** Host header = `interview.dev.myhiringpartner.ai`
   - **Action:** Forward to **MHP-FE-TG**
4. Keep **Default** action: Forward to **MHP-FE-TG**.
5. Save.

---

## Verify

- **Target group:** MHP-FE-TG → Targets → only **one** target: **i-0f25a2cef946d8edb : 8080**, status **Healthy**.
- **Browser:**  
  `https://interview.dev.myhiringpartner.ai/`  
  → should return **200** (or 302), not 503.
- **From instance (optional):**  
  `curl -I https://mhp-fe-dev-68622308.eu-north-1.elb.amazonaws.com/ -H "Host: interview.dev.myhiringpartner.ai" -k`  
  → expect **HTTP/2 200** (or 302), not 503.

---

## Summary

| Item | Action |
|------|--------|
| MHP-FE-TG | Deregister the **port 80** target; keep only **port 8080**. |
| HTTP:80 listener | Redirect = `https://#{host}/#{path}?#{query}` (no **:443** in URL). |
| HTTPS:443 (optional) | Add host rule for `interview.dev.myhiringpartner.ai` → MHP-FE-TG. |

Your app on **localhost:8080** and with `Host: interview.dev.myhiringpartner.ai` already returns 200; the remaining 503 is from ALB due to the extra **port 80** target and/or redirect format. After these changes, HTTPS should work.
