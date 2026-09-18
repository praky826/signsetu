"""Append-only log of every raw Ollama response, for rehearsal-time prompt tuning.

Never overwritten or truncated - always appended to, in both rehearsal and
demo runs.
"""

import json
import time

from backend.config import BASE_DIR

LOG_PATH = BASE_DIR / "backend" / "logs" / "ollama_raw_log.jsonl"


def log_response(stable_words: list[str], provisional_context: list[str], raw_response: str) -> None:
    """Append one entry: timestamp, the input that produced it, and the raw
    (unparsed) response text - successful or not."""
    entry = {
        "timestamp": time.time(),
        "stable_words": stable_words,
        "provisional_context": provisional_context,
        "raw_response": raw_response,
    }
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
