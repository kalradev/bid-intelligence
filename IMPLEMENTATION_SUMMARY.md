```markdown
## 🧩 Implementation Summary – Bid-Intelligence.ai

This document gives a **high‑level technical overview** of how the system works, consolidating the many fix/feature markdown files into one place.

---

## 1️⃣ Core Capabilities

- **Deterministic BOQ / BOM extraction**
  - Same input file → same items, counts, and OEM/model assignments every time.
  - Table rows come from deterministic extraction, not from the LLM “guessing”.
- **OEM enrichment with real companies only**
  - Uses a curated database of ~391 Indian + Global OEMs plus category‑specific pools.
  - No `"Unspecified"` or fake/vendor‑like placeholders.
- **Model matching per product**
  - For each BOQ item, the system finds a concrete model (e.g., `Dell PowerEdge R740`).
  - Confidence scores and sources (from document, web search, or fallback) are tracked.
- **Stable calculations & meeting‑ready stats**
  - Total OEMs, MII %, mapped/unmapped counts and other metrics are validated.
  - Numbers are designed to be consistent and defendable in meetings.

---

## 2️⃣ End‑to‑End Processing Pipeline

At a high level, when you upload a document:

1. **Upload & hashing**
   - File (PDF/DOC/DOCX) is uploaded to the backend.
   - A hash (e.g. MD5) is computed → this uniquely represents the file contents.
   - Same file always produces the same hash.

2. **Cache lookup**
   - If results for this hash already exist, the backend returns them instantly.
   - This guarantees: *same file → same results*, even after DB deletes + re‑uploads.

3. **Text & table extraction**
   - Document text is extracted.
   - BOQ/BOM tables are extracted deterministically (row‑based).
   - Each row becomes a structured candidate product (no LLM guessing the list).

4. **Per‑row LLM mapping (temperature 0 or very low)**
   - For each row, the AI extracts:
     - Product name, quantity, specifications.
     - Any brand/OEM hints in the row text.
   - Because prompts are structured and temperature is near‑zero, same row → same mapping.

5. **OEM enrichment**
   - **Path A – OEM specified in document**
     - Brand is read directly from the row / surrounding context.
     - Validated against the OEM database and classified as Indian/Global.
   - **Path B – OEM not specified**
     - System tries to infer from product name/category.
     - If still unknown, AI‑assisted web search is used to find realistic OEMs.
     - Category‑specific vendor pools provide 2–3 options when there is no single obvious OEM.
   - **Path C – Fallback**
     - When all else fails, deterministic, category‑based OEM defaults are used instead of `"Unspecified"`.

6. **Model matching**
   - If OEM is known (from document or from enrichment), the system:
     - Takes the product specs (e.g., `Xeon`, `64GB RAM`, `10 Gbps`, etc.).
     - Asks AI to pick a concrete model from the OEM’s typical lineup.
     - Returns: `model`, `modelConfidence`, `modelSource`, and optional alternatives.
   - If OEM is unknown, the system can:
     - Use web search + specs to propose OEM + model pairs.
     - Or use deterministic fallbacks with reasonable defaults.

7. **Deduplication & validation**
   - Duplicate or near‑duplicate rows are merged where appropriate.
   - The system validates:
     - Item counts.
     - OEM variety.
     - MII/Indian vs Global classification.
     - Key numeric totals.

8. **Statistics & summaries**
   - Calculates:
     - Total products.
     - Unique OEM count and their distribution.
     - MII percentage and related metrics.
   - Departmental and global summaries are generated for the frontend.

9. **Save & return**
   - Final enriched dataset is saved under the file hash.
   - Frontend receives consistent, structured JSON for all pages (Product Mapping, Intelligence views, etc.).

---

## 3️⃣ Deterministic BOQ Extraction (Stability Guarantees)

The “deterministic BOQ” work ensures:

- **Fixed source of truth:**
  - Item rows come from a deterministic table extraction algorithm.
  - The LLM is only allowed to *interpret* a row, not add/remove rows.

- **Per‑row processing:**
  - Each row is processed independently with strict JSON schemas.
  - This avoids “global hallucinations” where the model might infer extra items.

- **End‑to‑end determinism:**
  - Same file:
    - Same extracted rows.
    - Same per‑row prompts.
    - Same responses (temperature 0 / greedy).
    - Same OEM & model mapping, same stats.

If you upload the same PDF multiple times (even after deleting DB records), you should see **identical counts, OEMs, models, and percentages**.

---

## 4️⃣ OEM & Model Enrichment Details

### OEM logic

- Uses a curated OEM database (Indian + Global).
- For each product:
  - Prefer OEMs **found in document**.
  - If missing, infer OEMs from product type/category.
  - If still missing, use AI‑assisted web search.
  - As a last resort, use deterministic category defaults (never leave as `"Unspecified"`).

### Model logic

- For each product + OEM:
  - AI selects a concrete model that fits the specs.
  - Confidence scores and explanation fields help debugging.
  - For ambiguous cases, alternatives may be provided.

### Variety & realism

- The system avoids assigning the **same OEM everywhere**.
- Category‑specific pools and hash‑based selection create realistic vendor diversity.
- Calculations ensure:
  - Number of unique OEMs is reasonable for the document type.
  - Indian vs Global split is consistent with the content.

---

## 5️⃣ Versioning & Caching

- A **processing version** constant is used on the backend.
  - When bumping this version, caches are invalidated and documents are re‑processed.
  - This is used when major logic changes (e.g., new enrichment pipeline).
- File hash + version effectively define the cache key.
- This ensures:
  - Old results don’t silently mix with new logic.
  - You can “force refresh” all analyses by increasing the version.

---

## 6️⃣ Frontend Highlights

- **Product Mapping page**
  - Shows BOQ/BOM rows with:
    - Product name, quantity, specs.
    - OEM, model, confidence, MII status.
  - New **Model** column added and wired into the enriched backend response.

- **Global / Technical Intelligence pages**
  - Summaries, risks, actions, and statistics built on the same enriched dataset.
  - Counts are synchronized across views (no more mismatched totals).

---

## 7️⃣ Key Backend Components (Pointers Only)

*(File names for orientation; exact contents can be viewed in the codebase.)*

- `services/tableExtractorService.js` – deterministic PDF table extraction.
- `services/rowMappingService.js` – per‑row LLM mapping into structured JSON.
- `services/deterministicBOQService.js` – orchestration of deterministic BOQ flow.
- `services/oemEnrichmentService.js` – OEM enrichment, classification, statistics.
- `services/modelMatchingService.js` – model lookup & enrichment logic.
- `data/miiDatabase.js` – OEM database (Indian vs Global, categories, etc.).
- `controllers/rfpController.js` – main entry point for document analysis.
- `config/version.js` – processing version used for cache invalidation.

---

## 8️⃣ What to Expect in Real Use

For typical tenders:

- **Civil / construction** – high proportion of Indian OEMs, strong MII %, diverse brands.
- **IT / security** – mix of global and Indian OEMs, realistic brand names, multiple options where no OEM is specified.
- **Mixed documents** – stable counts, realistic vendor spread, and consistent metrics across all pages.

If your results ever look unstable (changing counts or obvious OEM/model randomness for the same file), that’s a sign to check:

- Processing version.
- Cache state.
- AI provider configuration (temperature, prompts).

---

## 9️⃣ Related Documents

- **Quick setup & running the system** → `QUICK_START.md`
- **Security & hardening** → `SECURITY_MEASURES.md`
- **High‑level product overview & architecture** → `README.md`
```


