"""
Fallback model: compare tool-generated analysis with user-uploaded final bid document.
Produces comparison_results and learning_feedback for improving future accuracy.
"""
import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from core.sqlalchemy_db import get_db_session
from models.sqlalchemy_models import (
    ComparisonResult,
    FinalBidUpload,
    LearningFeedback,
    ProjectDocument,
)
from services.document_extractor import extract_text

logger = logging.getLogger(__name__)

# Max length for stored tool_value / user_value snippets
SNIPPET_MAX = 2000


def _flatten_analysis_sections(data: Any, prefix: str = "") -> List[Tuple[str, str]]:
    """Flatten nested analysis_data into (path, string_value) for comparison."""
    out: List[Tuple[str, str]] = []
    if data is None:
        return out
    if isinstance(data, dict):
        for k, v in data.items():
            path = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                out.extend(_flatten_analysis_sections(v, path))
            else:
                out.append((path, str(v)[:SNIPPET_MAX] if v is not None else ""))
    elif isinstance(data, list):
        for i, item in enumerate(data):
            path = f"{prefix}[{i}]"
            if isinstance(item, (dict, list)):
                out.extend(_flatten_analysis_sections(item, path))
            else:
                out.append((path, str(item)[:SNIPPET_MAX] if item is not None else ""))
    else:
        out.append((prefix, str(data)[:SNIPPET_MAX]))
    return out


def _get_mimetype(filename: str) -> str:
    ext = (filename or "").lower().split(".")[-1]
    if ext == "pdf":
        return "application/pdf"
    if ext in ("docx", "doc"):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return "application/octet-stream"


async def run_comparison(project_id: int, final_bid_upload_id: int) -> Optional[int]:
    """
    Load tool analysis and final bid file, compare, write comparison_results and learning_feedback.
    Returns comparison_result id on success, None on failure.
    """
    db = get_db_session()
    try:
        upload = db.query(FinalBidUpload).filter(
            FinalBidUpload.id == final_bid_upload_id,
            FinalBidUpload.project_id == project_id,
        ).first()
        if not upload or not upload.file_path or not os.path.isfile(upload.file_path):
            logger.warning(f"Final bid upload {final_bid_upload_id} not found or file missing")
            return None

        # Load tool document (latest or BASE_RFP)
        tool_doc = (
            db.query(ProjectDocument)
            .filter(
                ProjectDocument.project_id == project_id,
            )
            .order_by(ProjectDocument.created_at.desc())
            .first()
        )
        if not tool_doc or not tool_doc.analysis_data:
            logger.warning(f"No tool analysis for project_id={project_id}")
            comparison_output = {
                "sections": [],
                "differences": [{
                    "section": "summary",
                    "field": "tool_analysis",
                    "tool_value": "",
                    "user_value": "Tool has no analysis for this project yet.",
                    "summary": "No tool output to compare.",
                }],
                "summary": "No tool analysis found for this project. Upload and analyze an RFP first.",
            }
            tool_document_id = None
        else:
            tool_document_id = tool_doc.id
            analysis_data = tool_doc.analysis_data
            if isinstance(analysis_data, str):
                try:
                    analysis_data = json.loads(analysis_data)
                except json.JSONDecodeError:
                    analysis_data = {}
            # departmentalSummaries is the main structure
            dept = analysis_data.get("departmentalSummaries") or analysis_data
            tool_flat = _flatten_analysis_sections(dept)

            # Extract text from final bid file
            with open(upload.file_path, "rb") as f:
                file_bytes = f.read()
            mimetype = _get_mimetype(upload.file_name)
            extracted = await extract_text(file_bytes, mimetype, upload.file_name)
            user_text = (extracted.get("text") or "")[:15000]

            # Build differences: each tool section vs user document snippet
            differences: List[Dict[str, Any]] = []
            for path, tool_value in tool_flat:
                if not path or path.startswith("."):
                    continue
                part = path.split(".")[0] if "." in path else path
                user_snippet = user_text[:500].strip() if user_text else "N/A"
                diff = {
                    "section": part,
                    "field": path,
                    "tool_value": (tool_value or "")[:1000],
                    "user_value": user_snippet,
                    "summary": f"Tool: {path}; User document: snippet from uploaded final bid.",
                }
                differences.append(diff)

            comparison_output = {
                "sections": list({d["section"] for d in differences}),
                "differences": differences,
                "summary": f"Compared {len(tool_flat)} tool outputs with uploaded final bid ({len(user_text)} chars). Found {len(differences)} section(s).",
            }

        # Write comparison_results
        cr = ComparisonResult(
            project_id=project_id,
            tool_document_id=tool_document_id,
            final_bid_upload_id=final_bid_upload_id,
            comparison_output=comparison_output,
        )
        db.add(cr)
        db.commit()
        db.refresh(cr)
        comparison_result_id = cr.id

        # Write learning_feedback from differences
        for d in comparison_output.get("differences", []):
            section = d.get("section") or "unknown"
            tool_val = (d.get("tool_value") or "")[:SNIPPET_MAX]
            user_val = (d.get("user_value") or "")[:SNIPPET_MAX]
            lf = LearningFeedback(
                project_id=project_id,
                source_comparison_id=comparison_result_id,
                section_or_key=section,
                tool_value=tool_val or None,
                user_value=user_val or None,
            )
            db.add(lf)
        db.commit()

        # Mark upload as processed
        upload.status = "processed"
        db.commit()

        logger.info(f"Comparison complete: project_id={project_id}, comparison_result_id={comparison_result_id}")
        return comparison_result_id
    except Exception as e:
        logger.exception(f"Comparison failed: {e}")
        db.rollback()
        return None
    finally:
        db.close()


def run_comparison_sync(project_id: int, final_bid_upload_id: int) -> Optional[int]:
    """Synchronous wrapper for run_comparison (for use from sync route)."""
    try:
        return asyncio.run(run_comparison(project_id, final_bid_upload_id))
    except Exception as e:
        logger.exception(f"run_comparison_sync failed: {e}")
        return None
