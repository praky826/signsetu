"""Central store for every tunable constant used across the backend.

Every other backend module imports constants from here by name.
Never redefine or hardcode one of these values elsewhere.
"""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Fallback D: chunks scored below this by VAD are dropped before Whisper.
VAD_DISCARD_THRESHOLD = 0.3

# Step 8: chunk segmentation timing.
CHUNK_TARGET_SECONDS = 1.5
CHUNK_HARD_CAP_SECONDS = 2.0
CHUNK_CHECK_INTERVAL_MS = 150

# Step 11: rolling text buffer.
ROLLING_BUFFER_WORDS = 6
PROVISIONAL_WORDS = 2

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
CISLR_DATASET_PATH = BASE_DIR / "assets" / "cislr" / "dataset.csv"
CISLR_CLIPS_DIR = BASE_DIR / "assets" / "cislr" / "clips"
PLACEHOLDER_ASSET_PATH = BASE_DIR / "assets" / "placeholder" / "unknown_word.png"
