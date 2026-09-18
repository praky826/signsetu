"""Phase 17: unit tests for backend/audio/vad.py (Model 2, silero-vad).

Silence (an all-zeros buffer) is used for the negative-case tests, mirroring
vad.init()'s own warm-up self-test - it is a numeric edge case, not
fabricated speech content. Positive "this really is speech" cases require a
real recorded voice sample and are skipped until one is supplied under
tests/fixtures/sample_audio/ (Real Data Rule: never fabricate demo audio).
"""

from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from backend.audio import vad
from backend.config import SAMPLE_RATE, VAD_FRAME_SAMPLES

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "sample_audio"
SPEECH_FIXTURES = list(FIXTURE_DIR.glob("*.wav")) if FIXTURE_DIR.exists() else []


@pytest.fixture(autouse=True, scope="module")
def loaded_model():
    assert vad.init(), "silero-vad failed to initialize"


def test_silence_has_low_speech_probability():
    silence = np.zeros(VAD_FRAME_SAMPLES * 4, dtype=np.float32)
    assert vad.score_speech_probability(silence) < 0.3


def test_silence_yields_a_silence_cut_point():
    silence = np.zeros(VAD_FRAME_SAMPLES * 4, dtype=np.float32)
    offset = vad.find_silence_point(silence)
    assert offset is not None
    assert offset % VAD_FRAME_SAMPLES == 0


def test_shorter_than_one_frame_yields_no_cut_point():
    tiny = np.zeros(VAD_FRAME_SAMPLES - 1, dtype=np.float32)
    assert vad.find_silence_point(tiny) is None


def test_empty_buffer_has_zero_speech_probability():
    assert vad.score_speech_probability(np.zeros(0, dtype=np.float32)) == 0.0


@pytest.mark.skipif(
    not SPEECH_FIXTURES,
    reason="no real speech fixture under tests/fixtures/sample_audio/ yet",
)
def test_real_speech_fixture_scores_as_speech():
    audio, sr = sf.read(SPEECH_FIXTURES[0], dtype="float32")
    assert sr == SAMPLE_RATE, "fixture must be captured/resampled to SAMPLE_RATE"
    assert vad.score_speech_probability(audio) > 0.5
