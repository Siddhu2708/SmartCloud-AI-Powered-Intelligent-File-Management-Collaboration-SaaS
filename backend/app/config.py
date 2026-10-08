"""
Central configuration for the SmartCloud FastAPI backend.

Reads environment variables (from .env via python-dotenv when present,
or from the process environment in production).

Fails loudly at import time if required variables are missing so that
misconfiguration surfaces immediately, not as a vague runtime error.
"""
import os
from pathlib import Path

# Load .env file when running locally (python-dotenv is optional;
# in production variables are injected by the platform).
try:
    from dotenv import load_dotenv
    # Walk up to find .env relative to this file
    _env_file = Path(__file__).parent.parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file)
except ImportError:
    pass  # python-dotenv not installed — rely on real env vars


def _require(name: str) -> str:
    """Return the value of an env var, raising at startup if missing."""
    value = os.environ.get(name, "").strip()
    if not value or value == "your_openrouter_api_key_here":
        raise RuntimeError(
            f"[SmartCloud] Required environment variable '{name}' is not set. "
            "Add it to backend/.env (local) or your hosting platform's secret "
            "manager (production). Never commit secret values to git."
        )
    return value


def _optional(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL: str = _optional("SUPABASE_URL")
SUPABASE_KEY: str = _optional("SUPABASE_KEY")

# ── LLM Configuration: Local Ollama (Primary) or OpenRouter (Fallback) ──────
# PRIMARY (Recommended): Local Ollama for privacy, speed, and cost
USE_LOCAL_LLM: bool = _optional("USE_LOCAL_LLM", "true").lower() == "true"
OLLAMA_BASE_URL: str = _optional("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str = _optional("OLLAMA_MODEL", "mistral")

# FALLBACK: OpenRouter (OpenAI-compatible API) if Ollama unavailable
OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL: str = _optional("OPENROUTER_MODEL", "inclusion-ai/ling-3.0-flash-fin:free")

def get_llm_api_key() -> str:
    """Return LLM_API_KEY for OpenRouter fallback (required only if USE_LOCAL_LLM=false)."""
    if USE_LOCAL_LLM:
        return "local"  # Ollama doesn't require API key
    return _require("LLM_API_KEY")

# ── Embeddings Configuration ───────────────────────────────────────────────────
# Uses local Sentence-Transformers for semantic search
EMBEDDING_MODEL: str = _optional("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIMENSION: int = 384  # all-MiniLM-L6-v2 produces 384-dim vectors

# ── Legacy LLM_MODEL (kept for backwards compatibility) ─────────────────────────
LLM_MODEL: str = OLLAMA_MODEL if USE_LOCAL_LLM else OPENROUTER_MODEL

# ── Razorpay TEST MODE ────────────────────────────────────────────────────────
# Load from env — never hardcode. Switch to live keys only when explicitly asked.
RAZORPAY_KEY_ID: str = _optional("RAZORPAY_KEY_ID")
"""Public Razorpay key — safe to send to the frontend."""

def get_razorpay_key_secret() -> str:
    """Return RAZORPAY_KEY_SECRET. Raises at startup if missing."""
    return _require("RAZORPAY_KEY_SECRET")

# ── CORS Configuration ────────────────────────────────────────────────────────
# Frontend URL for CORS allow_origins
FRONTEND_URL: str = _optional("FRONTEND_URL", "http://localhost:3000")
"""Frontend URL for CORS configuration. Set to frontend domain in production."""
