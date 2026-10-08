"""
Document processing pipeline: extract, chunk, and embed documents.

Supports: PDF, DOCX, TXT, Markdown, and plain text.
Stores chunks with embeddings in PostgreSQL via Supabase.
"""

from __future__ import annotations

import os
import io
from typing import Optional
import json

try:
    import pdfplumber
    from docx import Document as DocxDocument
except ImportError:
    raise RuntimeError(
        "PDF/DOCX dependencies not installed. "
        "Run: pip install pdfplumber python-docx"
    )

from app.services import embeddings


# ────────────────────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────────────────────

CHUNK_SIZE = 512  # tokens (approximate)
CHUNK_OVERLAP = 128  # tokens
MIN_CHUNK_LENGTH = 50  # minimum characters per chunk


# ────────────────────────────────────────────────────────────────────────────
# Text extraction by format
# ────────────────────────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF."""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            text_parts = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            return "\n\n".join(text_parts)
    except Exception as e:
        print(f"[DocumentProcessor] PDF extraction failed: {e}")
        return ""


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX."""
    try:
        doc = DocxDocument(io.BytesIO(file_bytes))
        text_parts = []
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text)
        return "\n".join(text_parts)
    except Exception as e:
        print(f"[DocumentProcessor] DOCX extraction failed: {e}")
        return ""


def extract_text_from_file(
    file_bytes: bytes,
    file_name: str,
    mime_type: Optional[str] = None,
) -> str:
    """
    Extract text from file based on type.

    Args:
        file_bytes: Raw file content
        file_name: Original filename (used for format detection)
        mime_type: MIME type if known

    Returns:
        Extracted text content
    """
    name_lower = file_name.lower()

    # Detect format
    if mime_type:
        if "pdf" in mime_type:
            return extract_text_from_pdf(file_bytes)
        elif "word" in mime_type or "officedocument" in mime_type:
            return extract_text_from_docx(file_bytes)

    # Fallback: detect by extension
    if name_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif name_lower.endswith(".docx"):
        return extract_text_from_docx(file_bytes)
    elif name_lower.endswith((".txt", ".md", ".markdown")):
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return ""

    # Last resort: try as text
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        print(f"[DocumentProcessor] Could not decode file: {file_name}")
        return ""


# ────────────────────────────────────────────────────────────────────────────
# Chunking
# ────────────────────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    """
    Split text into overlapping chunks.

    Uses a simple word-based splitter. For production, consider more
    sophisticated approaches (sentence boundaries, semantic splitting, etc).

    Args:
        text: Full text to chunk
        chunk_size: Approximate chunk size in words
        overlap: Number of words to overlap between chunks

    Returns:
        List of text chunks
    """
    if not text or not text.strip():
        return []

    # Simple word-based splitting
    words = text.split()
    if len(words) < chunk_size:
        # Text shorter than chunk size; return as single chunk
        return [text.strip()]

    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i : i + chunk_size]).strip()
        if len(chunk) >= MIN_CHUNK_LENGTH:
            chunks.append(chunk)

    return chunks if chunks else [text.strip()]


# ────────────────────────────────────────────────────────────────────────────
# Embedding pipeline
# ────────────────────────────────────────────────────────────────────────────

def process_document(
    file_bytes: bytes,
    file_name: str,
    mime_type: Optional[str] = None,
) -> list[dict]:
    """
    Process a document: extract text, chunk, and embed.

    Args:
        file_bytes: Raw file content
        file_name: Original filename
        mime_type: MIME type if known

    Returns:
        List of dicts with keys: content, embedding (as list, not numpy array)
    """
    # Extract text
    text = extract_text_from_file(file_bytes, file_name, mime_type)
    if not text or not text.strip():
        print(f"[DocumentProcessor] No text extracted from {file_name}")
        return []

    # Chunk
    chunks = chunk_text(text)
    print(f"[DocumentProcessor] Created {len(chunks)} chunks from {file_name}")

    # Embed
    embeddings_array = embeddings.encode(chunks)

    # Convert numpy arrays to Python lists for JSON serialization
    result = []
    for idx, (chunk, emb) in enumerate(zip(chunks, embeddings_array)):
        result.append({
            "chunk_index": idx,
            "content": chunk,
            "embedding": emb.tolist() if hasattr(emb, "tolist") else emb,
        })

    return result


# ────────────────────────────────────────────────────────────────────────────
# Batch embedding (for re-embedding or processing multiple files)
# ────────────────────────────────────────────────────────────────────────────

def embed_chunks(chunks: list[str]) -> list[list[float]]:
    """
    Embed a list of text chunks.

    Args:
        chunks: List of text strings

    Returns:
        List of embeddings (each as a list of floats)
    """
    if not chunks:
        return []

    embeddings_array = embeddings.encode(chunks)
    
    # Convert to list of lists
    result = []
    for emb in embeddings_array:
        result.append(emb.tolist() if hasattr(emb, "tolist") else emb)
    
    return result
