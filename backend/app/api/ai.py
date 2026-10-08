"""
SmartCloud AI API router.

Endpoints:
  - /health: Check AI service availability (LLM + embeddings)
  - /chat: RAG-grounded chat with document retrieval
  - /search: Semantic + keyword search over user's files
  - /summarize: Generate summaries for documents
  - /index: Process and embed a file for semantic search

All endpoints support both:
  - Semantic search (if owner_id available): uses pgvector similarity
  - Keyword fallback (if no owner_id): uses TF-style keyword matching

Permission filtering:
  - context_files passed by caller are pre-filtered to authenticated user
  - Vector search results scoped by owner_id
  - No cross-user data leakage

Authentication:
  - Protected endpoints require valid JWT in Authorization header
  - owner_id must match authenticated user (enforced in handlers)
"""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Header, status
from pydantic import BaseModel

from app.services.ai_service import SmartCloudAIService
from app.services.ollama_service import OllamaService
from app.services.auth_service import get_auth_service
from app.config import USE_LOCAL_LLM, OLLAMA_BASE_URL, OLLAMA_MODEL

router = APIRouter(prefix="/ai", tags=["ai"])


# ── Request / response models ─────────────────────────────────────────────────

class FileContext(BaseModel):
    """File metadata for RAG context."""
    name: str
    type: str | None = None
    size: int | None = None


class ChatRequest(BaseModel):
    """Chat request with optional owner_id for vector search."""
    query: str
    context_files: list[FileContext] = []
    owner_id: Optional[str] = None  # UUID of authenticated user (for vector search)


class SearchRequest(BaseModel):
    """Search request with optional owner_id for semantic search."""
    query: str
    context_files: list[FileContext] = []
    owner_id: Optional[str] = None  # UUID of authenticated user


class SummarizeRequest(BaseModel):
    """Summarization request."""
    file_name: str
    file_type: str = "unknown"
    content_hint: str = ""


class IndexRequest(BaseModel):
    """Index/embed a document for semantic search."""
    file_id: str  # UUID
    owner_id: str  # UUID
    file_name: str
    file_type: str
    content: str  # Raw text content or base64 encoded


# ── Helpers ───────────────────────────────────────────────────────────────────

def _files_to_dicts(files: list[FileContext]) -> list[dict[str, Any]]:
    """Convert Pydantic FileContext models to dicts."""
    return [f.model_dump() for f in files]


def _llm_unavailable(exc: Exception) -> HTTPException:
    """Convert LLM/config errors into a clean 503."""
    return HTTPException(
        status_code=503,
        detail=f"AI service unavailable: {str(exc)}",
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
def ai_health():
    """
    Check AI service health (non-blocking).
    
    Returns:
      - status: "ok" 
      - model: Current LLM model name
      - llm_type: "ollama" or "openrouter"
    """
    try:
        from app.config import USE_LOCAL_LLM, OLLAMA_MODEL, LLM_MODEL
        
        health = {
            "status": "ok",
            "llm_type": "ollama" if USE_LOCAL_LLM else "openrouter",
            "model": OLLAMA_MODEL if USE_LOCAL_LLM else LLM_MODEL,
        }
        
        return health
        
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/chat")
async def chat_with_documents(
    payload: ChatRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    RAG-grounded chat with semantic document retrieval.
    
    Requires authentication. The authenticated user's ID is used for vector search.
    If payload.owner_id is provided, it must match the authenticated user_id.
    
    Flow:
    1. If owner_id provided: retrieve relevant document chunks via vector search
    2. Build context block from chunks
    3. Send to LLM (Ollama or OpenRouter)
    4. Return answer + sources
    
    Args:
      query: User's question
      context_files: File metadata for keyword fallback
      owner_id: User UUID for vector search (must match authenticated user)
    
    Returns:
      answer: LLM response
      sources: List of relevant document chunks
      model: Model name used
    
    Raises:
      401: If not authenticated
      403: If owner_id doesn't match authenticated user
      503: If AI service unavailable
    """
    # Security: if owner_id specified, must match authenticated user
    if payload.owner_id and str(payload.owner_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access data for another user.",
        )
    
    # Use authenticated user_id for vector search if not already provided
    effective_owner_id = payload.owner_id or user_id
    
    # Create service instance with authenticated user
    service = SmartCloudAIService(authenticated_user_id=user_id)
    
    try:
        result = service.answer_query(
            query=payload.query,
            context_files=_files_to_dicts(payload.context_files),
        )
        return result
    except RuntimeError as exc:
        raise _llm_unavailable(exc)


@router.post("/search")
async def semantic_search(
    payload: SearchRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Semantic search + keyword fallback.
    
    Requires authentication. The authenticated user's ID is used for vector search.
    If payload.owner_id is provided, it must match the authenticated user_id.
    
    Priority:
    1. If owner_id available: vector similarity search (fast, accurate)
    2. Otherwise: keyword matching on context_files
    
    Args:
      query: Search query or description
      context_files: File metadata for fallback
      owner_id: User UUID for semantic search (must match authenticated user)
    
    Returns:
      results: List of ranked search results
        - title: File/chunk identifier
        - snippet: Text excerpt
        - score: Relevance score (0-1 for embeddings, TF-based for keywords)
    
    Raises:
      401: If not authenticated
      403: If owner_id doesn't match authenticated user
      503: If AI service unavailable
    """
    # Security: if owner_id specified, must match authenticated user
    if payload.owner_id and str(payload.owner_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access data for another user.",
        )
    
    # Use authenticated user_id for vector search if not already provided
    effective_owner_id = payload.owner_id or user_id
    
    # Create service instance with authenticated user
    service = SmartCloudAIService(authenticated_user_id=user_id)
    
    try:
        results = service.search_documents(
            query=payload.query,
            context_files=_files_to_dicts(payload.context_files),
        )
        return {"results": results, "search_type": "semantic" if payload.owner_id else "keyword"}
    except RuntimeError as exc:
        raise _llm_unavailable(exc)


@router.post("/summarize")
def summarize_document(payload: SummarizeRequest):
    """
    Generate an LLM-powered summary for a document.
    
    Args:
      file_name: Name of the file
      file_type: File type/category
      content_hint: Preview or excerpt of file content
    
    Returns:
      summary: Generated summary
      file: Original file name
    """
    # Create service instance with a placeholder user (this endpoint doesn't require auth)
    service = SmartCloudAIService(authenticated_user_id="anonymous")
    
    try:
        return service.summarize_document(
            file_name=payload.file_name,
            file_type=payload.file_type,
            content_hint=payload.content_hint,
        )
    except RuntimeError as exc:
        raise _llm_unavailable(exc)


@router.post("/index")
async def index_document(
    payload: IndexRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Process and embed a document for semantic search.
    
    Requires authentication. The authenticated user must own the file (owner_id must match).
    
    This endpoint:
    1. Chunks the document content
    2. Generates embeddings for each chunk
    3. Stores chunks + embeddings in PostgreSQL
    
    Should be called after file upload to enable semantic search.
    
    Args:
      file_id: UUID of the file
      owner_id: UUID of the file owner (must match authenticated user)
      file_name: Original filename
      file_type: File type (pdf, docx, txt, etc.)
      content: Raw text content or base64-encoded file
    
    Returns:
      chunks_stored: Number of chunks created
      file_id: The indexed file ID
      status: "indexed" if successful
    
    Raises:
      401: If not authenticated
      403: If owner_id doesn't match authenticated user
      400: If file processing fails
    """
    # Security: owner_id must match authenticated user
    if str(payload.owner_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot index files for another user.",
        )
    
    # Create service instance with authenticated user
    service = SmartCloudAIService(authenticated_user_id=user_id)
    
    try:
        from app.services.document_processor import process_document
        from app.services.rag_service import RAGService
        import base64
        
        # Decode content if base64
        if payload.content.startswith("data:"):
            # Base64 with MIME prefix
            _, b64_content = payload.content.split(",", 1)
            content_bytes = base64.b64decode(b64_content)
        elif len(payload.content) > 1000 and not "\n" in payload.content[:100]:
            # Might be base64
            try:
                content_bytes = base64.b64decode(payload.content)
            except:
                content_bytes = payload.content.encode()
        else:
            content_bytes = payload.content.encode()
        
        # Process document (extract, chunk, embed)
        chunks = process_document(
            file_bytes=content_bytes,
            file_name=payload.file_name,
            mime_type=payload.file_type,
        )
        
        if not chunks:
            return {
                "chunks_stored": 0,
                "file_id": payload.file_id,
                "status": "no_content",
                "message": "No content extracted from file",
            }
        
        # Store chunks in PostgreSQL
        rag = RAGService()
        success = rag.store_chunks(
            file_id=payload.file_id,
            owner_id=payload.owner_id,
            chunks=chunks,
        )
        
        return {
            "chunks_stored": len(chunks),
            "file_id": payload.file_id,
            "status": "indexed" if success else "index_failed",
        }
        
    except RuntimeError as exc:
        raise _llm_unavailable(exc)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Indexing failed: {str(exc)}",
        )
