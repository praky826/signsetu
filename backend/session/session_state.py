"""Step 18, Fallback C/H: single source of truth for the current sessionId.

Every backend stage consults is_current() before queuing or emitting work,
rather than keeping its own separate notion of "current session" (chunker.py,
whisper_service.py, ollama_client.py, connection.py all wired in this phase).

This app has one active capture session at a time (a single Chrome tab
share), so state is tracked globally rather than per-connection-object -
"per connection" in the docs collapses to this single current session in
practice, consistent with how session_id is already used as a flat string
key throughout chunker.py and rolling_text_buffer.py.
"""

import logging

logger = logging.getLogger(__name__)

_current_session_id: str | None = None
_frozen = False


def start_session(session_id: str) -> None:
    """Called on a new WebSocket connection's first message, establishing the
    initial sessionId for that connection."""
    global _current_session_id, _frozen
    _current_session_id = session_id
    _frozen = False
    logger.info("session_state: started session %s", session_id)


def increment_session(new_session_id: str) -> None:
    """Called on a confirmed seek relayed from the frontend. Clears the old
    session's buffers in chunker.py and rolling_text_buffer.py and adopts the
    new sessionId as current."""
    global _current_session_id, _frozen
    # deferred imports: chunker.py and connection.py both consult this module,
    # so importing them at module load time would create an import cycle.
    from backend.audio import chunker
    from backend.buffer import rolling_text_buffer

    old_session_id = _current_session_id
    if old_session_id is not None:
        chunker.clear_session(old_session_id)
        rolling_text_buffer.clear_session(old_session_id)
    _current_session_id = new_session_id
    _frozen = False
    logger.info("session_state: incremented session %s -> %s", old_session_id, new_session_id)


def freeze_session() -> None:
    """Called on stream loss (Fallback C). Halts processing for this
    connection without incrementing sessionId or clearing buffers, since
    reconnecting to the same content is expected."""
    global _frozen
    _frozen = True
    logger.info("session_state: frozen (session %s)", _current_session_id)


def resume_session(new_session_id: str | None = None) -> None:
    """Called on reconnect after a freeze. If new_session_id is given, a
    genuinely new stream was established - full reset via increment_session().
    If omitted, this is a mere reconnect to the same content - just clears
    the frozen flag, keeping the existing sessionId and buffers intact."""
    global _frozen
    if new_session_id is not None and new_session_id != _current_session_id:
        increment_session(new_session_id)
    else:
        _frozen = False
        logger.info("session_state: resumed (unfrozen) session %s", _current_session_id)


def is_current(session_id: str) -> bool:
    return session_id == _current_session_id


def is_frozen() -> bool:
    return _frozen


def get_current_session_id() -> str | None:
    return _current_session_id
