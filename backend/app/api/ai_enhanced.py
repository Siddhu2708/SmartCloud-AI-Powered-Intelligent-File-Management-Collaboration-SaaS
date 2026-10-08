"""
SmartCloud AI API Endpoints - Enhanced Version

Provides comprehensive endpoints for:
1. File/Folder Management (FileAccessService)
2. Document Extraction
3. RAG Chat & Search
4. Assignment Management
5. Storage Analytics

All endpoints require JWT authentication.
All operations scoped to authenticated user.

Architecture:
  User Token (JWT)
    ↓
  Authenticated User ID Extracted
    ↓
  SmartCloudAIService initialized with user_id
    ↓
  FileAccessService validates ownership
    ↓
  Operation returns only user's data
    ↓
  Another user cannot access response
"""

from typing import Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel

from app.services.auth_service import get_auth_service, AuthService
from app.services.ai_service import SmartCloudAIService


# ────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ────────────────────────────────────────────────────────────────────────

class FileContext(BaseModel):
    """File metadata for RAG context."""
    id: str
    name: str
    type: Optional[str] = None
    size: Optional[int] = None


class ChatRequest(BaseModel):
    """Chat request with optional file context."""
    query: str
    context_files: Optional[List[FileContext]] = None


class SearchRequest(BaseModel):
    """Search request."""
    query: str
    context_files: Optional[List[FileContext]] = None


class SummarizeRequest(BaseModel):
    """Summarization request."""
    file_name: str
    file_type: str = "unknown"
    content_hint: Optional[str] = None


class AssignmentCreateRequest(BaseModel):
    """Create assignment request."""
    title: str
    description: Optional[str] = None
    file_id: Optional[str] = None
    due_date: Optional[str] = None  # ISO 8601
    priority: str = "medium"
    tags: Optional[List[str]] = None


class AssignmentUpdateRequest(BaseModel):
    """Update assignment request."""
    status: Optional[str] = None
    priority: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None


# ────────────────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────────────────

def _files_to_dicts(files: Optional[List[FileContext]]) -> List[dict[str, Any]]:
    """Convert FileContext list to dicts."""
    if not files:
        return []
    return [
        {"id": f.id, "name": f.name, "type": f.type, "size": f.size}
        for f in files
    ]


def _llm_unavailable(exc: Exception) -> HTTPException:
    """Convert LLM errors to 503."""
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"AI service unavailable: {str(exc)}",
    )


# ────────────────────────────────────────────────────────────────────────
# ROUTER
# ────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/ai", tags=["ai"])


# ════════════════════════════════════════════════════════════════════════
# HEALTH & STATUS
# ════════════════════════════════════════════════════════════════════════

@router.get("/health")
def ai_health():
    """
    Check AI service health.
    
    Returns:
      - status: "ok"
      - llm_type: "ollama" or "openrouter"
      - model: Model name
    """
    try:
        from app.config import USE_LOCAL_LLM, OLLAMA_MODEL, LLM_MODEL
        
        return {
            "status": "ok",
            "llm_type": "ollama" if USE_LOCAL_LLM else "openrouter",
            "model": OLLAMA_MODEL if USE_LOCAL_LLM else LLM_MODEL,
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ════════════════════════════════════════════════════════════════════════
# FILE & FOLDER ACCESS
# ════════════════════════════════════════════════════════════════════════

@router.get("/files")
async def list_user_files(
    folder_id: Optional[str] = None,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    List authenticated user's files.
    
    Args:
      folder_id: Optional folder UUID to list files in
    
    Returns:
      List of file records belonging to authenticated user
    
    Security:
      - Only returns files owned by authenticated user
      - RLS + FileAccessService double-check ownership
    """
    try:
        service = SmartCloudAIService(user_id)
        files = service.get_user_files(folder_id=folder_id)
        return {"files": files, "count": len(files)}
    except Exception as e:
        print(f"[API] List files error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/folders")
async def list_user_folders(
    parent_id: Optional[str] = None,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    List authenticated user's folders.
    
    Args:
      parent_id: Optional parent folder UUID
    
    Returns:
      List of folder records belonging to authenticated user
    """
    try:
        service = SmartCloudAIService(user_id)
        folders = service.get_user_folders(parent_id=parent_id)
        return {"folders": folders, "count": len(folders)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/search")
async def search_files(
    query: str,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Search authenticated user's files by name.
    
    Args:
      query: Search query
    
    Returns:
      List of matching files owned by user
    """
    try:
        service = SmartCloudAIService(user_id)
        results = service.search_user_files(query)
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/folders/{folder_id}/contents")
async def get_folder_contents(
    folder_id: str,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Get contents of a folder (subfolders + files).
    
    Args:
      folder_id: Folder UUID
    
    Returns:
      Folder metadata + subfolders + files
    
    Raises:
      404: Folder not found or not owned by user
    """
    try:
        service = SmartCloudAIService(user_id)
        contents = service.get_folder_contents(folder_id)
        
        if not contents["folder"]:
            raise HTTPException(status_code=404, detail="Folder not found")
        
        return contents
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/folders/{folder_id}/hierarchy")
async def get_folder_breadcrumb(
    folder_id: str,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Get breadcrumb path from root to folder.
    
    Example: [Root, AI Projects, ML Folder, Current]
    
    Args:
      folder_id: Folder UUID
    
    Returns:
      List of folder records from root to target
    """
    try:
        service = SmartCloudAIService(user_id)
        path = service.get_folder_hierarchy(folder_id)
        return {"path": path, "depth": len(path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage-stats")
async def get_storage_stats(
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Get user's storage usage statistics.
    
    Returns:
      - total_files: Number of files
      - total_folders: Number of folders
      - total_size_bytes: Total storage used
      - file_count_by_type: Dict of type -> count
    """
    try:
        service = SmartCloudAIService(user_id)
        stats = service.get_storage_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════════════════
# RAG CHAT & SEARCH
# ════════════════════════════════════════════════════════════════════════

@router.post("/chat")
async def chat_with_documents(
    payload: ChatRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    RAG-grounded chat with authenticated user's documents.
    
    RAG Flow:
      1. Vector similarity search (scoped to user_id)
      2. Build context from top chunks
      3. Send to LLM with context
      4. Return answer + sources
    
    Args:
      query: User's question
      context_files: Optional file metadata for fallback
    
    Returns:
      answer: LLM response
      sources: Relevant files/chunks with metadata
      model: Model name used
    
    Security:
      - Only retrieves user's documents
      - Vector search filtered by user_id
      - LLM context contains only user's data
    """
    try:
        service = SmartCloudAIService(user_id)
        context_dicts = _files_to_dicts(payload.context_files)
        
        result = service.answer_query(
            query=payload.query,
            context_files=context_dicts,
        )
        
        return {
            "answer": result["answer"],
            "sources": result["sources"],
            "model": result["model"],
        }
    
    except RuntimeError as e:
        raise _llm_unavailable(e)
    except Exception as e:
        print(f"[API] Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def semantic_search(
    payload: SearchRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Semantic search over authenticated user's documents.
    
    Supports:
      - Vector similarity search (if embeddings available)
      - Keyword fallback
    
    Args:
      query: Search query
      context_files: Optional file metadata for fallback
    
    Returns:
      results: List of matching documents/chunks
      search_type: "semantic" or "keyword"
    
    Security:
      - Results scoped to authenticated user
      - Only user's documents searched
    """
    try:
        service = SmartCloudAIService(user_id)
        context_dicts = _files_to_dicts(payload.context_files)
        
        results = service.search_documents(
            query=payload.query,
            context_files=context_dicts,
        )
        
        return {
            "results": results,
            "count": len(results),
            "search_type": "semantic",
        }
    
    except RuntimeError as e:
        raise _llm_unavailable(e)
    except Exception as e:
        print(f"[API] Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summarize")
def summarize_document(
    payload: SummarizeRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Generate summary for a document.
    
    Args:
      file_name: Filename
      file_type: File type (pdf, docx, etc)
      content_hint: Preview of content
    
    Returns:
      summary: Generated summary
      file: Filename
    """
    try:
        service = SmartCloudAIService(user_id)
        result = service.summarize_document(
            file_name=payload.file_name,
            file_type=payload.file_type,
            content_hint=payload.content_hint or "",
        )
        return result
    
    except RuntimeError as e:
        raise _llm_unavailable(e)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════════════════
# ASSIGNMENTS / TASKS
# ════════════════════════════════════════════════════════════════════════

@router.post("/assignments")
async def create_assignment(
    payload: AssignmentCreateRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Create a new assignment.
    
    Args:
      title: Assignment title
      description: Description
      file_id: Optional associated file UUID
      due_date: Due date (ISO 8601)
      priority: "low", "medium", "high", "urgent"
      tags: Optional tags
    
    Returns:
      Assignment record with id, created_at, etc.
    
    Security:
      - Assignment owned by authenticated user
      - Can only reference user's own files
    """
    try:
        service = SmartCloudAIService(user_id)
        assignment = service.create_assignment(
            title=payload.title,
            description=payload.description,
            file_id=payload.file_id,
            due_date=payload.due_date,
            priority=payload.priority,
            tags=payload.tags,
        )
        
        if not assignment:
            raise HTTPException(status_code=400, detail="Failed to create assignment")
        
        return assignment
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assignments")
async def list_assignments(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    file_id: Optional[str] = None,
    include_completed: bool = True,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    List authenticated user's assignments.
    
    Args:
      status: Filter by status
      priority: Filter by priority
      file_id: Filter by associated file
      include_completed: Include completed assignments
    
    Returns:
      List of assignment records
    """
    try:
        service = SmartCloudAIService(user_id)
        assignments = service.list_assignments(
            status=status,
            priority=priority,
            file_id=file_id,
            include_completed=include_completed,
        )
        return {"assignments": assignments, "count": len(assignments)}
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assignments/due-soon")
async def get_assignments_due_soon(
    days: int = 7,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Get assignments due within N days.
    
    Args:
      days: Number of days to look ahead
    
    Returns:
      List of assignments due soon
    """
    try:
        service = SmartCloudAIService(user_id)
        assignments = service.get_assignments_due_soon(days=days)
        return {"assignments": assignments, "count": len(assignments)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assignments/stats")
async def get_assignment_stats(
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Get assignment statistics.
    
    Returns:
      - total_assignments
      - completed_count
      - pending_count
      - overdue_count
      - status_breakdown
      - priority_breakdown
    """
    try:
        service = SmartCloudAIService(user_id)
        stats = service.get_assignment_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/assignments/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    payload: AssignmentUpdateRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Update an assignment.
    
    Args:
      assignment_id: Assignment UUID
      payload: Fields to update
    
    Returns:
      Updated assignment record
    
    Raises:
      404: Assignment not found or not owned by user
    """
    try:
        service = SmartCloudAIService(user_id)
        
        # Update status if provided
        if payload.status:
            assignment = service.update_assignment_status(assignment_id, payload.status)
            if not assignment:
                raise HTTPException(status_code=404, detail="Assignment not found")
            return assignment
        
        # Otherwise update other fields
        updates = {
            "title": payload.title,
            "description": payload.description,
            "due_date": payload.due_date,
            "priority": payload.priority,
            "tags": payload.tags,
        }
        updates = {k: v for k, v in updates.items() if v is not None}
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        assignment = service._assignment_service.update_assignment(assignment_id, **updates)
        
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        return assignment
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/assignments/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Delete an assignment.
    
    Args:
      assignment_id: Assignment UUID
    
    Returns:
      Success message
    
    Raises:
      404: Assignment not found or not owned by user
    """
    try:
        service = SmartCloudAIService(user_id)
        success = service._assignment_service.delete_assignment(assignment_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        return {"message": "Assignment deleted"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
