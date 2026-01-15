from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Body, Request, Form
from fastapi.responses import FileResponse, JSONResponse
import time
import os
import hashlib
import logging
import asyncio
from typing import Optional, List, Dict, Any
import aiofiles
import httpx

from core.config import settings
from services.document_extractor import extract_text
from services.ai_service import generate_departmental_summaries
from services.oem_enrichment_service import enrich_products, get_enrichment_stats
from services.pinecone_service import store_rfp_in_pinecone
from services.project_service import ProjectService
from models.file_cache import FileCache
from models.project import ProjectModel

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/analyze")
async def analyze_rfp(
    files: List[UploadFile] = File(...),
    project_name: Optional[str] = Form(None),
    tender_id: Optional[str] = Form(None),
    client_name: Optional[str] = Form(None),
    update_type: Optional[str] = Form("BASE_RFP")
):
    start_time = time.time()
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")

        # project_name is mandatory for the new project-centric workflow
        if not project_name:
             logger.warning("No project_name provided. Processing as a standalone/generic analysis.")
             # Fallback to original logic if project_name is missing (for backward compatibility if needed)
        
        all_text = []
        all_metadata = []
        combined_content = b""
        filenames = [f.filename for f in files]
        
        logger.info(f"Processing {len(files)} files: {', '.join(filenames)}")
        processed_files_data = []

        for i, file in enumerate(files):
            content = await file.read()
            combined_content += content
            
            # Extract text for each file
            extraction = await extract_text(content, file.content_type, file.filename)
            all_text.append(f"--- DOCUMENT {i+1}: {file.filename} ---\n{extraction['text']}")
            all_metadata.append(extraction["metadata"])
            
            # Store file for viewing
            file_hash = hashlib.sha256(content).hexdigest()
            file_ext = os.path.splitext(file.filename)[1]
            file_path = os.path.join(settings.UPLOAD_DIR, f"{file_hash}{file_ext}")
            if not os.path.exists(file_path):
                async with aiofiles.open(file_path, 'wb') as f:
                    await f.write(content)
            
            processed_files_data.append({
                "filename": file.filename,
                "hash": file_hash,
                "wordCount": extraction["wordCount"],
                "text": extraction["text"]
            })

        # Combined text for AI analysis
        merged_text = "\n\n".join(all_text)
        combined_hash_input = "".join([f["hash"] for f in processed_files_data]).encode()
        combined_hash = hashlib.sha256(combined_hash_input).hexdigest()

        # --- NEW PROJECT-CENTRIC WORKFLOW ---
        if project_name:
            try:
                # ProjectService handles validation, project creation, and incremental analysis
                result_data = await ProjectService.process_project_document(
                    project_name=project_name,
                    tender_id=tender_id,
                    client_name=client_name,
                    update_type=update_type,
                    file_hash=combined_hash,
                    file_name=", ".join(filenames),
                    extracted_text=merged_text
                )
                
                # If everything went well, return the merged analysis
                return {
                    "success": True,
                    "project_centric": True,
                    "update_type": update_type,
                    "data": {
                        "projectName": project_name,
                        "fileHash": combined_hash,
                        "mergedAnalysis": result_data["merged_analysis"],
                        "departmentalSummaries": result_data["departmentalSummaries"],
                        "metadata": {
                            "processingTime": f"{time.time() - start_time:.2f}s",
                            "fileCount": len(files)
                        }
                    }
                }
            except ValueError as ve:
                logger.error(f"Validation error in project logic: {str(ve)}")
                raise HTTPException(status_code=400, detail=str(ve))
            except Exception as pe:
                logger.error(f"Error in project-centric analysis: {str(pe)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Project analysis failed: {str(pe)}")

        # --- ORIGINAL WORKFLOW (FALLBACK) ---
        logger.info(f"Combined hash: {combined_hash[:16]}... | Version: {settings.PROCESSING_VERSION}")

        # Check cache
        cached_result = FileCache.find_by_hash(combined_hash, settings.PROCESSING_VERSION)
        if cached_result:
            processing_time = time.time() - start_time
            logger.info(f"✅ Cache HIT! Returning merged results for {len(files)} files")
            
            departmental_summaries = cached_result["departmental_summaries"]
            # Recalculate stats logic...
            ProjectService._ensure_stats_consistency(departmental_summaries)

            return {
                "success": True,
                "cached": True,
                "data": {
                    "fileName": filenames[0],
                    "allFiles": filenames,
                    "fileHash": combined_hash,
                    "extractedText": cached_result["extracted_text"],
                    "departmentalSummaries": departmental_summaries,
                    "metadata": {
                        "processingTime": f"{processing_time:.2f}s",
                        "fileCount": len(files),
                        "cachedAt": cached_result.get("created_at")
                    }
                }
            }

        logger.info("Cache MISS. Running AI analysis on merged content...")

        # Generate summaries for the merged document content
        ai_result = await generate_departmental_summaries(merged_text, f"Merged RFP ({len(files)} files)")
        summaries = ai_result["summaries"]
        
        # OEM Enrichment and stats calculation...
        await ProjectService._enrich_and_sync_summaries(summaries, filenames)

        processing_time = time.time() - start_time
        
        # Save to cache
        cache_data = {
            "fileHash": combined_hash,
            "processingVersion": settings.PROCESSING_VERSION,
            "originalFilename": ", ".join(filenames),
            "extractedText": merged_text,
            "departmentalSummaries": summaries,
            "metadata": {
                "fileCount": len(files),
                "model": ai_result["model"],
                "usage": ai_result.get("usage"),
                "autoEnriched": True
            }
        }
        FileCache.create(cache_data)
        
        # Store merged document in Pinecone
        try:
            await store_rfp_in_pinecone(
                document_id=combined_hash,
                file_name=f"Merged RFP ({len(files)} files)",
                text=merged_text
            )
        except Exception as pine_err:
            logger.warning(f"Failed to store in Pinecone: {str(pine_err)}")

        return {
            "success": True,
            "cached": False,
            "data": {
                "fileName": filenames[0],
                "allFiles": filenames,
                "fileHash": combined_hash,
                "extractedText": merged_text,
                "departmentalSummaries": summaries,
                "metadata": {
                    "processingTime": f"{processing_time:.2f}s",
                    "fileCount": len(files),
                    "model": ai_result["model"]
                }
            }
        }
    except asyncio.CancelledError:
        # User cancelled the request - handle gracefully
        logger.info("⚠️ RFP analysis cancelled by user")
        raise HTTPException(status_code=499, detail="Analysis cancelled by user")
    except Exception as e:
        error_str = str(e)
        # Check for quota errors and provide helpful message
        if "quota" in error_str.lower() or "insufficient_quota" in error_str.lower():
            logger.error(f"❌ OpenAI quota exceeded: {error_str}")
            raise HTTPException(
                status_code=402, 
                detail="OpenAI API quota exceeded. Please check your billing and plan details at https://platform.openai.com/account/billing"
            )
        logger.error(f"Error analyzing RFP: {error_str}", exc_info=True)
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/enrich-oems")
async def enrich_oems_route(products: List[Dict[str, Any]] = Body(...)):
    try:
        logger.info(f"Enriching {len(products)} products...")
        enriched = await enrich_products(products)
        stats = get_enrichment_stats(enriched)
        
        return {
            "success": True,
            "products": enriched,
            "statistics": stats
        }
    except Exception as e:
        logger.error(f"Error enriching OEMs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects")
async def list_projects():
    try:
        projects = ProjectModel.get_all()
        return {"success": True, "projects": projects}
    except Exception as e:
        logger.error(f"Error listing projects: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve projects: {str(e)}")

@router.get("/project-status/{project_name}")
async def get_project_status(project_name: str):
    from core.database import get_db_connection
    from psycopg2.extras import RealDictCursor
    
    try:
        project = ProjectModel.get_by_name(project_name)
        if project:
            # Also check if it has a base RFP
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(
                "SELECT * FROM project_documents WHERE project_id = %s AND update_type = 'BASE_RFP' ORDER BY created_at DESC LIMIT 1",
                (project['id'],)
            )
            base_doc = cursor.fetchone()
            conn.close()
            
            return {
                "exists": True,
                "project": {
                    "projectName": project["project_name"],
                    "tenderId": project["tender_id"],
                    "clientName": project["client_name"],
                    "hasBaseRfp": base_doc is not None,
                    "baseRfpHash": base_doc["file_hash"] if base_doc else None
                }
            }
        else:
            return {"exists": False}
    except Exception as e:
        logger.error(f"Error checking project status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-project-analysis/{project_name}")
async def get_project_analysis(project_name: str):
    from core.database import get_db_connection
    from psycopg2.extras import RealDictCursor
    
    try:
        project = ProjectModel.get_by_name(project_name)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        # Get the latest analysis from project_documents
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT * FROM project_documents WHERE project_id = %s ORDER BY created_at DESC LIMIT 1",
            (project['id'],)
        )
        latest_doc = cursor.fetchone()
        conn.close()
        
        if not latest_doc:
             raise HTTPException(status_code=404, detail="No analysis found for this project")

        return {
            "success": True,
            "project_centric": True,
            "data": {
                "projectName": project_name,
                "fileHash": latest_doc["file_hash"],
                "departmentalSummaries": latest_doc["analysis_data"],
                "metadata": {
                    "lastUpdated": latest_doc["created_at"].isoformat() if hasattr(latest_doc["created_at"], 'isoformat') else str(latest_doc["created_at"]),
                    "updateType": latest_doc["update_type"]
                }
            }
        }
    except Exception as e:
        logger.error(f"Error getting project analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/document/{file_hash}")
async def get_document(file_hash: str, fileName: Optional[str] = None):
    # Try to find file in upload dir
    possible_files = [f for f in os.listdir(settings.UPLOAD_DIR) if f.startswith(file_hash)]
    if not possible_files:
        raise HTTPException(status_code=404, detail="Document not found")
        
    file_path = os.path.join(settings.UPLOAD_DIR, possible_files[0])
    return FileResponse(file_path, filename=fileName or os.path.basename(file_path))

@router.post("/get-sources")
async def get_sources(query: str = Body(..., embed=True), documentId: str = Body(..., embed=True)):
    try:
        logger.info(f"🔍 Searching for sources: \"{query[:50]}...\" in {documentId}")
        
        chatbot_url = settings.CHATBOT_API_URL or 'http://localhost:8080'
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{chatbot_url}/get-sources",
                    json={"query": query, "documentId": documentId},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Apply the same filtering logic as Node.js
                    raw_sources = data.get("sources", [])
                    # (Simplified filtering for now, keeping top 3)
                    sources = []
                    seen_pages = set()
                    for s in raw_sources:
                        page = s.get("pageNumber") or s.get("page")
                        if page and page not in seen_pages:
                            seen_pages.add(page)
                            sources.append(s)
                            if len(sources) >= 3: break
                            
                    return {
                        "sources": sources,
                        "query": query,
                        "documentId": documentId
                    }
            except Exception as e:
                logger.error(f"Flask proxy failed: {str(e)}")
        
        # Fallback to local Pinecone service
        try:
            from services.pinecone_service import query_rfp_document
            results = await query_rfp_document(documentId, query, k=5)
            sources = []
            for doc in results:
                meta = doc.metadata
                page = meta.get("pageNumber") or meta.get("page")
                if page:
                    sources.append({
                        "pageNumber": str(page),
                        "snippet": doc.page_content,
                        "relevance": 70 # Placeholder
                    })
                if len(sources) >= 3: break
                
            return {
                "sources": sources,
                "query": query,
                "documentId": documentId,
                "fallback": True
            }
        except Exception as e:
            logger.error(f"Pinecone fallback failed: {str(e)}")
                
        # Fallback to empty sources if everything fails
        return {
            "sources": [],
            "query": query,
            "documentId": documentId,
            "message": "Sources unavailable"
        }
    except Exception as e:
        logger.error(f"Error in get_sources: {str(e)}")
        return JSONResponse(content={"sources": [], "error": str(e)}, status_code=200)

@router.get("/health")
async def health_check():
    return {
        "success": True,
        "message": "RFP Analysis API is running (Python)",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
