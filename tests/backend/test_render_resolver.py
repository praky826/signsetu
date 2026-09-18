"""Phase 17: unit tests for backend/lookup/render_resolver.py.

Uses the real isl_dictionary.json and prototype.csv already fetched under
assets/ (Real Data Rule: no fabricated dictionary/CISLR entries) - "HELLO"
is a real dictionary entry confirmed present. No CISLR clips are cached yet
in this environment, so every video-mode lookup here genuinely falls
through to Fallback A, which is itself real, current system behavior.
"""

import pytest

from backend.lookup import cislr_index, dictionary_loader, render_resolver
from backend.monitoring import latency_tracker


@pytest.fixture(autouse=True, scope="module")
def load_lookups():
    dictionary_loader.load()
    cislr_index.build()


@pytest.fixture(autouse=True)
def reset_latency_window():
    latency_tracker._window.clear()
    yield
    latency_tracker._window.clear()


def test_known_word_avatar_mode_returns_hamnosys():
    result = render_resolver.resolve_render("HELLO", "avatar", "1")
    assert result["renderType"] == "avatar"
    assert result["assetRef"] == dictionary_loader.get("HELLO")
    assert result["sessionId"] == "1"
    assert result["word"] == "HELLO"


def test_unresolvable_word_avatar_mode_falls_back_to_placeholder():
    result = render_resolver.resolve_render("NOTAREALWORDXYZ", "avatar", "1")
    assert result["renderType"] == "unknown"
    assert result["assetRef"] == render_resolver.PLACEHOLDER_URL


def test_video_mode_with_no_cached_clip_falls_back_to_placeholder():
    result = render_resolver.resolve_render("HELLO", "video", "1")
    assert result["renderType"] == "unknown"
    assert result["assetRef"] == render_resolver.PLACEHOLDER_URL


def test_invalid_mode_raises():
    with pytest.raises(ValueError):
        render_resolver.resolve_render("HELLO", "bogus_mode", "1")


def test_latency_degrade_forces_avatar_to_video(monkeypatch):
    monkeypatch.setattr(latency_tracker, "should_degrade", lambda: True)
    result = render_resolver.resolve_render("HELLO", "avatar", "1")
    # HELLO has a hamnosys entry but no cached CISLR clip - if the degrade
    # override had not forced mode to "video" first, this would resolve to
    # "avatar" instead of falling through to the placeholder.
    assert result["renderType"] == "unknown"
