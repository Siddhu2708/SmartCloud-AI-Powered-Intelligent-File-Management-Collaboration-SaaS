"""
SmartCloud AI Service - Enhanced with Secure File Access & Assignments

PRIMARY: Local Ollama for privacy and cost
FALLBACK: OpenRouter (OpenAI-compatible endpoint) if Ollama unavailable

Key Features:
  - Authenticated user file/folder access (FileAccessService)
  - Document extraction from PDF/DOCX/TXT/CSV/XLSX/PPTX (DocumentExtractionService)
  - AI assignments/tasks management (AIAssignmentService)
  - Semantic search via embeddings (Sentence-Transformers)
  - RAG with user-scoped document retrieval
  - Keyword fallback if vector search unavailable
  - Graceful degradation if Ollama down

Security:
  - All operations scoped to authenticated user
  - FileAccessService validates ownership on every operation
  - RAG searches filtered by user_id
  - LLM context includes only user's authorized files
"""

from __future__ import annotations

import os
import re
from typing import Any, Optional

from app.config import (
    USE_LOCAL_LLM,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OPENROUTER_BASE_URL,
    LLM_MODEL,
    get_llm_api_key,
)
from app.services.rag_service import RAGService
from app.services.ollama_service import OllamaService, OpenRouterService
from app.services.file_access_service import FileAccessService
from app.services.document_extraction_service import DocumentExtractionService
from app.services.ai_assignment_service import AIAssignmentService


# ---------------------------------------------------------------------------
# LLM Client Initialization
# ---------------------------------------------------------------------------

_ollama_client: Optional[OllamaService] = None
_openrouter_client: Optional[OpenRouterService] = None
_rag_service: Optional[RAGService] = None


def _get_llm_client():
    """Get or initialize the LLM client (Ollama or OpenRouter)."""
    global _ollama_client, _openrouter_client

    if USE_LOCAL_LLM:
        if _ollama_client is None:
            _ollama_client = OllamaService(
                base_url=OLLAMA_BASE_URL,
                model=OLLAMA_MODEL,
            )
        # Check if Ollama is actually available
        if _ollama_client.is_available():
            return _ollama_client
        else:
            # Fall back to OpenRouter if Ollama not running
            print("[AI Service] Ollama unavailable, falling back to OpenRouter")
            if _openrouter_client is None:
                try:
                    api_key = get_llm_api_key()
                    _openrouter_client = OpenRouterService(api_key=api_key, model=LLM_MODEL)
                except RuntimeError as e:
                    raise RuntimeError(f"OpenRouter config error: {e}")
            return _openrouter_client
    else:
        if _openrouter_client is None:
            try:
                api_key = get_llm_api_key()
                _openrouter_client = OpenRouterService(api_key=api_key, model=LLM_MODEL)
            except RuntimeError as e:
                raise RuntimeError(f"OpenRouter config error: {e}")
        return _openrouter_client


def _get_rag_service():
    """Get or initialize the RAG service."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service


def _reset_clients() -> None:
    """Force re-creation of clients (useful after config change)."""
    global _ollama_client, _openrouter_client, _rag_service
    _ollama_client = None
    _openrouter_client = None
    _rag_service = None


# ---------------------------------------------------------------------------
# Keyword-based local search (legacy, used as fallback)
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    return [tok for tok in re.findall(r"[a-z0-9]+", text.lower()) if tok]


def _score_documents(
    query: str,
    documents: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Return documents sorted by relevance score (keyword matching)."""
    tokens = _tokenize(query)
    if not tokens:
        return []

    hits: list[dict[str, Any]] = []
    for doc in documents:
        doc_text = f"{doc.get('title', '')} {doc.get('content', '')}".lower()
        score = sum(
            1.0 + (0.5 if token in doc.get("title", "").lower() else 0.0)
            for token in tokens
            if token in doc_text
        )
        if score > 0:
            hits.append({**doc, "_score": round(score, 2)})

    hits.sort(key=lambda d: d["_score"], reverse=True)
    return hits[:5]


# ---------------------------------------------------------------------------
# Public service class
# ---------------------------------------------------------------------------

class SmartCloudAIService:
    """
    Provides AI-powered search, chat, and summarization over the user's files.

    Uses semantic search (embeddings) and RAG (document retrieval) for
    grounded answers. Falls back to keyword matching if embeddings unavailable.

    All methods are scoped to the authenticated user via FileAccessService.
    """

    def __init__(self, authenticated_user_id: str):
        """
        Initialize AI service for authenticated user.
        
        Args:
            authenticated_user_id: UUID of authenticated user (from JWT token)
        """
        self.authenticated_user_id = authenticated_user_id
        self._file_access = FileAccessService(authenticated_user_id)
        self._assignment_service = AIAssignmentService(authenticated_user_id)

    # ───────────────────────────────────────────────────────────────────────
    # FILE ACCESS METHODS (via FileAccessService)
    # ───────────────────────────────────────────────────────────────────────

    def get_user_files(self, folder_id: Optional[str] = None) -> list[dict[str, Any]]:
        """
        Get list of user's files (optionally in specific folder).
        
        Args:
            folder_id: Optional folder UUID to list files in
        
        Returns:
            List of file records
        """
        return self._file_access.list_user_files(folder_id=folder_id, include_trashed=False)

    def get_user_folders(self, parent_id: Optional[str] = None) -> list[dict[str, Any]]:
        """
        Get list of user's folders (optionally subfolders of parent).
        
        Args:
            parent_id: Optional parent folder UUID
        
        Returns:
            List of folder records
        """
        return self._file_access.list_user_folders(parent_id=parent_id, include_trashed=False)

    def search_user_files(self, query: str) -> list[dict[str, Any]]:
        """
        Search user's files by name.
        
        Args:
            query: Search query
        
        Returns:
            List of matching files
        """
        return self._file_access.search_user_files(query, search_type="all")

    def get_folder_contents(self, folder_id: str) -> dict[str, Any]:
        """
        Get complete contents of a folder (subfolders + files).
        
        Args:
            folder_id: Folder UUID
        
        Returns:
            Dict with folder info, subfolders, and files
        """
        return self._file_access.get_folder_contents(folder_id)

    def get_folder_hierarchy(self, folder_id: str) -> list[dict[str, Any]]:
        """
        Get breadcrumb path from root to folder.
        
        Args:
            folder_id: Folder UUID
        
        Returns:
            List of folder records from root to target
        """
        return self._file_access.get_folder_hierarchy(folder_id)

    def get_storage_stats(self) -> dict[str, Any]:
        """Get user's storage usage statistics."""
        return self._file_access.get_user_storage_stats()

    # ───────────────────────────────────────────────────────────────────────
    # DOCUMENT EXTRACTION
    # ───────────────────────────────────────────────────────────────────────

    def extract_document_content(
        self,
        file_bytes: bytes,
        mime_type: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Extract text content from a document file.
        
        Args:
            file_bytes: File content as bytes
            mime_type: MIME type (e.g., "application/pdf")
            file_name: Original filename
        
        Returns:
            Dict with success, content, word_count, metadata
        """
        result = DocumentExtractionService.extract(file_bytes, mime_type, file_name)
        
        return {
            "success": result.success,
            "content": result.content,
            "word_count": result.word_count,
            "page_count": result.page_count,
            "error": result.error,
            "metadata": result.metadata or {},
        }

    # ───────────────────────────────────────────────────────────────────────
    # ASSIGNMENT MANAGEMENT
    # ───────────────────────────────────────────────────────────────────────

    def create_assignment(
        self,
        title: str,
        description: Optional[str] = None,
        file_id: Optional[str] = None,
        due_date: Optional[str] = None,
        priority: str = "medium",
        tags: Optional[list[str]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Create a new assignment.
        
        Args:
            title: Assignment title
            description: Detailed description
            file_id: Optional associated file UUID
            due_date: Due date (ISO 8601 format)
            priority: Priority level
            tags: Optional tags
        
        Returns:
            Assignment record if successful
        """
        return self._assignment_service.create_assignment(
            title=title,
            description=description,
            file_id=file_id,
            due_date=due_date,
            priority=priority,
            tags=tags,
        )

    def list_assignments(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        file_id: Optional[str] = None,
        include_completed: bool = True,
    ) -> list[dict[str, Any]]:
        """
        List user's assignments with optional filtering.
        
        Args:
            status: Filter by status
            priority: Filter by priority
            file_id: Filter by associated file
            include_completed: Include completed assignments
        
        Returns:
            List of assignment records
        """
        return self._assignment_service.list_assignments(
            status=status,
            priority=priority,
            file_id=file_id,
            include_completed=include_completed,
        )

    def get_assignments_due_soon(self, days: int = 7) -> list[dict[str, Any]]:
        """Get assignments due within N days."""
        return self._assignment_service.get_assignments_due_soon(days=days)

    def update_assignment_status(
        self,
        assignment_id: str,
        status: str,
    ) -> Optional[dict[str, Any]]:
        """Update assignment status."""
        return self._assignment_service.update_assignment_status(assignment_id, status)

    def get_assignment_stats(self) -> dict[str, Any]:
        """Get statistics about user's assignments."""
        return self._assignment_service.get_assignment_stats()

    # ───────────────────────────────────────────────────────────────────────
    # SEARCH: Semantic (embedding-based) + Keyword fallback
    # ───────────────────────────────────────────────────────────────────────


    def search_documents(
        self,
        query: str,
        context_files: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Semantic search with keyword fallback.

        Automatically scoped to authenticated user via RAGService.
        
        Args:
            query: Search query
            context_files: Optional file metadata for fallback

        Returns:
            List of search results with scores
        """
        # Create a mapping of file_id -> file_name for lookup
        file_map = {}
        if context_files:
            for file_info in context_files:
                if 'id' in file_info and 'name' in file_info:
                    file_map[file_info['id']] = file_info['name']
        
        # Try semantic search with authenticated user's documents
        try:
            from app.services.embeddings import SENTENCE_TRANSFORMERS_AVAILABLE
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                rag = _get_rag_service()
                chunks = rag.retrieve(query, self.authenticated_user_id, top_k=5)
                if chunks:
                    return [
                        {
                            "title": file_map.get(c.get('file_id'), f"File {c.get('file_id', 'unknown')[:8]}..."),
                            "file_id": c.get('file_id'),
                            "snippet": c.get("content", "")[:180],
                            "score": c.get("similarity", 0.5),
                        }
                        for c in chunks
                    ]
        except Exception as e:
            print(f"[AI Search] Semantic search failed: {e}, falling back to keyword")

        # Fallback: keyword search on provided files
        docs = context_files or []
        hits = _score_documents(query, docs)
        return [
            {
                "title": h.get("name", h.get("title", "Unknown")),
                "file_id": h.get("id"),
                "snippet": str(h.get("content", h.get("type", "")))[:180],
                "score": h["_score"],
            }
            for h in hits
        ]

    # ───────────────────────────────────────────────────────────────────────
    # CHAT / RAG with document retrieval
    # ───────────────────────────────────────────────────────────────────────


    def answer_query(
        self,
        query: str,
        context_files: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Generate an answer using LLM grounded in authenticated user's documents.

        RAG flow:
        1. Retrieve relevant document chunks (vector similarity search, scoped to user)
        2. Build context block from chunks
        3. Send to LLM with context
        4. Return answer + sources with file citations

        Args:
            query: User's question
            context_files: Optional file metadata for fallback

        Returns:
            Dict with answer, sources (with file_id and chunk info), model

        Raises:
            RuntimeError: If LLM unavailable
        """
        client = _get_llm_client()

        # Try to retrieve document chunks scoped to authenticated user
        context_block = ""
        sources = []

        try:
            rag = _get_rag_service()
            chunks = rag.retrieve(query, self.authenticated_user_id, top_k=5)
            if chunks:
                context_block = rag.build_context_block(chunks)
                sources = [
                    {
                        "file_id": c.get('file_id'),
                        "chunk_index": c.get("chunk_index", 0),
                        "similarity": c.get("similarity", 0.5),
                        "title": f"Document excerpt (chunk {c.get('chunk_index', 0)})",
                    }
                    for c in chunks[:3]
                ]
        except Exception as e:
            print(f"[AI Service] RAG retrieval failed: {e}")

        # Fallback: use provided file metadata
        if not context_block and context_files:
            docs = context_files or []
            top_hits = _score_documents(query, docs)
            if docs:
                context_lines = "\n".join(
                    f"- {d.get('title', d.get('name', 'Unknown'))} "
                    f"({d.get('type', d.get('file_type', 'file'))}, "
                    f"{d.get('size', d.get('file_size', 0))} bytes)"
                    for d in docs[:20]
                )
                context_block = (
                    "The user has the following files in their SmartCloud drive:\n"
                    f"{context_lines}\n\n"
                )
                sources = [
                    {
                        "file_id": h.get("id"),
                        "title": h.get("title", h.get("name", "Unknown")),
                        "similarity": h["_score"]
                    }
                    for h in top_hits[:3]
                ]
            else:
                context_block = (
                    "The user has not provided any file context. "
                    "Answer based on general SmartCloud knowledge.\n\n"
                )

        system_prompt = (
            "You are SmartCloud AI, a helpful assistant for an AI-powered "
            "secure cloud storage platform. You can only see files that the "
            "authenticated user has explicitly shared with you — you must "
            "NEVER reveal or infer information from files that are not in "
            "the provided context.\n\n"
            "Keep answers concise and helpful. If you cannot answer from "
            "the provided context, say so honestly.\n\n"
            "When citing information, reference the source files provided."
        )

        user_message = f"{context_block}User question: {query}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        # Call LLM
        try:
            answer_text = client.chat(
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )
        except RuntimeError as e:
            # If Ollama fails and we have OpenRouter fallback, try it
            if USE_LOCAL_LLM:
                print(f"[AIService] Ollama failed, trying OpenRouter fallback: {e}")
                try:
                    fallback = OpenRouterService(
                        api_key=get_llm_api_key(),
                        model=LLM_MODEL,
                    )
                    answer_text = fallback.chat(
                        messages=messages,
                        temperature=0.3,
                        max_tokens=1024,
                    )
                except Exception as e2:
                    raise RuntimeError(f"Both Ollama and OpenRouter failed: {e2}")
            else:
                raise

        if not answer_text:
            answer_text = "No response generated."

        return {
            "answer": answer_text,
            "sources": sources,
            "model": OLLAMA_MODEL if USE_LOCAL_LLM else LLM_MODEL,
        }

    # ───────────────────────────────────────────────────────────────────────
    # DOCUMENT SUMMARY
    # ───────────────────────────────────────────────────────────────────────


    def summarize_document(
        self,
        file_name: str,
        file_type: str,
        content_hint: str = "",
    ) -> dict[str, Any]:
        """Generate a summary for a single document."""
        client = _get_llm_client()

        prompt = (
            f"Summarize the following document for the user.\n\n"
            f"File: {file_name}\nType: {file_type}\n"
        )
        if content_hint:
            prompt += f"Content preview: {content_hint[:500]}\n"

        messages = [
            {
                "role": "system",
                "content": (
                    "You are SmartCloud AI. Provide a brief, helpful summary "
                    "of the document described. Be concise (3-5 sentences)."
                ),
            },
            {"role": "user", "content": prompt},
        ]

        try:
            summary = client.chat(
                messages=messages,
                temperature=0.2,
                max_tokens=256,
            )
        except RuntimeError as e:
            print(f"[AIService] Summarization failed: {e}")
            summary = "Summary unavailable."

        return {"summary": summary, "file": file_name}
