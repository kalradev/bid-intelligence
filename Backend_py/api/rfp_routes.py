from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Body, Request, Form, Depends, Query
from fastapi.responses import FileResponse, JSONResponse
import time
import os
import hashlib
import logging
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime
import aiofiles
import httpx

from core.config import settings
from core.sqlalchemy_db import get_db
from sqlalchemy.orm import Session
from sqlalchemy import func
from services.document_extractor import extract_text
from services.ai_service import generate_departmental_summaries
from services.oem_enrichment_service import enrich_products, get_enrichment_stats
from services.project_service import ProjectService
from models.file_cache import FileCache
from models.project import ProjectModel
from models.eligibility_checklist import EligibilityChecklistModel
from api.auth_routes import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/analyze")
async def analyze_rfp(
    files: List[UploadFile] = File(...),
    project_name: Optional[str] = Form(None),
    tender_id: Optional[str] = Form(None),
    client_name: Optional[str] = Form(None),
    update_type: Optional[str] = Form("BASE_RFP"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
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
                from services.role_quota_service import ROLE_TECHNICAL_MANAGER
                role = (current_user.get("role") or "").lower()
                # Check if project exists first
                existing_project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)

                if not existing_project:
                    # Creating a new project: only Bid Manager or Admin
                    if role == ROLE_TECHNICAL_MANAGER:
                        raise HTTPException(
                            status_code=403,
                            detail="Technical Managers cannot create new projects. Only Bid Managers can create and assign projects."
                        )
                    from services.role_quota_service import can_create_project
                    allowed, err_msg = can_create_project(current_user, db=db)
                    if not allowed:
                        raise HTTPException(status_code=403, detail=err_msg)
                    logger.info(f"✅ Quota check passed for new project: {project_name}")
                else:
                    logger.info(f"📁 Updating existing project: {project_name} (skipping quota check)")
                    # Technical Managers may only add corrigendum or reference documents
                    if role == ROLE_TECHNICAL_MANAGER:
                        allowed_types = ("CORRIGENDUM", "REFERENCE_UPDATE")
                        if (update_type or "").upper() not in allowed_types:
                            raise HTTPException(
                                status_code=403,
                                detail=f"Technical Managers can only upload corrigendum or reference documents. Allowed types: {', '.join(allowed_types)}."
                            )
                # ProjectService handles validation, project creation, and incremental analysis
                result_data = await ProjectService.process_project_document(
                    project_name=project_name,
                    tender_id=tender_id,
                    client_name=client_name,
                    update_type=update_type,
                    file_hash=combined_hash,
                    file_name=", ".join(filenames),
                    extracted_text=merged_text,
                    user_id=current_user["id"]
                )
                
                # Get the document ID that was just created
                from core.sqlalchemy_db import get_db_session
                from models.sqlalchemy_models import ProjectDocument
                doc_id = None
                db = get_db_session()
                try:
                    project_id = result_data.get("project_id")
                    if not project_id:
                        # Try to get project_id from project name
                        from models.sqlalchemy_models import Project
                        project = db.query(Project).filter(
                            Project.project_name == project_name,
                            Project.user_id == current_user["id"]
                        ).first()
                        if project:
                            project_id = project.id
                    
                    if project_id:
                        doc = db.query(ProjectDocument).filter(
                            ProjectDocument.project_id == project_id,
                            ProjectDocument.file_hash == combined_hash
                        ).order_by(ProjectDocument.created_at.desc()).first()
                        if doc:
                            doc_id = doc.id
                            logger.info(f"✅ Found document ID: {doc_id} for project {project_name}")
                    else:
                        logger.warning("Could not determine project_id for document lookup")
                except Exception as e:
                    logger.error(f"Error fetching document ID: {str(e)}")
                finally:
                    db.close()
                
                # Debug: Log product mapping in response
                pm = result_data["departmentalSummaries"].get("productMapping", {})
                product_count = len(pm.get("miiProductStatus", []))
                logger.info(f"📦 Returning analysis with {product_count} products in productMapping")
                
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
                            "fileCount": len(files),
                            "documentId": doc_id,
                            "updateType": update_type,
                            "fileName": ", ".join(filenames),
                            "lastUpdated": datetime.now().isoformat() if 'datetime' in dir() else time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
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
async def list_projects(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        from services.role_quota_service import get_team_quota
        from models.sqlalchemy_models import User
        from models.project_assignment import ProjectAssignmentModel
        projects = ProjectModel.get_all_visible_projects(current_user)
        role = (current_user.get("role") or "").lower()
        for p in projects:
            p["assigned_user_ids"] = []
            p["assigned_users"] = []
        if projects:
            try:
                all_assigned_ids = {}
                for p in projects:
                    try:
                        aids = ProjectAssignmentModel.get_assigned_user_ids(p["id"])
                        all_assigned_ids[p["id"]] = aids
                    except Exception as e:
                        logger.warning(f"get_assigned_user_ids project_id={p['id']}: {e}")
                        all_assigned_ids[p["id"]] = []
                unique_user_ids = list({uid for aids in all_assigned_ids.values() for uid in aids})
                users_by_id = {}
                if unique_user_ids:
                    users = db.query(User).filter(User.id.in_(unique_user_ids)).all()
                    users_by_id = {u.id: {"id": u.id, "fullName": u.full_name, "email": u.email, "role": u.role or "technical_manager"} for u in users}
                for p in projects:
                    aids = all_assigned_ids.get(p["id"], [])
                    p["assigned_user_ids"] = aids
                    p["assigned_users"] = [users_by_id[uid] for uid in aids if uid in users_by_id]
            except Exception as e:
                logger.warning(f"Attaching assigned_users to projects: {e}")
        if role == "technical_manager" and projects:
            owner_ids = list({p["user_id"] for p in projects if p.get("user_id")})
            if owner_ids:
                users = db.query(User).filter(User.id.in_(owner_ids)).all()
                owner_names = {u.id: u.full_name for u in users}
                for p in projects:
                    p["assigned_by_full_name"] = owner_names.get(p["user_id"]) if p.get("user_id") else None
            else:
                for p in projects:
                    p["assigned_by_full_name"] = None
        quota = get_team_quota(current_user, db=db)
        return {"success": True, "projects": projects, "teamQuota": quota}
    except Exception as e:
        logger.error(f"Error listing projects: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve projects: {str(e)}")


@router.get("/projects/archived")
async def list_archived_projects(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List archived projects. Bid Admin only."""
    from services.role_quota_service import ROLE_BID_ADMIN
    from models.sqlalchemy_models import Project, User
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can view archived projects")
    projects = db.query(Project).filter(Project.archived.is_(True)).order_by(Project.project_name).all()
    user_ids = list({p.user_id for p in projects if p.user_id})
    users_by_id = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_by_id = {u.id: {"id": u.id, "full_name": u.full_name, "email": u.email} for u in users}
    out = []
    for p in projects:
        out.append({
            "id": p.id,
            "project_name": p.project_name,
            "tender_id": p.tender_id,
            "client_name": p.client_name,
            "user_id": p.user_id,
            "created_at": p.created_at,
            "archived": True,
            "owner": users_by_id.get(p.user_id) if p.user_id else None,
        })
    return {"success": True, "projects": out}


@router.post("/projects/{project_id}/archive")
async def archive_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set project as archived. Bid Admin only. No quota change."""
    from services.role_quota_service import ROLE_BID_ADMIN
    from models.sqlalchemy_models import Project
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can archive projects")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.archived:
        return {"success": True, "message": "Project already archived"}
    project.archived = True
    db.commit()
    logger.info(f"Project {project_id} ({project.project_name}) archived by {current_user.get('email')}")
    return {"success": True, "message": "Project archived"}


@router.post("/projects/{project_id}/unarchive")
async def unarchive_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore project from archive. Do NOT touch org_quota or quota_transactions.
    Quota left = limit - used; unarchiving increases 'used' by 1 so quota left decreases by 1.
    Added by recharge stays unchanged. Bid Admin only."""
    from services.role_quota_service import ROLE_BID_ADMIN
    from models.sqlalchemy_models import Project
    from core.sqlalchemy_db import engine
    from sqlalchemy import text
    role = (current_user.get("role") or "").lower()
    if role != ROLE_BID_ADMIN:
        raise HTTPException(status_code=403, detail="Only Bid Admin can unarchive projects")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.archived:
        u, lim, lef = _get_org_quota_after_unarchive()
        return {"success": True, "message": "Project is not archived", "orgQuota": {"teamProjectsUsed": u, "teamProjectsLimit": lim, "teamProjectsLeft": lef}}
    project_name = project.project_name
    # 1) Persist unarchive and read quota in the same connection so we see the updated row
    with engine.connect() as conn:
        stmt = text("UPDATE projects SET archived = false WHERE id = :id").bindparams(id=project_id)
        r = conn.execute(stmt)
        conn.commit()
        if r.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")
        # 2) Read quota in same connection so "used" includes the unarchived project
        used_row = conn.execute(text("SELECT COUNT(*) FROM projects WHERE COALESCE(archived, false) = false")).fetchone()
        used = int(used_row[0]) if used_row else 0
        limit_row = conn.execute(text("SELECT COALESCE(base_limit, 10) + COALESCE(purchased_quota, 0) FROM org_quota WHERE id = 1")).fetchone()
        limit = int(limit_row[0]) if limit_row else 10
        left = max(0, limit - used)
    # 3) Sync ORM session
    project.archived = False
    db.commit()
    logger.info(f"Project {project_id} ({project_name}) unarchived by {current_user.get('email')}; quota left={left} (used={used}, limit={limit})")
    return {
        "success": True,
        "message": "Project unarchived; quota left decreased by 1",
        "orgQuota": {"teamProjectsUsed": used, "teamProjectsLimit": limit, "teamProjectsLeft": left},
    }


def _get_org_quota_after_unarchive():
    """Return (used, limit, left) with a fresh connection so unarchived project is counted. Used by unarchive response."""
    from core.sqlalchemy_db import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        # Count non-archived (COALESCE so NULL counts as active)
        used_row = conn.execute(text("SELECT COUNT(*) FROM projects WHERE COALESCE(archived, false) = false")).fetchone()
        used = int(used_row[0]) if used_row else 0
        # Limit = base + purchased from org_quota
        limit_row = conn.execute(text(
            "SELECT COALESCE(base_limit, 10) + COALESCE(purchased_quota, 0) FROM org_quota WHERE id = 1"
        )).fetchone()
        limit = int(limit_row[0]) if limit_row else 10
    left = max(0, limit - used)
    return used, limit, left


def _can_manage_assignments(current_user: dict) -> bool:
    """Only Bid Manager and Bid Admin can assign TMs to projects."""
    role = (current_user.get("role") or "").lower()
    return role in ("bid_admin", "bid_manager")


@router.get("/team-member-assignments")
async def get_team_member_assignments(
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """For Bid Manager or Bid Admin: list all Technical Managers with their assigned projects (BMs see all TMs to choose for projects)."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    role_raw = (current_user.get("role") or "").strip().lower()
    role = role_raw.replace(" ", "_")  # e.g. "bid manager" -> "bid_manager"
    if role not in ("bid_manager", "bid_admin"):
        raise HTTPException(status_code=403, detail="Only Bid Manager or Bid Admin can view team member assignments")
    from services.role_quota_service import ROLE_TECHNICAL_MANAGER, ROLE_BID_ADMIN
    from models.project_assignment import ProjectAssignmentModel
    from models.sqlalchemy_models import User
    # Both Bid Manager and Bid Admin see all Technical Managers (BM chooses which TM to assign to projects)
    team = [
        {"id": u.id, "fullName": u.full_name, "email": u.email, "role": u.role or ROLE_TECHNICAL_MANAGER}
        for u in db.query(User).filter(User.role == ROLE_TECHNICAL_MANAGER).order_by(User.full_name).all()
    ]
    if not team:
        return {"success": True, "teamMembers": []}
    out = []
    for tm in team:
        tm_id = tm.get("id")
        if tm_id is None:
            tm_id = tm.get("userId")
        if tm_id is None:
            continue
        project_ids = ProjectAssignmentModel.get_assigned_project_ids(int(tm_id))
        projects = ProjectModel.get_all_by_project_ids(project_ids) if project_ids else []
        full_name = tm.get("fullName") or tm.get("full_name") or ""
        out.append({
            "id": int(tm_id),
            "fullName": full_name,
            "email": tm.get("email") or "",
            "role": tm.get("role") or "technical_manager",
            "assignedProjects": [{"id": p["id"], "project_name": p["project_name"], "tender_id": p.get("tender_id"), "client_name": p.get("client_name")} for p in projects],
        })
    logger.info(f"team-member-assignments: current_user_id={current_user.get('id')} role={role} team_count={len(team)} out_count={len(out)}")
    return {"success": True, "teamMembers": out}


@router.get("/assignable-users")
async def get_assignable_users(
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Users that can be assigned to projects: Bid Manager sees all TMs; Bid Admin sees all BMs + all TMs."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    role = (current_user.get("role") or "").strip().lower().replace(" ", "_")
    if role not in ("bid_manager", "bid_admin"):
        raise HTTPException(status_code=403, detail="Only Bid Manager or Bid Admin can view assignable users")
    from services.role_quota_service import ROLE_TECHNICAL_MANAGER, ROLE_BID_MANAGER
    from models.sqlalchemy_models import User
    # Case-insensitive role match (DB may store "Bid Manager" or "bid_manager")
    if role == "bid_admin":
        bms = db.query(User).filter(func.lower(User.role) == ROLE_BID_MANAGER).order_by(User.full_name).all()
        tms = db.query(User).filter(func.lower(User.role) == ROLE_TECHNICAL_MANAGER).order_by(User.full_name).all()
        users = [
            {"id": u.id, "fullName": u.full_name, "email": u.email, "role": u.role or ROLE_BID_MANAGER}
            for u in bms
        ] + [
            {"id": u.id, "fullName": u.full_name, "email": u.email, "role": u.role or ROLE_TECHNICAL_MANAGER}
            for u in tms
        ]
    else:
        tms = db.query(User).filter(func.lower(User.role) == ROLE_TECHNICAL_MANAGER).order_by(User.full_name).all()
        users = [{"id": u.id, "fullName": u.full_name, "email": u.email, "role": u.role or ROLE_TECHNICAL_MANAGER} for u in tms]
    return {"success": True, "users": users}


@router.get("/project-assignments/{project_name}")
async def get_project_assignments(
    project_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get list of users assigned to this project. Only BM/Admin, and only for visible projects."""
    if not _can_manage_assignments(current_user):
        raise HTTPException(status_code=403, detail="Only Bid Manager or Admin can view project assignments")
    project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    from models.project_assignment import ProjectAssignmentModel
    from models.sqlalchemy_models import User
    assigned_ids = ProjectAssignmentModel.get_assigned_user_ids(project["id"])
    if not assigned_ids:
        return {"success": True, "projectName": project_name, "assignedUserIds": [], "assignedUsers": []}
    users = db.query(User).filter(User.id.in_(assigned_ids)).all()
    assigned_users = [{"id": u.id, "fullName": u.full_name, "email": u.email, "role": u.role or "technical_manager"} for u in users]
    return {"success": True, "projectName": project_name, "assignedUserIds": assigned_ids, "assignedUsers": assigned_users}


@router.post("/project-assignments/{project_name}")
async def set_project_assignments(
    project_name: str,
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set which users (Bid Managers or Technical Managers) are assigned to this project. Only BM/Admin."""
    if not _can_manage_assignments(current_user):
        raise HTTPException(status_code=403, detail="Only Bid Manager or Admin can assign users to projects")
    project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    raw_ids = body.get("userIds") or body.get("user_ids") or []
    try:
        userIds = [int(uid) for uid in raw_ids]
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="userIds must be a list of user ids")
    from models.project_assignment import ProjectAssignmentModel
    from services.role_quota_service import ROLE_TECHNICAL_MANAGER, ROLE_BID_MANAGER
    from models.sqlalchemy_models import User
    role = (current_user.get("role") or "").lower()
    if role == "bid_manager":
        # Bid Manager can assign any Technical Manager to their project (not restricted to "their" TMs)
        allowed = set(
            r[0] for r in db.query(User.id).filter(
                User.id.in_(userIds), User.role == ROLE_TECHNICAL_MANAGER
            ).all()
        )
        userIds = [u for u in userIds if u in allowed]
    else:
        # Bid Admin can assign any Bid Manager or Technical Manager to the project
        allowed = set(
            r[0] for r in db.query(User.id).filter(
                User.id.in_(userIds), User.role.in_([ROLE_TECHNICAL_MANAGER, ROLE_BID_MANAGER])
            ).all()
        )
        userIds = [u for u in userIds if u in allowed]
    project_id = project["id"]
    ok = ProjectAssignmentModel.set_assignments(project_id, userIds)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save assignments")
    # Verify and return persisted state (so TM will see these projects)
    verified = ProjectAssignmentModel.get_assigned_user_ids(project_id)
    logger.info(f"Assign TMs: project_name={project_name!r} project_id={project_id} requested={userIds} verified={verified}")
    return {"success": True, "projectName": project_name, "assignedUserIds": verified}


@router.get("/project-status/{project_name}")
async def get_project_status(project_name: str, current_user: dict = Depends(get_current_user)):
    from core.sqlalchemy_db import get_db_session
    from models.sqlalchemy_models import ProjectDocument

    try:
        project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)
        if project:
            # Also check if it has a base RFP
            db = get_db_session()
            try:
                base_doc = db.query(ProjectDocument).filter(
                    ProjectDocument.project_id == project['id'],
                    ProjectDocument.update_type == "BASE_RFP"
                ).order_by(ProjectDocument.created_at.desc()).first()
            finally:
                db.close()
            
            return {
                "exists": True,
                "project": {
                    "projectName": project["project_name"],
                    "tenderId": project["tender_id"],
                    "clientName": project["client_name"],
                    "hasBaseRfp": base_doc is not None,
                    "baseRfpHash": base_doc.file_hash if base_doc else None
                }
            }
        else:
            return {"exists": False}
    except Exception as e:
        logger.error(f"Error checking project status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-project-analysis/{project_name}")
async def get_project_analysis(
    project_name: str, 
    document_type: Optional[str] = Query(None),
    document_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Get project analysis. 
    - If document_type is provided: returns specific document type (BASE_RFP, CORRIGENDUM, REFERENCE_UPDATE)
    - If document_id is provided: returns specific document by ID
    - Otherwise: returns latest merged analysis (default behavior)
    """
    from core.sqlalchemy_db import get_db_session
    from models.sqlalchemy_models import ProjectDocument
    
    try:
        project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        db = get_db_session()
        try:
            # Get specific document by ID if provided
            if document_id:
                doc = db.query(ProjectDocument).filter(
                    ProjectDocument.id == int(document_id),
                    ProjectDocument.project_id == project['id']
                ).first()
            # Get specific document type if provided
            elif document_type:
                doc = db.query(ProjectDocument).filter(
                    ProjectDocument.project_id == project['id'],
                    ProjectDocument.update_type == document_type
                ).order_by(ProjectDocument.created_at.desc()).first()
            # Otherwise get latest (merged) analysis
            else:
                doc = db.query(ProjectDocument).filter(
                    ProjectDocument.project_id == project['id']
                ).order_by(ProjectDocument.created_at.desc()).first()
            
            if not doc:
                if document_type or document_id:
                    raise HTTPException(status_code=404, detail=f"Document not found for the specified criteria")
                raise HTTPException(status_code=404, detail="No analysis found for this project")
            
            return {
                "success": True,
                "project_centric": True,
                "data": {
                    "projectName": project_name,
                    "fileHash": doc.file_hash,
                    "departmentalSummaries": doc.analysis_data or {},
                    "metadata": {
                        "lastUpdated": doc.created_at.isoformat() if doc.created_at else None,
                        "updateType": doc.update_type,
                        "documentId": doc.id,
                        "fileName": doc.file_name
                    }
                }
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-project-documents/{project_name}")
async def get_project_documents(project_name: str, current_user: dict = Depends(get_current_user)):
    """Get list of all documents for a project with their types and metadata"""
    try:
        project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        from core.sqlalchemy_db import get_db_session
        from models.sqlalchemy_models import ProjectDocument
        
        db = get_db_session()
        try:
            # Get all documents
            documents_raw = db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project['id']
            ).all()
            
            # Sort by update_type priority and created_at
            type_priority = {'BASE_RFP': 1, 'REFERENCE_UPDATE': 2, 'CORRIGENDUM': 3}
            documents = sorted(
                documents_raw,
                key=lambda x: (
                    type_priority.get(x.update_type or '', 99),
                    x.created_at or datetime.min
                )
            )
            
            # Group documents by type and number them
            documents_by_type = {}
            result = []
            
            for doc in documents:
                doc_type = doc.update_type
                if doc_type not in documents_by_type:
                    documents_by_type[doc_type] = 0
                documents_by_type[doc_type] += 1
                
                # Create display name
                if doc_type == 'BASE_RFP':
                    display_name = "Base RFP"
                elif doc_type == 'CORRIGENDUM':
                    display_name = f"Corrigendum {documents_by_type[doc_type]}"
                elif doc_type == 'REFERENCE_UPDATE':
                    display_name = f"Reference Update {documents_by_type[doc_type]}"
                else:
                    display_name = doc_type or "Unknown"
                
                result.append({
                    "id": doc.id,
                    "fileHash": doc.file_hash,
                    "fileName": doc.file_name,
                    "updateType": doc_type,
                    "displayName": display_name,
                    "createdAt": doc.created_at.isoformat() if doc.created_at else None
                })
        finally:
            db.close()
        
        return {
            "success": True,
            "projectName": project_name,
            "documents": result,
            "totalDocuments": len(result)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project documents: {str(e)}")
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
        
        chatbot_url = settings.CHATBOT_API_URL or 'http://127.0.0.1:8080'
        
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
        
        # Return empty sources if proxy fails
        return {
            "sources": [],
            "query": query,
            "documentId": documentId,
            "message": "Sources unavailable"
        }
    except Exception as e:
        logger.error(f"Error in get_sources: {str(e)}")
        return JSONResponse(content={"sources": [], "error": str(e)}, status_code=200)

@router.get("/eligibility-checklist/{project_name}")
async def get_eligibility_checklist(
    project_name: str,
    document_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get eligibility checklist for a project/document"""
    try:
        project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_id = project["id"]
        user_id = current_user["id"]
        
        # Get checklist from database
        checklist = EligibilityChecklistModel.get_by_project_and_document(
            project_id, document_id, user_id
        )
        
        return {
            "success": True,
            "checklist": checklist,
            "project_id": project_id,
            "document_id": document_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting eligibility checklist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/eligibility-checklist/{project_name}")
async def save_eligibility_checklist(
    project_name: str,
    request_body: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Save eligibility checklist for a project/document"""
    try:
        # Extract checklist and document_id from request body
        checklist = request_body.get("checklist", {})
        document_id = request_body.get("document_id")
        
        logger.info(f"📥 Saving checklist for project: {project_name}, document: {document_id}")
        logger.info(f"📋 Checklist data: {checklist}")
        
        project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_id = project["id"]
        user_id = current_user["id"]
        
        # Save checklist to database
        from models.eligibility_checklist import EligibilityChecklistModel
        success = EligibilityChecklistModel.save_checklist(
            project_id, document_id, user_id, checklist
        )
        
        if success:
            logger.info(f"✅ Checklist saved successfully for project {project_name}")
            return {
                "success": True,
                "message": "Eligibility checklist saved successfully",
                "project_id": project_id,
                "document_id": document_id
            }
        else:
            # Try to get the last error from some shared state or just return a generic one with more info if possible
            # For now, since save_checklist returns False on any exception, we rely on the Exception block below
            raise Exception("save_checklist returned False")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving eligibility checklist: {str(e)}")
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to save eligibility checklist", "error": str(e), "traceback": error_detail}
        )

@router.patch("/eligibility-checklist/{project_name}/item")
async def update_eligibility_item(
    project_name: str,
    criteria_text: str = Body(...),
    is_checked: bool = Body(...),
    document_id: Optional[str] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """Update a single eligibility checklist item"""
    try:
        project = ProjectModel.get_by_name_if_visible(project_name, current_user=current_user)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_id = project["id"]
        user_id = current_user["id"]
        
        # Update item in database
        success = EligibilityChecklistModel.update_item(
            project_id, document_id, user_id, criteria_text, is_checked
        )
        
        if success:
            return {
                "success": True,
                "message": "Eligibility checklist item updated successfully",
                "criteria_text": criteria_text,
                "is_checked": is_checked
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update eligibility checklist item")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating eligibility checklist item: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    return {
        "success": True,
        "message": "RFP Analysis API is running (Python)",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
