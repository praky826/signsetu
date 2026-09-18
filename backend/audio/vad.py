"""Model 2 (silero-vad): loads once at startup, CPU-only.

Both responsibilities (Phase 4, complete): find_silence_point() for Step 8's
chunk-boundary snapping, and score_speech_probability() for Fallback D's
pre-Whisper hallucination gate. Both share the single module-level instance
loaded in init() (Phase 3) — never instantiated twice.
"""

import logging

import numpy as np
import torch
from silero_vad import load_silero_vad

from backend.config import SAMPLE_RATE, SILENCE_CUT_THRESHOLD, VAD_FRAME_SAMPLES

logger = logging.getLogger(__name__)

_model = None


def init() -> bool:
    """Load the silero-vad ONNX model on CPU and confirm it responds."""
    global _model
    try:
        model = load_silero_vad()
        silent_audio = torch.from_numpy(np.zeros(VAD_FRAME_SAMPLES, dtype=np.float32))
        model(silent_audio, SAMPLE_RATE)
        _model = model
        logger.info("vad: ready (cpu)")
        return True
    except Exception:
        logger.exception("vad: failed to initialize")
        _model = None
        return False


def is_ready() -> bool:
    return _model is not None


def _frame_probabilities(audio: np.ndarray) -> list[float]:
    """Score consecutive, non-overlapping VAD_FRAME_SAMPLES-sized frames.
    Any leftover samples shorter than one frame at the end are dropped -
    the installed silero-vad build only accepts exactly VAD_FRAME_SAMPLES."""
    probs = []
    frame_count = len(audio) // VAD_FRAME_SAMPLES
    for i in range(frame_count):
        frame = audio[i * VAD_FRAME_SAMPLES : (i + 1) * VAD_FRAME_SAMPLES]
        tensor = torch.from_numpy(frame.astype(np.float32))
        probs.append(_model(tensor, SAMPLE_RATE).item())
    return probs


def find_silence_point(buffer_tail: np.ndarray) -> int | None:
    """Search buffer_tail (the most recent portion of the session's buffer) for
    the quietest frame. Returns the sample offset, within buffer_tail, where a
    cut should snap to, or None if nothing in the window is silent enough."""
    probs = _frame_probabilities(buffer_tail)
    if not probs:
        return None
    min_index = min(range(len(probs)), key=lambda i: probs[i])
    if probs[min_index] <= SILENCE_CUT_THRESHOLD:
        return min_index * VAD_FRAME_SAMPLES
    return None


def score_speech_probability(chunk: np.ndarray) -> float:
    """Aggregate per-frame speech probability across the whole chunk via max -
    if any frame looks like speech, the chunk should still reach Whisper;
    only chunks with no speech-like frame at all should be discarded."""
    probs = _frame_probabilities(chunk)
    if not probs:
        return 0.0
    return max(probs)
