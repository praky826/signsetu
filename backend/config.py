"""Central store for every tunable constant used across the backend.

Every other backend module imports constants from here by name.
Never redefine or hardcode one of these values elsewhere.
"""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Step 7: fixed audio sample rate required by Whisper and silero-vad alike.
SAMPLE_RATE = 16000

# Fallback D: chunks scored below this by VAD are dropped before Whisper.
VAD_DISCARD_THRESHOLD = 0.3

# Step 8: chunk segmentation timing.
CHUNK_TARGET_SECONDS = 1.5
CHUNK_HARD_CAP_SECONDS = 2.0
CHUNK_CHECK_INTERVAL_MS = 150

# Step 8: silence-point search, off the shared VAD instance (Phase 4).
# VAD_FRAME_SAMPLES is fixed by the installed silero-vad build itself (confirmed by direct
# test, Phase 4: only exactly 512 samples at 16kHz is accepted) - not a free judgment call,
# but kept here rather than hardcoded per the "every tunable lives in config.py" rule.
VAD_FRAME_SAMPLES = 512
# How far back from the chunk's current tail to search for a silence frame once
# CHUNK_TARGET_SECONDS is reached, per Step 8's "within roughly the last few hundred
# milliseconds" - not a named constant in the docs; picked within that stated range.
SILENCE_SEARCH_WINDOW_MS = 300
# Frame speech-probability below this counts as "silent enough" to snap a cut boundary
# to. Deliberately stricter than VAD_DISCARD_THRESHOLD, which judges a whole ~2s chunk's
# worth-transcribing-at-all - a good cut point should be closer to true silence than that.
SILENCE_CUT_THRESHOLD = 0.15

# Step 11: rolling text buffer.
ROLLING_BUFFER_WORDS = 6
PROVISIONAL_WORDS = 2

# Step 12: how often connection.py's render loop attempts a gloss cycle for the
# current session - not a named constant in the docs; matches the System Architecture
# text's own "roughly every ~1.5-2s, matching the chunk rate" description. Added Phase 9,
# once an actual loop calling ollama_client.run_cycle() was needed to complete the pipeline.
GLOSS_CYCLE_INTERVAL_MS = 1500

# Model 3 (Ollama).
OLLAMA_HOST_URL = "http://localhost:11434"
OLLAMA_MODEL_NAME = "llama3.2:3b"
OLLAMA_TEMPERATURE = 0.15
OLLAMA_MAX_TOKENS = 128

# Fallback G: latency monitoring / degrade.
LATENCY_TARGET_SECONDS = 5
LATENCY_DEGRADE_THRESHOLD_SECONDS = 6.5
LATENCY_WINDOW_SIZE = 8

# Fallback H: seek debounce.
SEEK_DEBOUNCE_MS = 175

# Model 1 (faster-whisper).
WHISPER_MODEL_SIZE = "small"
WHISPER_BEAM_SIZE = 1
WHISPER_LANGUAGE = "en"
WHISPER_COMPUTE_TYPE = "float16"
WHISPER_DEVICE = "cuda"

# Static asset paths.
ISL_DICTIONARY_PATH = BASE_DIR / "assets" / "isl_dictionary.json"
# Points at prototype.csv, not dataset.csv: prototype.csv is the Hugging Face-provided
# subset with exactly one clip per unique gloss (see docs/implementation.md). dataset.csv
# remains on disk as the full reference set but is not read by cislr_index.py.
CISLR_DATASET_PATH = BASE_DIR / "assets" / "cislr" / "prototype.csv"
CISLR_CLIPS_DIR = BASE_DIR / "assets" / "cislr" / "clips"
PLACEHOLDER_ASSET_PATH = BASE_DIR / "assets" / "placeholder" / "unknown_word.png"
