"""Step 8, Fallback D: per-session rolling PCM buffer, cut into VAD-aligned
chunks, non-speech chunks dropped before ever reaching the transcription queue.

Runs entirely backend-side (confirmed unambiguous by SignSetu.docx Step 8,
which overrides the phase-wise doc's own hedge on this point) via run_loop(),
an asyncio background task started by Phase 9's main.py once the WebSocket
route exists. Session invalidation against a "currently active" session
(session_state.py) is a Phase 8 concern, not yet wired in here.
"""

import asyncio
import logging
import time

import numpy as np

from backend.audio import vad
from backend.config import (
    CHUNK_CHECK_INTERVAL_MS,
    CHUNK_HARD_CAP_SECONDS,
    CHUNK_TARGET_SECONDS,
    SAMPLE_RATE,
    SILENCE_SEARCH_WINDOW_MS,
    VAD_DISCARD_THRESHOLD,
)

logger = logging.getLogger(__name__)

_TARGET_SAMPLES = int(CHUNK_TARGET_SECONDS * SAMPLE_RATE)
_CAP_SAMPLES = int(CHUNK_HARD_CAP_SECONDS * SAMPLE_RATE)
_SEARCH_WINDOW_SAMPLES = int(SILENCE_SEARCH_WINDOW_MS / 1000 * SAMPLE_RATE)

_buffers: dict[str, np.ndarray] = {}
chunk_queue: asyncio.Queue = asyncio.Queue()


def append_audio(session_id: str, pcm: np.ndarray) -> None:
    """Append newly-arrived raw float32 PCM to a session's rolling buffer,
    creating the buffer on first use."""
    existing = _buffers.get(session_id)
    _buffers[session_id] = pcm.copy() if existing is None else np.concatenate([existing, pcm])


def clear_session(session_id: str) -> None:
    """Drop a session's buffer outright (wired in from Phase 8's seek
    invalidation once session_state.py exists)."""
    _buffers.pop(session_id, None)


def _cut_and_emit(session_id: str, cut_index: int) -> None:
    buffer = _buffers[session_id]
    segment, leftover = buffer[:cut_index], buffer[cut_index:]
    _buffers[session_id] = leftover

    score = vad.score_speech_probability(segment)
    if score < VAD_DISCARD_THRESHOLD:
        logger.debug("chunker: dropped chunk for session %s (speech score %.3f)", session_id, score)
        return

    chunk_queue.put_nowait({
        "audioData": segment,
        "sessionId": session_id,
        "timestamp": time.time(),
    })


def _process_session(session_id: str) -> None:
    while len(_buffers[session_id]) >= _TARGET_SAMPLES:
        buffer_len = len(_buffers[session_id])
        if buffer_len >= _CAP_SAMPLES:
            _cut_and_emit(session_id, _CAP_SAMPLES)
            continue

        window_start = max(0, buffer_len - _SEARCH_WINDOW_SAMPLES)
        tail = _buffers[session_id][window_start:]
        offset = vad.find_silence_point(tail)
        if offset is None:
            break  # not silent yet and not at cap - wait for more audio
        _cut_and_emit(session_id, window_start + offset)


async def run_loop() -> None:
    """Background task: checks every session's buffer every
    CHUNK_CHECK_INTERVAL_MS and cuts chunks as they become ready. Buffers
    for a session that session_state.py no longer considers current are
    dropped outright rather than processed further."""
    from backend.session import session_state

    interval = CHUNK_CHECK_INTERVAL_MS / 1000
    while True:
        for session_id in list(_buffers.keys()):
            if not session_state.is_current(session_id):
                clear_session(session_id)
                continue
            _process_session(session_id)
        await asyncio.sleep(interval)
