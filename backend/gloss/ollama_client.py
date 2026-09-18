"""Model 3 (Ollama): warm-up portion only (Phase 3).

Full request-building, prompts, and vocab filtering are added in Phase 6.
"""

import logging

import httpx

from backend.config import OLLAMA_HOST_URL, OLLAMA_MODEL_NAME

logger = logging.getLogger(__name__)

_warm = False


def warm_up() -> bool:
    """Send a trivial throwaway prompt to force the model into VRAM and
    trigger any internal JIT/compilation. Response content is discarded."""
    global _warm
    try:
        response = httpx.post(
            f"{OLLAMA_HOST_URL}/api/generate",
            json={"model": OLLAMA_MODEL_NAME, "prompt": "hello", "stream": False},
            timeout=60.0,
        )
        response.raise_for_status()
        _warm = True
        logger.info("ollama_client: warm (%s)", OLLAMA_MODEL_NAME)
        return True
    except Exception:
        logger.exception("ollama_client: warm-up failed")
        _warm = False
        return False


def is_ready() -> bool:
    return _warm
