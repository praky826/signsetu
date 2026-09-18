"""Fallback G: rolling per-word end-to-end latency, triggers video-only degrade.

Timestamps come from chunk creation (chunker.py, Phase 4) and final render
dispatch (Phase 9, not built yet - record_latency() has no caller until then).
"""

from backend.config import LATENCY_DEGRADE_THRESHOLD_SECONDS, LATENCY_WINDOW_SIZE

_window: list[float] = []


def record_latency(chunk_created_at: float, dispatched_at: float) -> None:
    """Append one word's end-to-end latency to the rolling window, dropping
    the oldest entry once the window is full."""
    latency = dispatched_at - chunk_created_at
    _window.append(latency)
    if len(_window) > LATENCY_WINDOW_SIZE:
        _window.pop(0)


def average_latency() -> float:
    if not _window:
        return 0.0
    return sum(_window) / len(_window)


def should_degrade() -> bool:
    """True once the rolling average exceeds the threshold. Reverts to False
    automatically as soon as the average drops back under it - no manual
    reset, since this is computed fresh from the window on every call."""
    return average_latency() > LATENCY_DEGRADE_THRESHOLD_SECONDS
