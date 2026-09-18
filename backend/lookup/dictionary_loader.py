"""Step 1/13, Fallback F: loads isl_dictionary.json, validates HamNoSys entries.

isl_dictionary.json is keyed by lowercase English word, each value
{"gloss": "UPPERCASE_GLOSS", "hamnosys": "hamtoken hamtoken ..."} (confirmed
shape, Phase 2 — not a flat {gloss: hamnosys} map). This module re-indexes
by gloss and validates every HamNoSys string's tokens against the known
token set mirrored from hamnosysMap.js's HAMNOSYS_ACTIONS keys (confirmed,
Phase 2), excluding entries with any unrecognized token (Fallback F).
"""

import json
import logging

from backend.config import ISL_DICTIONARY_PATH

logger = logging.getLogger(__name__)

# Mirrors hamnosysMap.js's HAMNOSYS_ACTIONS keys exactly (frontend/vendor/hamnosysMap.js,
# confirmed Phase 2) — 7 hand shapes, 5 palm orientations, 4 body locations,
# 4 movement aliases, 1 reset.
KNOWN_HAMNOSYS_TOKENS = frozenset({
    "hamflathand", "hamfist", "hamindex", "hamfinger2", "hampinch", "hamthumbup", "hamcee",
    "hampalmd", "hampalmu", "hampalml", "hampalmr", "hampalmf",
    "hamchest", "hamchin", "hamhead", "hamstomach",
    "hammoveforward", "hammoveback", "hammoveup", "hammovedown",
    "hamrest",
})

_dictionary: dict[str, str] = {}


def load() -> bool:
    """Load and validate the dictionary once at startup."""
    global _dictionary
    try:
        with open(ISL_DICTIONARY_PATH, encoding="utf-8") as f:
            raw = json.load(f)

        validated: dict[str, str] = {}
        excluded: list[tuple[str, str]] = []

        for entry in raw.values():
            gloss = entry["gloss"].upper()
            hamnosys = entry["hamnosys"]
            tokens = hamnosys.split()
            bad_tokens = [t for t in tokens if t not in KNOWN_HAMNOSYS_TOKENS]
            if bad_tokens:
                excluded.append((gloss, f"unknown token(s): {bad_tokens}"))
                continue
            validated[gloss] = hamnosys

        _dictionary = validated
        logger.info("dictionary_loader: loaded %d entries, excluded %d", len(validated), len(excluded))
        for gloss, reason in excluded:
            logger.warning("dictionary_loader: excluded %s (%s)", gloss, reason)
        return True
    except Exception:
        logger.exception("dictionary_loader: failed to load")
        _dictionary = {}
        return False


def get(word: str) -> str | None:
    return _dictionary.get(word.upper())


def keys() -> list[str]:
    return list(_dictionary.keys())


def is_ready() -> bool:
    return len(_dictionary) > 0
