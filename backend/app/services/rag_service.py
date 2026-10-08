"""
RAG (Retrieval-Augmented Generation) Service

Handles vector similarity search over document chunks stored in PostgreSQL.
Retrieves relevant chunks to augment LLM context for grounded answers.
"""

from __future__ import annotations

from typing import Any, Optional
import json

from app.services import embeddings


# ────────────────────────────────────────────────────────────────────────────
# Type hints
# ────────────────────────────────────────────────────────────────────────────

RetrievalResult = dict[str, Any]


# ────────────────────────────────────────────────────────────────────────────
# RAG Service Class
# ────────────────────────────────────────────────────────────────────────────

class RAGService:
    """
    Retrieves relevant document chunks via vector similarity search.
    
    All queries are scoped to a single user (via owner_id) to ensure
    data privacy and permission compliance.
    """

    def __init__(self, supabase_client=None):
        """
        Initialize RAG service with optional Supabase client.
        
        Args:
            supabase_client: Supabase client instance. If None, created on first use.
        """
        self._client = supabase_client

    def _get_client(self):
        """Get or initialize Supabase client."""
        if self._client is None:
            from supabase import create_client
            from app.config import SUPABASE_URL, SUPABASE_KEY
            self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return self._client

    # ────────────────────────────────────────────────────────────────────────
    # Chunk Storage
    # ────────────────────────────────────────────────────────────────────────

    def store_chunks(
        self,
        file_id: str,
        owner_id: str,
        chunks: list[dict[str, Any]],
    ) -> bool:
        """
        Store document chunks with embeddings in PostgreSQL.

        Args:
            file_id: ID of the file being indexed
            owner_id: ID of the file owner (for permission filtering)
            chunks: List of dicts with keys: chunk_index, content, embedding

        Returns:
            True if successful, False otherwise
        """
        if not chunks:
            print(f"[RAG] No chunks to store for file {file_id}")
            return False

        client = self._get_client()

        # Prepare rows for insertion
        rows = []
        for chunk in chunks:
            rows.append({
                "file_id": file_id,
                "owner_id": owner_id,
                "chunk_index": chunk.get("chunk_index", 0),
                "content": chunk.get("content", ""),
                "embedding": chunk.get("embedding"),  # pgvector format
            })

        try:
            # Insert in batches to avoid timeouts
            batch_size = 100
            for i in range(0, len(rows), batch_size):
                batch = rows[i : i + batch_size]
                result = client.table("document_chunks").insert(batch).execute()
                print(f"[RAG] Stored {len(batch)} chunks for file {file_id}")

            return True
        except Exception as e:
            print(f"[RAG] Failed to store chunks: {e}")
            return False

    def delete_chunks_for_file(self, file_id: str, owner_id: str) -> bool:
        """
        Delete all chunks associated with a file (e.g., on file deletion).

        Args:
            file_id: ID of the file
            owner_id: ID of the file owner

        Returns:
            True if successful
        """
        client = self._get_client()
        try:
            client.table("document_chunks").delete().eq("file_id", file_id).eq(
                "owner_id", owner_id
            ).execute()
            print(f"[RAG] Deleted chunks for file {file_id}")
            return True
        except Exception as e:
            print(f"[RAG] Failed to delete chunks: {e}")
            return False

    # ────────────────────────────────────────────────────────────────────────
    # Vector Similarity Search
    # ────────────────────────────────────────────────────────────────────────

    def retrieve(
        self,
        query: str,
        owner_id: str,
        top_k: int = 5,
        similarity_threshold: float = 0.3,
    ) -> list[RetrievalResult]:
        """
        Retrieve relevant document chunks via semantic similarity.

        Uses cosine distance in pgvector for fast, accurate retrieval.
        Results are scoped to the specified user (owner_id).
        
        Falls back to keyword search if embeddings unavailable.

        Args:
            query: User's search query or question
            owner_id: ID of the user (permission filter)
            top_k: Number of top results to return
            similarity_threshold: Minimum similarity score (0-1)

        Returns:
            List of dicts with keys: file_id, content, similarity, chunk_index
        """
        try:
            # Try semantic search with embeddings
            if not embeddings.SENTENCE_TRANSFORMERS_AVAILABLE:
                print("[RAG] sentence-transformers not available, using keyword fallback")
                return self._keyword_fallback(query, owner_id, top_k)
            
            # Encode query to embedding
            query_embedding = embeddings.encode(query)
            query_embedding_list = query_embedding.tolist()

            client = self._get_client()

            try:
                # Use PostgreSQL's vector similarity search
                # The '<->' operator computes cosine distance (0-2 range)
                # We convert to similarity: similarity = 1 - distance/2
                # (This ranges from -1 to 1; we filter for positive values)

                # Raw SQL query for vector similarity
                result = client.rpc(
                    "search_document_chunks",
                    {
                        "query_embedding": query_embedding_list,
                        "user_id": owner_id,
                        "limit": top_k,
                    },
                ).execute()

                if result.data:
                    # Filter by similarity threshold
                    filtered = [
                        chunk
                        for chunk in result.data
                        if chunk.get("similarity", 0) >= similarity_threshold
                    ]
                    print(
                        f"[RAG] Retrieved {len(filtered)} chunks "
                        f"(from {len(result.data)} results)"
                    )
                    return filtered
                else:
                    print(f"[RAG] No chunks found for query: {query}")
                    return []

            except Exception as e:
                print(f"[RAG] Vector search failed: {e}, using keyword fallback")
                # Fallback: keyword search on chunk content
                return self._keyword_fallback(query, owner_id, top_k)
        
        except Exception as e:
            print(f"[RAG] Retrieval error: {e}")
            return self._keyword_fallback(query, owner_id, top_k)

    def _keyword_fallback(
        self,
        query: str,
        owner_id: str,
        top_k: int = 5,
    ) -> list[RetrievalResult]:
        """
        Fallback retrieval using simple ILIKE text search.

        Used if pgvector search fails or RPC is not available.

        Args:
            query: Search query
            owner_id: User ID filter
            top_k: Max results

        Returns:
            List of matching chunks
        """
        client = self._get_client()

        try:
            # Simple text search on content
            result = (
                client.table("document_chunks")
                .select("*")
                .eq("owner_id", owner_id)
                .ilike("content", f"%{query}%")
                .limit(top_k)
                .execute()
            )

            if result.data:
                chunks = []
                for chunk in result.data:
                    chunks.append({
                        "file_id": chunk.get("file_id"),
                        "content": chunk.get("content"),
                        "similarity": 0.5,  # Neutral score for fallback
                        "chunk_index": chunk.get("chunk_index"),
                    })
                print(f"[RAG] Fallback: Retrieved {len(chunks)} chunks via ILIKE")
                return chunks
            else:
                return []

        except Exception as e:
            print(f"[RAG] Keyword fallback also failed: {e}")
            return []

    # ────────────────────────────────────────────────────────────────────────
    # Context Building for LLM
    # ────────────────────────────────────────────────────────────────────────

    def build_context_block(
        self,
        chunks: list[RetrievalResult],
        max_chars: int = 4000,
    ) -> str:
        """
        Build a context block from retrieved chunks for LLM consumption.

        Prioritizes high-similarity chunks and truncates to stay within limits.

        Args:
            chunks: List of retrieved chunks (from retrieve())
            max_chars: Maximum character limit for context block

        Returns:
            Formatted context string
        """
        if not chunks:
            return (
                "No document context is available. "
                "Answer based on general knowledge."
            )

        context_parts = []
        total_chars = 0

        for chunk in chunks:
            content = chunk.get("content", "")
            similarity = chunk.get("similarity", 0)

            # Format with similarity score
            formatted = f"[Relevance: {similarity:.1%}]\n{content}\n"

            if total_chars + len(formatted) > max_chars:
                # Truncate if we'd exceed limit
                remaining = max_chars - total_chars
                if remaining > 100:
                    formatted = formatted[:remaining] + "..."
                    context_parts.append(formatted)
                break

            context_parts.append(formatted)
            total_chars += len(formatted)

        if not context_parts:
            return "No relevant document content found."

        return (
            "Here are the most relevant sections from the user's documents:\n\n"
            + "\n".join(context_parts)
        )

    # ────────────────────────────────────────────────────────────────────────
    # Statistics
    # ────────────────────────────────────────────────────────────────────────

    def get_stats(self, owner_id: str) -> dict[str, Any]:
        """
        Get indexing statistics for a user.

        Args:
            owner_id: User ID

        Returns:
            Dict with keys: total_chunks, total_files, avg_chunk_length
        """
        client = self._get_client()

        try:
            # Total chunks
            chunks_result = (
                client.table("document_chunks")
                .select("id")
                .eq("owner_id", owner_id)
                .execute()
            )
            total_chunks = len(chunks_result.data) if chunks_result.data else 0

            # Unique files
            files_result = (
                client.table("document_chunks")
                .select("file_id")
                .eq("owner_id", owner_id)
                .execute()
            )
            unique_files = (
                len(set(f.get("file_id") for f in files_result.data))
                if files_result.data
                else 0
            )

            return {
                "total_chunks": total_chunks,
                "total_files": unique_files,
                "owner_id": owner_id,
            }
        except Exception as e:
            print(f"[RAG] Failed to get stats: {e}")
            return {"error": str(e)}
