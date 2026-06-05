import logging
import json
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from models.project import ProjectModel
from services.ai_service import generate_departmental_summaries

logger = logging.getLogger(__name__)

# Patterns to find bid/contract/estimated value in text (e.g. "Estimated bid value: ₹22,266,000")
_BID_VALUE_PATTERNS = [
    re.compile(r"(?:estimated\s+)?bid\s+value\s*[:\-]\s*([₹Rs\.\d,\s\-]+)", re.I),
    re.compile(r"(?:project|contract|tender|work)\s+value\s*[:\-]\s*([₹Rs\.\d,\s\-]+)", re.I),
    re.compile(r"estimated\s+(?:cost|value)\s*[:\-]\s*([₹Rs\.\d,\s\-]+)", re.I),
    re.compile(r"total\s+(?:contract|project)\s+value\s*[:\-]\s*([₹Rs\.\d,\s\-]+)", re.I),
]

_EMD_VALUE_PATTERNS = [
    re.compile(r"(?:emd|earnest\s+money\s+deposit)\s*[:\-]?\s*([₹Rs\.\d,\s\-]+)", re.I),
    re.compile(r"bid\s+security\s*[:\-]?\s*([₹Rs\.\d,\s\-]+)", re.I),
]

# Patterns to find bid submission deadline (date/time) in text
_SUBMISSION_DEADLINE_PATTERNS = [
    re.compile(r"bid\s+submission\s+deadline\s*[:\-]\s*(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}(?:\s+at\s+\d{1,2}:\d{2}(?::\d{2})?)?)", re.I),
    re.compile(r"bid\s+submission\s+deadline\s+is\s+(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}(?:\s+at\s+\d{1,2}:\d{2}(?::\d{2})?)?)", re.I),
    re.compile(r"last\s+date\s+(?:of\s+)?submission\s*[:\-]\s*(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)", re.I),
    re.compile(r"submission\s+deadline\s*[:\-]\s*(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}(?:\s+at\s+\d{1,2}:\d{2}(?::\d{2})?)?)", re.I),
    re.compile(r"(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)"),  # e.g. 16-03-2026 at 16:00:00
]

# Tender ID: treat as wrong if it looks like filename or internal/system ID (not the document's Bid Number)
_TENDER_ID_BAD_PATTERNS = [
    re.compile(r"\.pdf$", re.I),
    re.compile(r"^doc\d{10,}", re.I),  # e.g. doc5698116987835412938
    re.compile(r"^ATCF_[a-f0-9\-]+_buyer\d+_eoc$", re.I),
    re.compile(r"^[a-f0-9]{8,}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"),  # UUID
    re.compile(r"_buyer\d+_eoc", re.I),
]

# Extract official Bid Number / Tender ID from document text (e.g. GEM/2026/B/7249343)
_TENDER_ID_EXTRACT_PATTERNS = [
    re.compile(r"GEM/\d{4}/[A-Z]/\d+", re.I),  # GeM format: GEM/2026/B/7249343
    re.compile(r"(?:बिड\s+संख्या|Bid\s+Number|Bid\s+No\.?|Tender\s+No\.?|RFP\s+No\.?|NIT\s+No\.?)\s*[:\-]?\s*([A-Za-z0-9/\-\s]+?)(?:\s|$|,|\n|Dated|दिनांक)", re.I),
    re.compile(r"(?:Bid\s+Number|Tender\s+(?:Ref\.?|Reference)\s*No\.?)\s*[:\-]?\s*([A-Za-z0-9/\-]+)", re.I),
    re.compile(r"NIT[\-\s]?\d+[\-\s]?\d+/\d+", re.I),
    re.compile(r"RFP[\-\s]?\d+[\-\s]?\d+", re.I),
]


def _is_tender_id_wrong(current: str) -> bool:
    """True if current value looks like filename or system ID, not the document's Bid Number."""
    if not current or (current or "").strip().upper() in ("N/A", ""):
        return True
    s = (current or "").strip()
    for pat in _TENDER_ID_BAD_PATTERNS:
        if pat.search(s):
            return True
    if re.match(r"^[a-f0-9]{16,}$", s.replace("-", "").replace("_", "")):
        return True  # long hex
    return False


# Section headers and known non-product strings that must never appear as product names
_PRODUCT_NAME_BLOCKLIST = frozenset([
    "bid details", "बिड विवरण", "bid details/bid details", "बिड विवरण/bid details",
    "बबडड ववववररणण", "bid document", "बिड दस्तावेज़", "tender details", "rfp details",
    "document details", "section", "header", "instructions to bidders", "annexure",
])


def _is_invalid_product_name(name: str) -> bool:
    """True if name is a section header, garbled (duplicated chars), or otherwise not a real product."""
    if not name or not (name or "").strip():
        return True
    s = (name or "").strip()
    # Explicit blocklist (case-insensitive, and normalized for common variants)
    lower = s.lower()
    for block in _PRODUCT_NAME_BLOCKLIST:
        if block in lower or lower == block:
            return True
    # Garbled: same character repeated consecutively (e.g. बबडड ववववररणण)
    if len(s) >= 4:
        pairs = [s[i:i + 2] for i in range(0, len(s) - 1, 2)]
        if pairs:
            repeated = sum(1 for p in pairs if len(p) == 2 and p[0] == p[1])
            if repeated >= len(pairs) * 0.5:
                return True
    # Very short and no digit/product-like token
    if len(s) <= 2:
        return True
    return False


def _extract_bid_number_from_text(text: str) -> Optional[str]:
    """Extract official Bid Number / Tender ID from document text (e.g. GEM/2026/B/7249343)."""
    if not text or not text.strip():
        return None
    for pat in _TENDER_ID_EXTRACT_PATTERNS:
        for m in pat.finditer(text):
            try:
                val = (m.group(1) if pat.groups else m.group(0)).strip()
            except (IndexError, AttributeError):
                val = m.group(0).strip()
            if not val or len(val) > 80:
                continue
            if _is_tender_id_wrong(val):
                continue
            if re.search(r"[A-Za-z0-9/\-]", val):
                return val
    return None


def _safe_text(value: Any) -> str:
    """Convert mixed model outputs (str/list/dict/None) into a comparable string."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = [v.strip() for v in value if isinstance(v, str) and v.strip()]
        return " | ".join(parts).strip()
    if isinstance(value, dict):
        parts = [v.strip() for v in value.values() if isinstance(v, str) and v.strip()]
        return " | ".join(parts).strip()
    if value is None:
        return ""
    return str(value).strip()


class ProjectService:
    @staticmethod
    async def process_project_document(
        project_name: str,
        tender_id: str,
        client_name: str,
        update_type: str,
        file_hash: str,
        file_name: str,
        extracted_text: str,
        user_id: int  # PostgreSQL user ID (integer)
    ) -> Dict[str, Any]:
        # 1. Check if project exists (scoped to user)
        project = ProjectModel.get_by_name(project_name, user_id)
        
        previous_analysis = None
        if not project:
            if update_type != 'BASE_RFP':
                raise ValueError(f"Project '{project_name}' does not exist. First upload must be BASE_RFP.")
            existing_by_tender = ProjectModel.get_by_tender_id(tender_id)
            if existing_by_tender:
                raise ValueError(
                    f"Tender ID '{tender_id}' already exists in project "
                    f"'{existing_by_tender.get('project_name', 'unknown')}'. "
                    "Please use Select Existing to upload this file."
                )
            project_id = ProjectModel.create(project_name, tender_id, client_name, user_id)
            if not project_id:
                raise ValueError("Failed to create new project.")
            logger.info(f"✨ Created NEW PROJECT: {project_name} (ID: {project_id}) for user {user_id}")
        else:
            project_id = project['id']
            # Verify the project belongs to this user
            if project.get('user_id') != user_id:
                raise ValueError(f"Project '{project_name}' does not belong to you.")
            _ut = (update_type or "BASE_RFP").strip().upper()
            if _ut == "BASE_RFP":
                logger.info(
                    "Project %r already exists; coercing upload type BASE_RFP → CORRIGENDUM.",
                    project_name,
                )
                update_type = "CORRIGENDUM"
            else:
                update_type = _ut
            
            # Fetch latest document's analysis to merge with
            from core.sqlalchemy_db import get_db_session
            from models.sqlalchemy_models import ProjectDocument
            db = get_db_session()
            try:
                doc = db.query(ProjectDocument).filter(
                    ProjectDocument.project_id == project_id
                ).order_by(ProjectDocument.created_at.desc()).first()
                
                if doc and doc.analysis_data:
                    previous_analysis = doc.analysis_data
                    logger.info(f"🔄 Found previous analysis for project {project_id} to merge with.")
            except Exception as e:
                logger.error(f"Error fetching previous analysis: {str(e)}")
            finally:
                db.close()

            logger.info(f"📁 Adding to EXISTING PROJECT: {project_name} (ID: {project_id}, Type: {update_type})")

        # 2. Extract structured data using AI (pass project_id for learning_feedback injection)
        ai_result = await generate_departmental_summaries(extracted_text, file_name, project_id=project_id)
        new_summaries = ai_result['summaries']
        
        # Debug: Log product mapping extraction
        if new_summaries.get("productMapping"):
            pm = new_summaries["productMapping"]
            product_count = len(pm.get("miiProductStatus", []))
            logger.info(f"📦 Product Mapping extracted: {product_count} products found")
            if product_count > 0:
                logger.info(f"   Sample product: {pm['miiProductStatus'][0]}")
            else:
                logger.warning("⚠️ No products extracted from document! Check if document contains BOQ/BOM.")
        else:
            logger.warning("⚠️ No productMapping section in AI response!")
        
        # 3. Merge with previous analysis if it exists
        if previous_analysis:
            from services.ai_service import naive_merge_summaries
            logger.info(f"⚖️ Merging NEW {update_type} with existing project baseline...")
            # We want new corrigendum to override previous RFP/Update
            merged_summaries = naive_merge_summaries([previous_analysis, new_summaries])
        else:
            merged_summaries = new_summaries

        # Remove section headers / garbled names from product list (e.g. "Bid Details", "बबडड ववववररणण")
        merged_summaries = ProjectService._filter_invalid_products(merged_summaries)

        # Perform OEM Enrichment on the merged result
        await ProjectService._enrich_and_sync_summaries(merged_summaries, [file_name])
        
        # Sync bid value from bidManagement and commercial/finance to projectOverview when missing (so N/A is filled from any file)
        merged_summaries = ProjectService._sync_bid_value_from_bid_management(merged_summaries)
        merged_summaries = ProjectService._sync_bid_value_from_departments(merged_summaries)
        merged_summaries = ProjectService._sync_financials_from_document_text(merged_summaries, extracted_text)
        # Sync last submission date from bidManagement (keyDeadlines, Timeline, etc.) when missing
        merged_summaries = ProjectService._sync_last_submission_date_from_bid_management(merged_summaries)
        # Replace wrong tenderId (filename/system ID) with actual Bid Number extracted from document text
        merged_summaries = ProjectService._sync_tender_id_from_document(merged_summaries, extracted_text)
        # Validate EMD vs Bid Value
        merged_summaries = ProjectService._validate_emd_vs_bid_value(merged_summaries)
        merged_summaries = ProjectService._normalize_departmental_summaries(merged_summaries)
        
        # Debug: Log final product mapping after enrichment
        if merged_summaries.get("productMapping"):
            pm = merged_summaries["productMapping"]
            product_count = len(pm.get("miiProductStatus", []))
            logger.info(f"✅ Final Product Mapping after enrichment: {product_count} products")
            logger.info(f"   Total Items: {pm.get('totalItems', 0)}")
            logger.info(f"   Products Mapped: {pm.get('productsMapped', 0)}")
        else:
            logger.error("❌ productMapping missing after enrichment!")

        # 4. Store document
        doc_id = ProjectModel.add_document(
            project_id, file_hash, file_name, update_type, extracted_text, merged_summaries
        )
        
        # 5. Store granular records for audit trace
        ProjectService._store_granular_records(project_id, doc_id, update_type, file_name, file_hash, new_summaries)
        
        # 6. Return both merged analysis and auditable trace
        final_data = ProjectService.get_final_analysis(project_id)
        final_data['departmentalSummaries'] = merged_summaries
        final_data['project_id'] = project_id  # Include project_id for document lookup
        
        # Debug: Final check of product mapping
        if merged_summaries.get("productMapping"):
            pm = merged_summaries["productMapping"]
            product_count = len(pm.get("miiProductStatus", []))
            logger.info(f"✅ Final return: {product_count} products in productMapping.miiProductStatus")
        else:
            logger.error("❌ CRITICAL: productMapping missing in final merged_summaries!")
        
        return final_data

    @staticmethod
    async def process_project_documents(
        project_name: str,
        tender_id: str,
        client_name: str,
        update_type: str,
        file_hash: str,
        file_names: List[str],
        per_file_texts: List[Tuple[str, str]],
        user_id: int,
    ) -> Dict[str, Any]:
        """
        Process multiple documents separately and merge results so that if a value is
        N/A in one document but present in another, the final analysis uses the value
        from any document (prefer non-N/A). Fixes the issue where analysis was biased
        toward the first uploaded PDF only.
        """
        if not per_file_texts or len(per_file_texts) < 2:
            raise ValueError("process_project_documents requires at least 2 (filename, text) pairs.")

        # 1. Project existence and previous_analysis (same as single-doc flow)
        project = ProjectModel.get_by_name(project_name, user_id)
        previous_analysis = None
        if not project:
            if update_type != "BASE_RFP":
                raise ValueError(f"Project '{project_name}' does not exist. First upload must be BASE_RFP.")
            existing_by_tender = ProjectModel.get_by_tender_id(tender_id)
            if existing_by_tender:
                raise ValueError(
                    f"Tender ID '{tender_id}' already exists in project "
                    f"'{existing_by_tender.get('project_name', 'unknown')}'. "
                    "Please use Select Existing to upload this file."
                )
            project_id = ProjectModel.create(project_name, tender_id, client_name, user_id)
            if not project_id:
                raise ValueError("Failed to create new project.")
            logger.info(f"✨ Created NEW PROJECT: {project_name} (ID: {project_id}) for user {user_id}")
        else:
            project_id = project["id"]
            if project.get("user_id") != user_id:
                raise ValueError(f"Project '{project_name}' does not belong to you.")
            _ut = (update_type or "BASE_RFP").strip().upper()
            if _ut == "BASE_RFP":
                logger.info(
                    "Project %r already exists; coercing upload type BASE_RFP → CORRIGENDUM.",
                    project_name,
                )
                update_type = "CORRIGENDUM"
            else:
                update_type = _ut
            from core.sqlalchemy_db import get_db_session
            from models.sqlalchemy_models import ProjectDocument
            db = get_db_session()
            try:
                doc = db.query(ProjectDocument).filter(
                    ProjectDocument.project_id == project_id
                ).order_by(ProjectDocument.created_at.desc()).first()
                if doc and doc.analysis_data:
                    previous_analysis = doc.analysis_data
                    logger.info(f"🔄 Found previous analysis for project {project_id} to merge with.")
            except Exception as e:
                logger.error(f"Error fetching previous analysis: {str(e)}")
            finally:
                db.close()
            logger.info(f"📁 Adding to EXISTING PROJECT: {project_name} (ID: {project_id}, Type: {update_type})")

        # 2. Run AI per document and merge (prefer non-N/A from any document)
        from services.ai_service import naive_merge_summaries
        all_summaries = []
        for fname, text in per_file_texts:
            logger.info(f"📄 Analyzing document: {fname}")
            ai_result = await generate_departmental_summaries(text, fname, project_id=project_id)
            all_summaries.append(ai_result["summaries"])
        new_summaries = naive_merge_summaries(all_summaries)
        logger.info(f"✅ Merged analysis from {len(per_file_texts)} documents (prefer non-N/A from any document)")

        # 3. Merge with previous project analysis if exists
        if previous_analysis:
            logger.info("⚖️ Merging with existing project baseline...")
            merged_summaries = naive_merge_summaries([previous_analysis, new_summaries])
        else:
            merged_summaries = new_summaries

        merged_summaries = ProjectService._filter_invalid_products(merged_summaries)
        await ProjectService._enrich_and_sync_summaries(merged_summaries, file_names)
        merged_summaries = ProjectService._sync_bid_value_from_bid_management(merged_summaries)
        merged_summaries = ProjectService._sync_bid_value_from_departments(merged_summaries)
        # Build once and reuse for all text-based sync/validation steps in multi-file flow.
        combined_text = "\n\n".join(
            f"--- DOCUMENT {i+1}: {name} ---\n{text}" for i, (name, text) in enumerate(per_file_texts)
        )
        merged_summaries = ProjectService._sync_financials_from_document_text(merged_summaries, combined_text)
        merged_summaries = ProjectService._sync_last_submission_date_from_bid_management(merged_summaries)
        merged_summaries = ProjectService._sync_tender_id_from_document(merged_summaries, combined_text)
        merged_summaries = ProjectService._validate_emd_vs_bid_value(merged_summaries)
        merged_summaries = ProjectService._normalize_departmental_summaries(merged_summaries)

        if merged_summaries.get("productMapping"):
            pm = merged_summaries["productMapping"]
            logger.info(f"✅ Final Product Mapping: {len(pm.get('miiProductStatus', []))} products")
        else:
            logger.error("❌ productMapping missing after enrichment!")

        file_name_display = ", ".join(file_names)
        doc_id = ProjectModel.add_document(
            project_id, file_hash, file_name_display, update_type, combined_text, merged_summaries
        )
        ProjectService._store_granular_records(
            project_id, doc_id, update_type, file_name_display, file_hash, merged_summaries
        )
        final_data = ProjectService.get_final_analysis(project_id)
        final_data["departmentalSummaries"] = merged_summaries
        final_data["project_id"] = project_id
        return final_data

    @staticmethod
    def _store_granular_records(project_id, doc_id, source_type: str, file_name: str, file_hash: str, summaries: Dict[str, Any]):
        """Breaks down the AI summary into auditable records."""
        sections_to_extract = [
            ('projectOverview', 'Project Overview'),
            ('bidManagement.successFactors', 'Success Factors'),
            ('bidManagement.keyPoints', 'Key Points'),
            ('bidManagement.complianceRequirements', 'Compliance Requirements'),
            ('bidManagement.riskAreas', 'Risk Areas'),
            ('bidManagement.riskFactors', 'Risk Factors'),
            ('technical.criticalRequirements', 'Technical Requirements'),
            ('commercial.keyTerms', 'Commercial Terms'),
            ('finance.financialRequirements', 'Financial Requirements'),
            ('legal.complianceRequirements', 'Legal Requirements')
        ]

        for path, section_name in sections_to_extract:
            data = ProjectService._get_nested_val(summaries, path)
            if not data: continue

            if isinstance(data, dict):
                # Handle categorized data e.g. {"Financial": ["item1"]}
                for category, items in data.items():
                    if isinstance(items, list):
                        for item in items:
                            ProjectModel.add_analysis_record(
                                project_id, doc_id, f"{section_name} - {category}", 
                                str(item), source_type, file_name, file_hash
                            )
                    elif items and items != 'N/A':
                         ProjectModel.add_analysis_record(
                             project_id, doc_id, f"{section_name} - {category}", 
                             str(items), source_type, file_name, file_hash
                         )
            elif isinstance(data, list):
                for item in data:
                    ProjectModel.add_analysis_record(
                        project_id, doc_id, section_name, 
                        str(item), source_type, file_name, file_hash
                    )
            elif data and data != 'N/A':
                 ProjectModel.add_analysis_record(
                     project_id, doc_id, section_name, 
                     str(data), source_type, file_name, file_hash
                 )

    @staticmethod
    def _get_nested_val(data: Dict[str, Any], path: str) -> Any:
        keys = path.split('.')
        for key in keys:
            if isinstance(data, dict):
                data = data.get(key)
            else:
                return None
        return data

    @staticmethod
    def _normalize_departmental_summaries(departmental_summaries: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure all frontend-facing sections exist, even for partial LLM output."""
        if not isinstance(departmental_summaries, dict):
            departmental_summaries = {}

        for section in (
            "projectOverview",
            "bidManagement",
            "technical",
            "commercial",
            "finance",
            "legal",
            "scm",
            "productMapping",
        ):
            if not isinstance(departmental_summaries.get(section), dict):
                departmental_summaries[section] = {}

        bm = departmental_summaries.get("bidManagement") or {}
        technical = departmental_summaries.get("technical") or {}
        legal = departmental_summaries.get("legal") or {}
        scm = departmental_summaries.get("scm") or {}
        product_mapping = departmental_summaries.get("productMapping") or {}

        # Backfill missing department blocks from bidManagement when model returns partial JSON.
        for field in ("keyPoints", "complianceRequirements", "riskAreas", "actionItems"):
            if bm.get(field):
                technical.setdefault(field, bm.get(field))
                legal.setdefault(field, bm.get(field))
                scm.setdefault(field, bm.get(field))

        if not isinstance(product_mapping.get("miiProductStatus"), list):
            product_mapping["miiProductStatus"] = []
        products = product_mapping.get("miiProductStatus", [])

        # Keep stats consistent with actual rows shown in the UI table.
        # If no products exist, all counters should be zero.
        if len(products) == 0:
            product_mapping["totalItems"] = 0
            product_mapping["productsMapped"] = 0
            product_mapping["totalOEMs"] = {"count": 0, "indian": 0, "global": 0}
            product_mapping["makeInIndiaMapping"] = {"status": "0%", "mapped": 0, "unmapped": 0}
        else:
            product_mapping["totalItems"] = len(products)
            if not isinstance(product_mapping.get("productsMapped"), int):
                product_mapping["productsMapped"] = 0
        if not isinstance(product_mapping.get("totalOEMs"), dict):
            product_mapping["totalOEMs"] = {"count": 0, "indian": 0, "global": 0}
        if not isinstance(product_mapping.get("makeInIndiaMapping"), dict):
            product_mapping["makeInIndiaMapping"] = {
                "status": "0%",
                "mapped": 0,
                "unmapped": product_mapping.get("totalItems", 0),
            }

        departmental_summaries["technical"] = technical
        departmental_summaries["legal"] = legal
        departmental_summaries["scm"] = scm
        departmental_summaries["productMapping"] = product_mapping
        return departmental_summaries

    @staticmethod
    def _sync_bid_value_from_bid_management(departmental_summaries: Dict[str, Any]) -> Dict[str, Any]:
        """When projectOverview.bidValue is missing or N/A, try to extract it from bidManagement Financial lists."""
        project_overview = departmental_summaries.get("projectOverview") or {}
        current = _safe_text(project_overview.get("bidValue"))
        if current and current.upper() != "N/A":
            return departmental_summaries

        bm = departmental_summaries.get("bidManagement") or {}
        candidates = []

        def collect_text(items: Any) -> None:
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, str) and item.strip():
                        candidates.append(item.strip())
            elif isinstance(items, dict):
                for v in items.values():
                    collect_text(v)

        for key in ("successFactors", "keyPoints", "complianceRequirements"):
            collect_text(bm.get(key))

        for text in candidates:
            for pat in _BID_VALUE_PATTERNS:
                m = pat.search(text)
                if m:
                    value = m.group(1).strip()
                    if re.search(r"\d", value):
                        if "projectOverview" not in departmental_summaries:
                            departmental_summaries["projectOverview"] = {}
                        departmental_summaries["projectOverview"]["bidValue"] = value
                        logger.info(f"Synced bid value from bidManagement to projectOverview: {value}")
                        return departmental_summaries
        return departmental_summaries

    @staticmethod
    def _sync_bid_value_from_departments(departmental_summaries: Dict[str, Any]) -> Dict[str, Any]:
        """When projectOverview.bidValue is still N/A, use commercial.estimatedValue or finance (from any merged file)."""
        project_overview = departmental_summaries.get("projectOverview") or {}
        current = _safe_text(project_overview.get("bidValue"))
        if current and current.upper() != "N/A":
            return departmental_summaries

        # Commercial often has estimatedValue (e.g. ₹22,266,000) when projectOverview does not
        for section_key in ("commercial", "finance"):
            section = departmental_summaries.get(section_key) or {}
            val = _safe_text(section.get("estimatedValue"))
            if val and val.upper() != "N/A" and re.search(r"\d", val):
                if "projectOverview" not in departmental_summaries:
                    departmental_summaries["projectOverview"] = {}
                departmental_summaries["projectOverview"]["bidValue"] = val
                logger.info(f"Synced bid value from {section_key}.estimatedValue to projectOverview: {val}")
                return departmental_summaries
        return departmental_summaries

    @staticmethod
    def _sync_financials_from_document_text(
        departmental_summaries: Dict[str, Any], extracted_text: str
    ) -> Dict[str, Any]:
        """
        Last-resort fallback: extract bidValue/emd directly from document text
        when model output misses them.
        """
        if not extracted_text:
            return departmental_summaries

        if "projectOverview" not in departmental_summaries or not isinstance(departmental_summaries.get("projectOverview"), dict):
            departmental_summaries["projectOverview"] = {}
        po = departmental_summaries["projectOverview"]

        bid_current = str(po.get("bidValue") or "").strip()
        emd_current = str(po.get("emd") or "").strip()

        if (not bid_current or bid_current.upper() == "N/A"):
            for pat in _BID_VALUE_PATTERNS:
                m = pat.search(extracted_text)
                if m:
                    val = (m.group(1) or "").strip()
                    if val and re.search(r"\d", val):
                        po["bidValue"] = val
                        logger.info("Synced bid value directly from document text: %s", val)
                        break

        if (not emd_current or emd_current.upper() == "N/A"):
            for pat in _EMD_VALUE_PATTERNS:
                m = pat.search(extracted_text)
                if m:
                    val = (m.group(1) or "").strip()
                    if val and re.search(r"\d", val):
                        po["emd"] = val
                        logger.info("Synced EMD directly from document text: %s", val)
                        break

        return departmental_summaries

    @staticmethod
    def _sync_last_submission_date_from_bid_management(departmental_summaries: Dict[str, Any]) -> Dict[str, Any]:
        """When projectOverview.lastSubmissionDate is missing or N/A, extract it from bidManagement (keyDeadlines, Timeline, etc.)."""
        project_overview = departmental_summaries.get("projectOverview") or {}
        current = _safe_text(project_overview.get("lastSubmissionDate"))
        if current and current.upper() != "N/A":
            return departmental_summaries

        bm = departmental_summaries.get("bidManagement") or {}
        candidates = []

        # keyDeadlines is often a full string like "Bid submission deadline is 16-03-2026 at 16:00:00..."
        key_deadlines = _safe_text(bm.get("keyDeadlines"))
        if key_deadlines:
            candidates.append(key_deadlines)

        def collect_text(items: Any) -> None:
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, str) and item.strip():
                        candidates.append(item.strip())
            elif isinstance(items, dict):
                for v in items.values():
                    collect_text(v)

        for key in ("successFactors", "keyPoints", "complianceRequirements"):
            collect_text(bm.get(key))

        for text in candidates:
            # Skip lines that are explicitly N/A for submission deadline
            if re.search(r"bid\s+submission\s+deadline\s*[:\-]\s*N/A\b", text, re.I):
                continue
            for pat in _SUBMISSION_DEADLINE_PATTERNS:
                m = pat.search(text)
                if m:
                    value = m.group(1).strip()
                    if value and re.search(r"\d", value):
                        if "projectOverview" not in departmental_summaries:
                            departmental_summaries["projectOverview"] = {}
                        departmental_summaries["projectOverview"]["lastSubmissionDate"] = value
                        logger.info(f"Synced last submission date from bidManagement to projectOverview: {value}")
                        return departmental_summaries
        return departmental_summaries

    @staticmethod
    def _filter_invalid_products(departmental_summaries: Dict[str, Any]) -> Dict[str, Any]:
        """Remove entries from miiProductStatus that are section headers, garbled text, or not real products."""
        pm = departmental_summaries.get("productMapping") or {}
        products = pm.get("miiProductStatus") or []
        if not products:
            return departmental_summaries
        valid = [p for p in products if not _is_invalid_product_name(_safe_text(p.get("productName")))]
        removed = len(products) - len(valid)
        if removed > 0:
            logger.info(f"Filtered out {removed} invalid product(s) (section headers/garbled names)")
            if "productMapping" not in departmental_summaries:
                departmental_summaries["productMapping"] = {}
            departmental_summaries["productMapping"]["miiProductStatus"] = valid
        return departmental_summaries

    @staticmethod
    def _sync_tender_id_from_document(departmental_summaries: Dict[str, Any], extracted_text: str) -> Dict[str, Any]:
        """If projectOverview.tenderId looks like filename or system ID, replace with Bid Number extracted from document text."""
        project_overview = departmental_summaries.get("projectOverview") or {}
        current = _safe_text(project_overview.get("tenderId"))
        if not _is_tender_id_wrong(current):
            return departmental_summaries
        extracted = _extract_bid_number_from_text(extracted_text or "")
        if not extracted:
            return departmental_summaries
        if "projectOverview" not in departmental_summaries:
            departmental_summaries["projectOverview"] = {}
        departmental_summaries["projectOverview"]["tenderId"] = extracted
        logger.info(f"Replaced tenderId from document Bid Number: {extracted}")
        return departmental_summaries

    @staticmethod
    def _validate_emd_vs_bid_value(departmental_summaries: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that EMD and Bid Value are not the same (EMD should be much smaller)"""
        project_overview = departmental_summaries.get("projectOverview", {})
        emd = _safe_text(project_overview.get("emd"))
        bid_value = _safe_text(project_overview.get("bidValue"))
        
        # If both exist and appear to be the same value, flag it
        if emd and bid_value and emd != "N/A" and bid_value != "N/A":
            # Extract numeric values (remove currency symbols, commas, etc.)
            import re
            emd_clean = emd.replace(',', '').replace('₹', '').replace('Rs.', '').replace('Rs', '').strip()
            bid_clean = bid_value.replace(',', '').replace('₹', '').replace('Rs.', '').replace('Rs', '').strip()
            
            emd_num = re.findall(r'[\d.]+', emd_clean)
            bid_num = re.findall(r'[\d.]+', bid_clean)
            
            if emd_num and bid_num:
                try:
                    emd_val = float(emd_num[0])
                    bid_val = float(bid_num[0])
                    
                    # If they're exactly the same or very close, this is likely wrong
                    if abs(emd_val - bid_val) < 0.01 or (emd_val == bid_val):
                        logger.warning(f"⚠️ VALIDATION ERROR: EMD ({emd}) and Bid Value ({bid_value}) appear to be the same!")
                        logger.warning("   EMD should typically be 1-2% of Bid Value")
                        logger.warning("   This suggests incorrect extraction - please verify in source document")
                        # Mark bidValue as potentially incorrect if EMD seems reasonable
                        if emd_val < 10000000:  # If EMD is less than 1 crore, it's probably correct
                            logger.warning(f"   EMD ({emd}) seems reasonable - Bid Value might be incorrectly extracted")
                            project_overview["bidValue"] = "N/A"  # Mark as unknown to force re-extraction
                except (ValueError, IndexError):
                    pass
        
        return departmental_summaries

    @staticmethod
    def _ensure_stats_consistency(departmental_summaries: Dict[str, Any]):
        """Recalculates enrichment statistics for cached or processed data."""
        from services.oem_enrichment_service import get_enrichment_stats
        
        if (departmental_summaries.get("productMapping") and 
            departmental_summaries["productMapping"].get("miiProductStatus")):
            products = departmental_summaries["productMapping"]["miiProductStatus"]
            stats = get_enrichment_stats(products)
            
            departmental_summaries["productMapping"]["totalOEMs"] = {
                "count": stats["uniqueOEMCount"],
                "indian": stats["uniqueIndianCount"],
                "global": stats["uniqueGlobalCount"]
            }
            departmental_summaries["productMapping"]["productsMapped"] = stats["enriched"]
            departmental_summaries["productMapping"]["totalItems"] = stats["total"]
            
            mapped = stats["indianOEMs"]
            unmapped = stats["total"] - mapped
            departmental_summaries["productMapping"]["makeInIndiaMapping"] = {
                "status": stats["miiCompliance"],
                "mapped": mapped,
                "unmapped": unmapped
            }

    @staticmethod
    async def _enrich_and_sync_summaries(summaries: Dict[str, Any], filenames: List[str]):
        """Performs OEM enrichment and syncs technical specifications."""
        from services.oem_enrichment_service import enrich_products, get_enrichment_stats
        from services.oem_recommendation_service import enrich_products_with_recommendations, get_recommendation_stats
        
        if (summaries.get("productMapping") and 
            summaries["productMapping"].get("miiProductStatus")):
            products = summaries["productMapping"]["miiProductStatus"]
            valid_products = [p for p in products if p.get("productName") and p.get("productName").strip() not in ["", "N/A", "n/a"]]
            
            # Step 1: Basic OEM enrichment (for OEM classification and MII status)
            enriched_products = await enrich_products(valid_products)
            
            # Step 2: Generate AI-powered OEM and MODEL recommendations
            # This is critical - it generates model names for existing OEMs
            try:
                logger.info(f"🎯 Generating model recommendations for {len(enriched_products)} products...")
                enriched_products = await enrich_products_with_recommendations(enriched_products)
                rec_stats = get_recommendation_stats(enriched_products)
                logger.info(f"✅ Model recommendations generated: {rec_stats['productsWithRecommendations']}/{rec_stats['totalProducts']} products")
            except Exception as e:
                logger.error(f"⚠️ Model recommendation generation failed: {str(e)}")
                # Continue with basic enrichment if recommendation fails
                logger.info("📦 Proceeding with basic OEM enrichment only")
            
            # Calculate stats from enriched products
            stats = get_enrichment_stats(enriched_products)
            
            summaries["productMapping"]["miiProductStatus"] = enriched_products
            summaries["productMapping"]["totalOEMs"] = {
                "count": stats["uniqueOEMCount"],
                "indian": stats["uniqueIndianCount"],
                "global": stats["uniqueGlobalCount"]
            }
            summaries["productMapping"]["productsMapped"] = stats["enriched"]
            summaries["productMapping"]["totalItems"] = stats["total"]
            
            mapped = stats["indianOEMs"]
            unmapped = stats["total"] - mapped
            summaries["productMapping"]["makeInIndiaMapping"] = {
                "status": stats["miiCompliance"],
                "mapped": mapped,
                "unmapped": unmapped
            }
            
            if summaries.get("technical"):
                summaries["technical"]["totalItems"] = stats["total"]
                summaries["technical"]["keySpecifications"] = [
                    {"productName": p.get("productName", "N/A"), "specification": p.get("specifications", "").strip() or "No specifications mentioned"}
                    for p in enriched_products
                ]

    @staticmethod
    def get_final_analysis(project_id) -> Dict[str, Any]:
        """Produces the merged 'FINAL VISIBLE ANALYSIS'."""
        records = ProjectModel.get_merged_analysis(project_id)
        
        # Rule 1: CORRIGENDUM overrides everything
        # Rule 2: REFERENCE_UPDATE overrides BASE_RFP
        # Rule 3: BASE_RFP is fallback
        
        # We group by section + content (or just section for direct overrides)
        # Actually, if it's a list, we might want to show all.
        # But for "updated" items, we should prioritize.
        
        # For simplicity in this implementation, we will provide a list of all records 
        # but the latest for each section/category pair will be marked or highlighted.
        
        # Let's try to reconstruct a summary object similar to original but with source info.
        merged_summary = {}
        
        # Priority mapping
        priority = {'CORRIGENDUM': 3, 'REFERENCE_UPDATE': 2, 'BASE_RFP': 1}
        
        # Record tracking: section -> list of items (with priority info)
        section_data = {}
        
        for rec in records:
            sec = rec['section']
            if sec not in section_data:
                section_data[sec] = []
            
            # Simple heuristic: if a record from a higher priority source exists in the same section,
            # we might want to replace or append.
            # Tender management usually wants to see the TRACE.
            section_data[sec].append({
                "content": rec['content'],
                "source": rec['source_type'],
                "file": rec['source_file_name'],
                "timestamp": rec['created_at'].isoformat() if hasattr(rec['created_at'], 'isoformat') else str(rec['created_at'])
            })
            
        return {
            "project_id": project_id,
            "merged_analysis": section_data,
            "timestamp": datetime.now().isoformat()
        }
