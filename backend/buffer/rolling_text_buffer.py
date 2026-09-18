"""Step 11: per-session rolling text buffer, split into stable and provisional.

Words only become "stable" (eligible for commit to gloss conversion, Phase 6)
once the buffer exceeds ROLLING_BUFFER_WORDS - below that, the whole buffer
stays provisional while it fills up. Session invalidation on a confirmed seek
(session_state.py, Phase 8) is not wired in yet; clear_session() is exposed
for that later wiring, matching chunker.py's own pattern.
"""

import logging

from backend.config import PROVISIONAL_WORDS, ROLLING_BUFFER_WORDS

logger = logging.getLogger(__name__)

_buffers: dict[str, list[str]] = {}


def append_text(session_id: str, text: str) -> None:
    """Split a new transcribed segment into words and append them to the
    session's buffer."""
    words = text.split()
    if not words:
        return
    _buffers.setdefault(session_id, []).extend(words)


def get_commit_batch(session_id: str) -> dict:
    """Return {stable_words, provisional_context} for the session's current
    buffer, without removing anything yet."""
    words = _buffers.get(session_id, [])
    if len(words) > ROLLING_BUFFER_WORDS:
        split = len(words) - PROVISIONAL_WORDS
        stable, provisional = words[:split], words[split:]
    else:
        stable, provisional = [], list(words)
    return {"stable_words": stable, "provisional_context": provisional}


def advance_commit_boundary(session_id: str, count: int) -> None:
    """Remove the first `count` words from the session's buffer. `count` must
    be the length of stable_words from the get_commit_batch() call that Phase
    6 just successfully processed - passed explicitly rather than recomputed,
    since new words may have arrived in the buffer while that Ollama request
    was in flight and must not be silently swept up or excluded."""
    words = _buffers.get(session_id)
    if not words or count <= 0:
        return
    _buffers[session_id] = words[count:]


def clear_session(session_id: str) -> None:
    """Drop a session's buffer outright (wired in from Phase 8's seek
    invalidation once session_state.py exists)."""
    _buffers.pop(session_id, None)
