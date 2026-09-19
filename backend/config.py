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
# Fallback E's own documented retry behavior (leave stable_words uncommitted
# and resend on the next cycle) has no ceiling on its own - found via a real
# capture session that once Ollama starts failing every cycle (e.g. the
# allowed_vocab bloat above), stable_words grows without bound forever,
# guaranteeing every future prompt is at least as large as the last and
# permanently deadlocking the pipeline. This caps how many of the oldest
# stable words are kept once a backlog builds up; anything older is dropped
# (logged) rather than resent indefinitely. Not in the original docs - added
# and confirmed with you after diagnosing this exact deadlock.
# Lowered from 30 to 20 after a real capture session showed even 30-word
# bursts overwhelming the frontend's 4-item render queue (renderQueue.js's
# MAX_QUEUE_LENGTH), causing wholesale drops that swallowed avatar-tagged
# words along with the video-tagged ones - a smaller cap means a smaller
# burst per cycle, giving more of it an actual chance to reach the screen.
MAX_STABLE_WORDS = 20

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
# Raised from 6.5 (Phase 17 default) after a real capture session showed the
# 6.5s threshold degrading avatar->video 100% of the time on this hardware
# (Whisper small + a 3B Ollama model + Three.js sharing one RTX 3050) -
# tuned against that observed behavior, per your own choice to accept more
# visible lag in exchange for avatar mode actually running.
LATENCY_DEGRADE_THRESHOLD_SECONDS = 11.0
LATENCY_WINDOW_SIZE = 8

# Fallback H: seek debounce.
SEEK_DEBOUNCE_MS = 175

# Model 1 (faster-whisper). SignSetu.docx explicitly sanctions this fallback
# ("small (or base if small is too slow on your hardware)") - switched after
# a real capture session showed Whisper consistently falling behind
# real-time audio (a growing backlog of queued "Processing audio" chunks in
# the log), which was the dominant contributor to Fallback G's latency
# degrade firing continuously even after raising its threshold once already.
WHISPER_MODEL_SIZE = "base"
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
# The raw downloaded clips (assets/cislr/clips/) are mpeg4-coded and cannot
# be decoded by Chrome's <video> element (confirmed via ffprobe and a real
# browser test showing a black output box) - cislr_index.py reads from this
# H.264/AAC re-encoded copy instead (scripts/transcode_cislr_clips.py),
# leaving the raw originals untouched.
CISLR_CLIPS_DIR = BASE_DIR / "assets" / "cislr" / "clips_h264"
PLACEHOLDER_ASSET_PATH = BASE_DIR / "assets" / "placeholder" / "unknown_word.png"
