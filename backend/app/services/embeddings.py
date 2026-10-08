"""
Local embeddings service using Sentence-Transformers.

This service converts text to dense vector embeddings for semantic search.
Models are cached in memory after first use.
"""

from __future__ import annotations

import os
from typing import Optional
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    SentenceTransformer = None


# ────────────────────────────────────────────────────────────────────────────
# Lazy-loaded embedding model (singleton pattern)
# ────────────────────────────────────────────────────────────────────────────

_embedding_model: Optional[SentenceTransformer] = None
_model_name: str = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")


def _get_embedding_model() -> SentenceTransformer:
    """Get or initialize the embedding model."""
    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        raise RuntimeError(
            "sentence-transformers not installed. "
            "Run: pip install sentence-transformers"
        )
    
    global _embedding_model
    if _embedding_model is None:
        print(f"[Embeddings] Loading model: {_model_name}")
        _embedding_model = SentenceTransformer(_model_name)
        print(f"[Embeddings] Model loaded. Dimension: {_embedding_model.get_sentence_embedding_dimension()}")
    return _embedding_model


def encode(texts: str | list[str]) -> np.ndarray:
    """
    Encode text(s) to embedding vector(s).

    Args:
        texts: Single string or list of strings

    Returns:
        NumPy array of shape (D,) for single text or (N, D) for multiple texts
        where D is the embedding dimension (typically 384 or 1536)
    """
    model = _get_embedding_model()
    
    if isinstance(texts, str):
        # Single text: return (D,) array
        return model.encode(texts, convert_to_numpy=True)
    else:
        # Multiple texts: return (N, D) array
        return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)


def get_embedding_dimension() -> int:
    """Get the dimension of embeddings produced by this model."""
    model = _get_embedding_model()
    return model.get_sentence_embedding_dimension()


def reset_model() -> None:
    """Force reload of the embedding model (useful for config changes)."""
    global _embedding_model
    _embedding_model = None
