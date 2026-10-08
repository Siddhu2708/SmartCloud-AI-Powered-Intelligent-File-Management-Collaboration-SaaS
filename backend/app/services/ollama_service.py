"""
Ollama LLM Service Wrapper

Provides a simple interface to interact with local Ollama instance.
Supports streaming and non-streaming chat completions.
Gracefully handles fallback to OpenRouter if Ollama unavailable.
"""

from __future__ import annotations

import os
import httpx
from typing import Optional, Iterator, Any

from app.config import (
    USE_LOCAL_LLM,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OPENROUTER_BASE_URL,
)


# ────────────────────────────────────────────────────────────────────────────
# Ollama Service
# ────────────────────────────────────────────────────────────────────────────

class OllamaService:
    """
    Interface to local Ollama instance.
    
    Ollama runs locally and provides an OpenAI-compatible API at /api/chat.
    Start Ollama with: ollama serve
    Pull a model with: ollama pull mistral
    """

    def __init__(
        self,
        base_url: str = OLLAMA_BASE_URL,
        model: str = OLLAMA_MODEL,
        timeout: float = 60.0,
    ):
        """
        Initialize Ollama service.

        Args:
            base_url: Ollama server URL (default: http://localhost:11434)
            model: Model name to use (default: mistral)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self._available = None  # Cache availability check

    def is_available(self) -> bool:
        """Check if Ollama server is reachable."""
        if self._available is not None:
            return self._available

        try:
            response = httpx.get(
                f"{self.base_url}/api/tags",
                timeout=2.0,  # Reduced from 5.0 to 2.0 seconds for faster timeout
            )
            self._available = response.status_code == 200
            if self._available:
                print(f"[Ollama] Connected to {self.base_url}")
            else:
                self._available = False
            return self._available
        except httpx.TimeoutException:
            print(f"[Ollama] Connection timeout (Ollama not running at {self.base_url})")
            self._available = False
            return False
        except Exception as e:
            print(f"[Ollama] Connection failed: {e}")
            self._available = False
            return False

    def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        Send chat messages and get a response (non-streaming).

        Args:
            messages: List of {"role": "user|assistant|system", "content": "..."}
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Max tokens in response (Ollama may ignore)

        Returns:
            Response text

        Raises:
            RuntimeError: If Ollama unavailable or request fails
        """
        if not self.is_available():
            raise RuntimeError(
                f"Ollama server not available at {self.base_url}. "
                "Start it with: ollama serve"
            )

        try:
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens or 1024,
                },
            }

            response = httpx.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=self.timeout,
            )

            if response.status_code != 200:
                raise RuntimeError(
                    f"Ollama returned {response.status_code}: {response.text}"
                )

            result = response.json()
            content = result.get("message", {}).get("content", "")

            if not content:
                raise RuntimeError("No content in Ollama response")

            return content

        except httpx.TimeoutException:
            raise RuntimeError(f"Ollama request timeout (>{self.timeout}s)")
        except Exception as e:
            raise RuntimeError(f"Ollama chat failed: {e}")

    def chat_stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
    ) -> Iterator[str]:
        """
        Send chat messages and stream the response.

        Args:
            messages: List of {"role": "user|assistant|system", "content": "..."}
            temperature: Sampling temperature (0.0-1.0)

        Yields:
            Chunks of response text

        Raises:
            RuntimeError: If Ollama unavailable
        """
        if not self.is_available():
            raise RuntimeError(
                f"Ollama server not available at {self.base_url}. "
                "Start it with: ollama serve"
            )

        try:
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": True,
                "options": {
                    "temperature": temperature,
                },
            }

            with httpx.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=self.timeout,
            ) as response:
                if response.status_code != 200:
                    raise RuntimeError(
                        f"Ollama returned {response.status_code}: {response.text}"
                    )

                for line in response.iter_lines():
                    if line:
                        data = response.json()
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content

        except httpx.TimeoutException:
            raise RuntimeError(f"Ollama streaming timeout (>{self.timeout}s)")
        except Exception as e:
            raise RuntimeError(f"Ollama streaming failed: {e}")

    def list_models(self) -> list[str]:
        """List available models on the Ollama server."""
        if not self.is_available():
            return []

        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            result = response.json()
            models = [m.get("name") for m in result.get("models", [])]
            return models
        except Exception as e:
            print(f"[Ollama] Failed to list models: {e}")
            return []

    def pull_model(self, model: str) -> bool:
        """Download a model from Ollama registry."""
        if not self.is_available():
            print(f"[Ollama] Cannot pull model; server not available")
            return False

        try:
            print(f"[Ollama] Pulling model: {model}")
            response = httpx.post(
                f"{self.base_url}/api/pull",
                json={"name": model},
                timeout=None,  # Can take a long time
            )
            return response.status_code == 200
        except Exception as e:
            print(f"[Ollama] Failed to pull model: {e}")
            return False


# ────────────────────────────────────────────────────────────────────────────
# Singleton instance and convenience functions
# ────────────────────────────────────────────────────────────────────────────

_ollama_instance: Optional[OllamaService] = None


def get_ollama() -> OllamaService:
    """Get or create the default Ollama service instance."""
    global _ollama_instance
    if _ollama_instance is None:
        _ollama_instance = OllamaService(
            base_url=OLLAMA_BASE_URL,
            model=OLLAMA_MODEL,
        )
    return _ollama_instance


def reset_ollama() -> None:
    """Reset the Ollama instance (useful for model changes)."""
    global _ollama_instance
    _ollama_instance = None


# ────────────────────────────────────────────────────────────────────────────
# OpenRouter Fallback (OpenAI-compatible)
# ────────────────────────────────────────────────────────────────────────────

class OpenRouterService:
    """Fallback to OpenRouter when Ollama unavailable."""

    def __init__(self, api_key: str, model: str = "nvidia/nemotron-3.5-lightning:free"):
        """Initialize OpenRouter client."""
        from openai import OpenAI

        self.client = OpenAI(
            api_key=api_key,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": "https://smartcloud.app",
                "X-Title": "SmartCloud",
            },
            timeout=30.0,
        )
        self.model = model

    def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Send chat and get response."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens or 1024,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            raise RuntimeError(f"OpenRouter chat failed: {e}")

    def is_available(self) -> bool:
        """OpenRouter is available if we have an API key."""
        return bool(self.client.api_key and self.client.api_key != "sk-or-v1-")
