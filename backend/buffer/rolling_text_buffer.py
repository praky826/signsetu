"""Step 11: per-session rolling text buffer, split into stable and provisional.

Words only become "stable" (eligible for commit to gloss conversion, Phase 6)
once the buffer exceeds ROLLING_BUFFER_WORDS - below that, the whole buffer
stays provisional while it fills up. Session invalidation on a confirmed seek
(session_state.py, Phase 8) is not wired in yet; clear_session() is exposed
for that later wiring, matching chunker.py's own pattern.

Alongside each word, the creation timestamp of the chunk that produced it is
tracked in a parallel list (added later, once Fallback G's latency wiring was
found to have no other way to associate a rendered word with its originating
chunk - see get_commit_batch()'s stable_timestamps field). This is a per-chunk
approximation, not a true per-word timestamp: every word transcribed from one
chunk shares that chunk's single creation time, which is the finest
granularity actually available once text has been split into words.
"""

import logging

from backend.config import MAX_STABLE_WORDS, PROVISIONAL_WORDS, ROLLING_BUFFER_WORDS

logger = logging.getLogger(__name__)

_buffers: dict[str, list[str]] = {}
_timestamps: dict[str, list[float]] = {}


def append_text(session_id: str, text: str, chunk_timestamp: float) -> None:
    """Split a new transcribed segment into words and append them to the
    session's buffer, tagging each word with its originating chunk's creation
    timestamp (Fallback G)."""
    words = text.split()
    if not words:
        return
    _buffers.setdefault(session_id, []).extend(words)
    _timestamps.setdefault(session_id, []).extend([chunk_timestamp] * len(words))


def get_commit_batch(session_id: str) -> dict:
    """Return {stable_words, provisional_context, stable_timestamps} for the
    session's current buffer. stable_timestamps is aligned index-for-index
    with stable_words and is not part of the frozen Ollama request shape -
    callers building that request must only use stable_words/
    provisional_context, per docs/implementation.md section 2.

    If a backlog of failed cycles has pushed the stable portion past
    MAX_STABLE_WORDS, the oldest overflow is dropped here and now (removed
    from the buffer outright, not just excluded from this batch) - otherwise
    a stretch of Ollama failures would let stable_words grow forever with no
    way to recover (found via a real capture session)."""
    words = _buffers.get(session_id, [])
    timestamps = _timestamps.get(session_id, [])
    if len(words) > ROLLING_BUFFER_WORDS:
        split = len(words) - PROVISIONAL_WORDS
        stable, provisional = words[:split], words[split:]
        stable_timestamps = timestamps[:split]

        if len(stable) > MAX_STABLE_WORDS:
            overflow = len(stable) - MAX_STABLE_WORDS
            logger.warning(
                "rolling_text_buffer: dropping %d oldest stable word(s) for session %s (backlog cap): %r",
                overflow, session_id, stable[:overflow],
            )
            _buffers[session_id] = words[overflow:]
            _timestamps[session_id] = timestamps[overflow:]
            stable = stable[overflow:]
            stable_timestamps = stable_timestamps[overflow:]
    else:
        stable, provisional = [], list(words)
        stable_timestamps = []
    return {
        "stable_words": stable,
        "provisional_context": provisional,
        "stable_timestamps": stable_timestamps,
    }


def advance_commit_boundary(session_id: str, count: int) -> None:
    """Remove the first `count` words (and their timestamps) from the
    session's buffer. `count` must be the length of stable_words from the
    get_commit_batch() call that Phase 6 just successfully processed - passed
    explicitly rather than recomputed, since new words may have arrived in
    the buffer while that Ollama request was in flight and must not be
    silently swept up or excluded."""
    words = _buffers.get(session_id)
    if not words or count <= 0:
        return
    _buffers[session_id] = words[count:]
    _timestamps[session_id] = _timestamps.get(session_id, [])[count:]


def clear_session(session_id: str) -> None:
    """Drop a session's buffer outright (wired in from Phase 8's seek
    invalidation once session_state.py exists)."""
    _buffers.pop(session_id, None)
    _timestamps.pop(session_id, None)
