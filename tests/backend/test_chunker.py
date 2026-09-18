"""Phase 17: unit tests for backend/audio/chunker.py (Step 8, Fallback D).

Uses silence (zeros) to exercise the buffer-arithmetic and VAD-discard paths
without needing real speech audio - a genuinely speech-bearing chunk making
it past the discard threshold and onto chunk_queue can only be verified with
a real recorded sample (see test_vad.py's skipped fixture case), so that
path is not asserted here.
"""

import numpy as np
import pytest

from backend.audio import chunker, vad
from backend.config import CHUNK_HARD_CAP_SECONDS, CHUNK_TARGET_SECONDS, SAMPLE_RATE

SID = "test-session"


@pytest.fixture(autouse=True, scope="module")
def loaded_model():
    assert vad.init(), "silero-vad failed to initialize"


@pytest.fixture(autouse=True)
def reset_chunker_state():
    chunker._buffers.clear()
    while not chunker.chunk_queue.empty():
        chunker.chunk_queue.get_nowait()
    yield
    chunker._buffers.clear()


def test_append_audio_concatenates():
    chunker.append_audio(SID, np.zeros(100, dtype=np.float32))
    chunker.append_audio(SID, np.zeros(50, dtype=np.float32))
    assert len(chunker._buffers[SID]) == 150


def test_clear_session_drops_buffer():
    chunker.append_audio(SID, np.zeros(100, dtype=np.float32))
    chunker.clear_session(SID)
    assert SID not in chunker._buffers


def test_below_target_is_not_processed():
    below_target = int(CHUNK_TARGET_SECONDS * SAMPLE_RATE) - 1
    chunker.append_audio(SID, np.zeros(below_target, dtype=np.float32))
    chunker._process_session(SID)
    assert len(chunker._buffers[SID]) == below_target
    assert chunker.chunk_queue.empty()


def test_silent_chunk_at_hard_cap_is_cut_and_discarded():
    cap_samples = int(CHUNK_HARD_CAP_SECONDS * SAMPLE_RATE)
    chunker.append_audio(SID, np.zeros(cap_samples, dtype=np.float32))
    chunker._process_session(SID)
    # the cap-sized segment was cut off the front of the buffer...
    assert len(chunker._buffers[SID]) == 0
    # ...but never queued, since silence scores below VAD_DISCARD_THRESHOLD.
    assert chunker.chunk_queue.empty()


def test_silent_chunk_between_target_and_cap_is_cut_at_silence_point():
    between = int(CHUNK_TARGET_SECONDS * SAMPLE_RATE) + 100
    chunker.append_audio(SID, np.zeros(between, dtype=np.float32))
    chunker._process_session(SID)
    # an all-silent tail should always yield a silence-point cut, so the
    # buffer should shrink even though nothing reaches the queue.
    assert len(chunker._buffers[SID]) < between
    assert chunker.chunk_queue.empty()
