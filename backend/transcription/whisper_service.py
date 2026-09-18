"""Model 1 (faster-whisper): loads once at startup, transcribes chunks (Step 10).

run_loop() is the dedicated worker pulling speech-confirmed chunks from
chunker.chunk_queue in strict arrival order and pushing transcribed text into
rolling_text_buffer.py. Discarding stale-session chunks (session_state.py,
Phase 8) is not wired in yet - every chunk on the queue is transcribed.
"""

import logging

import numpy as np
from faster_whisper import WhisperModel

from backend.audio import chunker
from backend.buffer import rolling_text_buffer
from backend.config import WHISPER_BEAM_SIZE, WHISPER_COMPUTE_TYPE, WHISPER_DEVICE, WHISPER_LANGUAGE, WHISPER_MODEL_SIZE

logger = logging.getLogger(__name__)

_model: WhisperModel | None = None


def init() -> bool:
    """Load the faster-whisper model into GPU memory once and force a throwaway
    inference call so weights are fully resident before the first real request."""
    global _model
    try:
        _model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
        )
        silent_audio = np.zeros(16000, dtype=np.float32)
        list(_model.transcribe(silent_audio, language="en", task="transcribe")[0])
        logger.info("whisper_service: ready (%s, %s, %s)", WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE)
        return True
    except Exception:
        logger.exception("whisper_service: failed to initialize")
        _model = None
        return False


def is_ready() -> bool:
    return _model is not None


def transcribe(chunk_audio: np.ndarray) -> str:
    """Transcribe exactly the audio given, nothing more - no batching, no
    waiting to accumulate more audio. Only .text is consumed; timestamps and
    confidence are available on the segment objects for debugging only."""
    segments, _ = _model.transcribe(
        chunk_audio,
        language=WHISPER_LANGUAGE,
        task="transcribe",
        beam_size=WHISPER_BEAM_SIZE,
    )
    return "".join(segment.text for segment in segments).strip()


async def run_loop() -> None:
    """Background task: pulls one chunk at a time from chunker.chunk_queue,
    transcribes it, and appends the result to rolling_text_buffer.py. Chunks
    whose sessionId is no longer current are discarded without transcribing.
    transcribe() runs in a worker thread (Phase 9 fix) so a several-hundred-ms
    GPU call never blocks this event loop - and therefore never blocks audio
    ingestion or chunking, which share the loop - matching the architecture's
    "chunk N+1 recording continues while chunk N is being transcribed" intent."""
    import asyncio

    from backend.session import session_state

    while True:
        chunk = await chunker.chunk_queue.get()
        if not session_state.is_current(chunk["sessionId"]):
            logger.debug("whisper_service: discarded stale-session chunk (session %s)", chunk["sessionId"])
            continue

        text = await asyncio.to_thread(transcribe, chunk["audioData"])
        if text:
            rolling_text_buffer.append_text(chunk["sessionId"], text, chunk["timestamp"])
        else:
            logger.debug("whisper_service: empty transcription for session %s", chunk["sessionId"])
