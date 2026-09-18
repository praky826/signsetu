"""Step 1/13: builds the gloss -> local video-file-path index, once, at startup.

Source is assets/cislr/prototype.csv, not dataset.csv (decision recorded in
docs/implementation.md): prototype.csv is the Hugging Face-provided subset
with exactly one clip per unique gloss, avoiding dataset.csv's up-to-13
duplicate clips per word. prototype.csv has one known malformed row (empty
gloss) which is excluded like any other bad entry.

The index stores a URL path (served via main.py's /assets static mount),
not a filesystem path - confirmed by real testing that the frontend cannot
load a raw Windows path (Chrome refuses file:// resources from an http://
page) - only the on-disk existence check below uses the real filesystem path.
"""

import csv
import logging

from backend.config import CISLR_CLIPS_DIR, CISLR_DATASET_PATH

logger = logging.getLogger(__name__)

_index: dict[str, str] = {}
_built = False


def build() -> bool:
    """Build the gloss -> clip-path index once at startup. An empty result is a
    valid, expected state until real demo-vocabulary clips are cached under
    CISLR_CLIPS_DIR (Real Data Rule) - only an exception counts as failure."""
    global _index, _built
    try:
        built: dict[str, str] = {}
        excluded_bad_gloss = 0
        excluded_not_cached = 0

        with open(CISLR_DATASET_PATH, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                uid = row["uid"].strip()
                gloss = row["gloss"].strip().upper()
                if not gloss:
                    excluded_bad_gloss += 1
                    logger.debug("cislr_index: excluded uid=%s (empty gloss)", uid)
                    continue

                clip_path = CISLR_CLIPS_DIR / f"{uid}.mp4"
                if not clip_path.exists():
                    excluded_not_cached += 1
                    logger.debug("cislr_index: excluded %s (clip not cached: %s)", gloss, clip_path)
                    continue

                built[gloss] = f"/assets/cislr/{CISLR_CLIPS_DIR.name}/{uid}.mp4"

        _index = built
        _built = True
        logger.info(
            "cislr_index: built %d entries (excluded %d bad-gloss rows, %d not yet cached under %s)",
            len(built), excluded_bad_gloss, excluded_not_cached, CISLR_CLIPS_DIR,
        )
        return True
    except Exception:
        logger.exception("cislr_index: failed to build")
        _index = {}
        _built = False
        return False


def get(word: str) -> str | None:
    return _index.get(word.upper())


def keys() -> list[str]:
    return list(_index.keys())


def is_ready() -> bool:
    return _built
