"""Auto-check eligibility criteria against uploaded reference documents."""
import json
import logging
from typing import Any, Dict, List, Optional

from services import llm_client

logger = logging.getLogger(__name__)

BATCH_SIZE = 12
MAX_REF_CHARS = 80000


def _extract_criteria(summaries: Dict[str, Any]) -> List[str]:
    bm = summaries.get("bidManagement") or {}
    sf = bm.get("successFactors") or {}
    raw = sf.get("preQualificationCriteria")
    if not isinstance(raw, list):
        return []
    return [str(c).strip() for c in raw if c and str(c).strip()]


def _build_reference_block(docs: List[Dict[str, str]]) -> str:
    parts = []
    total = 0
    for doc in docs:
        label = doc.get("label") or "Document"
        text = (doc.get("text") or "").strip()
        if not text:
            continue
        chunk = f"=== {label} ===\n{text}\n"
        if total + len(chunk) > MAX_REF_CHARS:
            remaining = MAX_REF_CHARS - total
            if remaining > 500:
                parts.append(chunk[:remaining] + "\n...[truncated]")
            break
        parts.append(chunk)
        total += len(chunk)
    return "\n".join(parts)


def _parse_batch_result(raw: str, criteria: List[str]) -> Dict[str, Optional[bool]]:
    out: Dict[str, Optional[bool]] = {c: None for c in criteria}
    try:
        data = llm_client.parse_json_from_model_text(raw)
    except Exception:
        logger.warning("Could not parse eligibility auto-check JSON")
        return out
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        return out
    by_index: Dict[int, Optional[bool]] = {}
    for item in results:
        if not isinstance(item, dict):
            continue
        idx = item.get("index")
        if not isinstance(idx, int) or idx < 0 or idx >= len(criteria):
            continue
        status = item.get("status")
        if status == "yes":
            by_index[idx] = True
        elif status == "no":
            by_index[idx] = False
        else:
            by_index[idx] = None
    for i, c in enumerate(criteria):
        if i in by_index:
            out[c] = by_index[i]
    return out


def _check_batch(criteria: List[str], reference_block: str) -> Dict[str, Optional[bool]]:
    if not criteria or not reference_block.strip():
        return {c: None for c in criteria}

    numbered = "\n".join(f"{i}. {c}" for i, c in enumerate(criteria))
    prompt = f"""You are a bid compliance officer. Given REFERENCE DOCUMENTS (company certificates, registrations, financials, etc.) and ELIGIBILITY CRITERIA from a tender, decide for each criterion whether the reference documents clearly satisfy it.

Rules:
- "yes" ONLY if reference documents provide clear evidence the bidder/company meets the criterion.
- "no" ONLY if reference documents clearly show the criterion is NOT met or evidence is missing/contradictory.
- "unknown" if you cannot tell from the reference documents alone (manual review needed).

REFERENCE DOCUMENTS:
{reference_block}

ELIGIBILITY CRITERIA (use index 0-based):
{numbered}

Return JSON: {{ "results": [ {{ "index": 0, "status": "yes"|"no"|"unknown" }}, ... ] }}
Include one entry per criterion index."""

    system = "Return only valid JSON. Be conservative: use unknown when evidence is insufficient."

    cli = llm_client.get_sync_chat_client()
    if not cli:
        logger.warning("LLM not configured; skipping eligibility auto-check")
        return {c: None for c in criteria}

    try:
        raw, _ = llm_client.chat_completion_sync(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            model=llm_client.get_model_eligibility(),
            temperature=0.1,
            max_tokens=4096,
            json_object=True,
        )
        return _parse_batch_result(raw, criteria)
    except Exception as e:
        logger.warning(f"Eligibility auto-check batch failed: {e}")
        return {c: None for c in criteria}


def auto_check_criteria(
    criteria: List[str],
    reference_docs: List[Dict[str, str]],
) -> Dict[str, Optional[bool]]:
    """Return map criteria_text -> True (yes), False (no), or None (manual needed)."""
    if not criteria:
        return {}
    ref_block = _build_reference_block(reference_docs)
    if not ref_block.strip():
        return {c: None for c in criteria}

    merged: Dict[str, Optional[bool]] = {}
    for start in range(0, len(criteria), BATCH_SIZE):
        batch = criteria[start : start + BATCH_SIZE]
        batch_result = _check_batch(batch, ref_block)
        merged.update(batch_result)
    return merged


def auto_check_from_summaries(
    summaries: Dict[str, Any],
    reference_docs: List[Dict[str, str]],
) -> Dict[str, Optional[bool]]:
    criteria = _extract_criteria(summaries)
    return auto_check_criteria(criteria, reference_docs)
