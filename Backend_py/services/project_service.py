import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from models.project import ProjectModel
from services.ai_service import generate_departmental_summaries

logger = logging.getLogger(__name__)

class ProjectService:
    @staticmethod
    async def process_project_document(
        project_name: str,
        tender_id: str,
        client_name: str,
        update_type: str,
        file_hash: str,
        file_name: str,
        extracted_text: str
    ) -> Dict[str, Any]:
        # 1. Check if project exists
        project = ProjectModel.get_by_name(project_name)
        
        previous_analysis = None
        if not project:
            if update_type != 'BASE_RFP':
                raise ValueError(f"Project '{project_name}' does not exist. First upload must be BASE_RFP.")
            
            project_id = ProjectModel.create(project_name, tender_id, client_name)
            if not project_id:
                raise ValueError("Failed to create new project.")
            logger.info(f"✨ Created NEW PROJECT: {project_name} (ID: {project_id})")
        else:
            project_id = project['id']
            if update_type == 'BASE_RFP':
                 raise ValueError(f"Project '{project_name}' already has a BASE_RFP. Use CORRIGENDUM or REFERENCE_UPDATE.")
            
            # Fetch latest document's analysis to merge with
            from core.database import get_db_connection
            from psycopg2.extras import RealDictCursor
            conn = get_db_connection()
            if conn:
                try:
                    cursor = conn.cursor(cursor_factory=RealDictCursor)
                    cursor.execute(
                        "SELECT analysis_data FROM project_documents WHERE project_id = %s ORDER BY created_at DESC LIMIT 1",
                        (project_id,)
                    )
                    row = cursor.fetchone()
                    if row and row['analysis_data']:
                        previous_analysis = row['analysis_data']
                        logger.info(f"🔄 Found previous analysis for project {project_id} to merge with.")
                finally:
                    conn.close()

            logger.info(f"📁 Adding to EXISTING PROJECT: {project_name} (ID: {project_id}, Type: {update_type})")

        # 2. Extract structured data using AI
        ai_result = await generate_departmental_summaries(extracted_text, file_name)
        new_summaries = ai_result['summaries']
        
        # 3. Merge with previous analysis if it exists
        if previous_analysis:
            from services.ai_service import naive_merge_summaries
            logger.info(f"⚖️ Merging NEW {update_type} with existing project baseline...")
            # We want new corrigendum to override previous RFP/Update
            merged_summaries = naive_merge_summaries([previous_analysis, new_summaries])
        else:
            merged_summaries = new_summaries

        # Perform OEM Enrichment on the merged result
        await ProjectService._enrich_and_sync_summaries(merged_summaries, [file_name])

        # 4. Store document
        doc_id = ProjectModel.add_document(
            project_id, file_hash, file_name, update_type, extracted_text, merged_summaries
        )
        
        # 5. Store granular records for audit trace
        ProjectService._store_granular_records(project_id, doc_id, update_type, file_name, file_hash, new_summaries)
        
        # 6. Return both merged analysis and auditable trace
        final_data = ProjectService.get_final_analysis(project_id)
        final_data['departmentalSummaries'] = merged_summaries
        return final_data

    @staticmethod
    def _store_granular_records(project_id: int, doc_id: int, source_type: str, file_name: str, file_hash: str, summaries: Dict[str, Any]):
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
        
        if (summaries.get("productMapping") and 
            summaries["productMapping"].get("miiProductStatus")):
            products = summaries["productMapping"]["miiProductStatus"]
            valid_products = [p for p in products if p.get("productName") and p.get("productName").strip() not in ["", "N/A", "n/a"]]
            
            enriched_products = await enrich_products(valid_products)
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
    def get_final_analysis(project_id: int) -> Dict[str, Any]:
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
