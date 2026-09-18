"""Model 1 (faster-whisper): loads once at startup, transcribes chunks (Step 10)."""

import logging

import numpy as np
from faster_whisper import WhisperModel

from backend.config import WHISPER_COMPUTE_TYPE, WHISPER_DEVICE, WHISPER_MODEL_SIZE

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
