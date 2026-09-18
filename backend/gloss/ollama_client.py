"""Model 3 (Ollama): Step 12, Fallback E - complete (Phase 6).

Warm-up (Phase 3) plus the full per-cycle request/response cycle: builds
allowed_vocab once (union of dictionary_loader and cislr_index keys),
POSTs {stable_words, provisional_context, allowed_vocab} against the exact
system prompt and few-shot examples, logs the raw response unconditionally,
discards the cycle on any parse/shape failure (Fallback E), and otherwise
runs vocab_filter.py before advancing the rolling text buffer's commit
boundary. render_resolver.py (Phase 7) is not called yet - validated words
are returned to the caller for now.
"""

import json
import logging

import httpx

from backend.buffer import rolling_text_buffer
from backend.config import OLLAMA_HOST_URL, OLLAMA_MAX_TOKENS, OLLAMA_MODEL_NAME, OLLAMA_TEMPERATURE
from backend.gloss import prompts, vocab_filter
from backend.logs import ollama_raw_log
from backend.lookup import cislr_index, dictionary_loader

logger = logging.getLogger(__name__)

_warm = False
_allowed_vocab: set[str] | None = None


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


def _get_allowed_vocab() -> set[str]:
    """Built once, at first use, after both dictionary_loader.py's and
    cislr_index.py's startup validation passes have already run (they run
    during Phase 3's startup, well before the first gloss cycle can occur)."""
    global _allowed_vocab
    if _allowed_vocab is None:
        _allowed_vocab = set(dictionary_loader.keys()) | set(cislr_index.keys())
        logger.info("ollama_client: allowed_vocab built (%d words)", len(_allowed_vocab))
    return _allowed_vocab


def _call_ollama(stable_words: list[str], provisional_context: list[str], allowed_vocab: set[str]) -> str:
    request_payload = {
        "stable_words": stable_words,
        "provisional_context": provisional_context,
        "allowed_vocab": sorted(allowed_vocab),
    }
    prompt = f"{prompts.FEW_SHOT_EXAMPLES}\n\nInput: {json.dumps(request_payload)}\nOutput:"

    response = httpx.post(
        f"{OLLAMA_HOST_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL_NAME,
            "system": prompts.SYSTEM_PROMPT,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": OLLAMA_TEMPERATURE, "num_predict": OLLAMA_MAX_TOKENS},
        },
        timeout=30.0,
    )
    response.raise_for_status()
    raw_text = response.json()["response"]
    ollama_raw_log.log_response(stable_words, provisional_context, raw_text)
    return raw_text


def run_cycle(session_id: str) -> list[str] | None:
    """One Step 12 cycle for a session. Returns the validated gloss words on
    success, or None if the cycle was skipped/discarded (Fallback E) - in
    which case rolling_text_buffer's commit boundary is left untouched so the
    same stable words retry next cycle with whatever new context has arrived."""
    from backend.session import session_state

    if not session_state.is_current(session_id):
        return None

    batch = rolling_text_buffer.get_commit_batch(session_id)
    stable_words = batch["stable_words"]
    provisional_context = batch["provisional_context"]

    if not stable_words:
        return None

    allowed_vocab = _get_allowed_vocab()

    try:
        raw_text = _call_ollama(stable_words, provisional_context, allowed_vocab)
    except Exception:
        logger.exception("ollama_client: request failed for session %s", session_id)
        return None

    try:
        parsed = json.loads(raw_text)
        gloss_words = parsed["gloss"]
        if not isinstance(gloss_words, list) or not all(isinstance(w, str) for w in gloss_words):
            raise ValueError("gloss field is not a list of strings")
    except Exception:
        logger.warning("ollama_client: malformed response for session %s: %r", session_id, raw_text)
        return None

    validated = vocab_filter.filter_gloss(gloss_words, allowed_vocab, stable_words)
    rolling_text_buffer.advance_commit_boundary(session_id, len(stable_words))
    return validated
