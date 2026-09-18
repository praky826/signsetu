"""Step 13-14, Fallback A: per-word avatar/video/unknown render decision.

Pure and stateless - word, mode, and sessionId in, one render instruction out,
no side effects beyond logging unknown resolutions. Unit-testable in
isolation (Phase 17). Fallback G's latency-degrade override is wired in
(Phase 8): when latency_tracker.should_degrade() is true, mode is forced to
"video" for this call only - the caller's own stored mode setting is never
touched here.

assetRef for the placeholder is a URL path (/assets/placeholder/...), not
PLACEHOLDER_ASSET_PATH's raw filesystem path - confirmed by real testing
(a live capture session) that the frontend cannot load a raw Windows path at
all (Chrome refuses file:// resources from an http://-served page, which
silently broke the entire output window since every unresolved word hit
this same broken path).
"""

import logging

from backend.lookup import cislr_index, dictionary_loader
from backend.monitoring import latency_tracker

logger = logging.getLogger(__name__)

PLACEHOLDER_URL = "/assets/placeholder/unknown_word.png"


def resolve_render(word: str, mode: str, session_id: str) -> dict:
    """Return {word, renderType, assetRef, sessionId}. Never a silent skip -
    an unresolvable word always gets the Fallback A placeholder, logged."""
    if latency_tracker.should_degrade() and mode == "avatar":
        mode = "video"

    hamnosys = dictionary_loader.get(word)
    video_path = cislr_index.get(word)

    if mode == "video":
        if video_path is not None:
            render_type, asset_ref = "video", video_path
        else:
            render_type, asset_ref = "unknown", PLACEHOLDER_URL
    elif mode == "avatar":
        if hamnosys is not None:
            render_type, asset_ref = "avatar", hamnosys
        elif video_path is not None:
            render_type, asset_ref = "video", video_path
        else:
            render_type, asset_ref = "unknown", PLACEHOLDER_URL
    else:
        raise ValueError(f"unknown render mode: {mode!r}")

    if render_type == "unknown":
        logger.info("render_resolver: unresolved word %r (mode=%s, session=%s)", word, mode, session_id)

    return {
        "word": word,
        "renderType": render_type,
        "assetRef": asset_ref,
        "sessionId": session_id,
    }
