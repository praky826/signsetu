"""Phase 17: unit tests for backend/transcription/whisper_service.py (Model 1).

Silence (zeros) mirrors whisper_service.init()'s own warm-up call and is
used only to confirm transcribe() runs and yields no text for non-speech
input. A real transcription check requires a real recorded voice sample and
is skipped until one is supplied under tests/fixtures/sample_audio/ (Real
Data Rule).
"""

from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from backend.config import SAMPLE_RATE
from backend.transcription import whisper_service

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "sample_audio"
SPEECH_FIXTURES = list(FIXTURE_DIR.glob("*.wav")) if FIXTURE_DIR.exists() else []


@pytest.fixture(autouse=True, scope="module")
def loaded_model():
    assert whisper_service.init(), "faster-whisper failed to initialize"


def test_silence_transcribes_to_empty_text():
    silence = np.zeros(SAMPLE_RATE, dtype=np.float32)
    assert whisper_service.transcribe(silence) == ""


@pytest.mark.skipif(
    not SPEECH_FIXTURES,
    reason="no real speech fixture under tests/fixtures/sample_audio/ yet",
)
def test_real_speech_fixture_produces_nonempty_text():
    audio, sr = sf.read(SPEECH_FIXTURES[0], dtype="float32")
    assert sr == SAMPLE_RATE, "fixture must be captured/resampled to SAMPLE_RATE"
    text = whisper_service.transcribe(audio)
    assert text.strip() != ""
