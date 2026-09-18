"""Phase 17: unit tests for backend/session/session_state.py.

Pure state-machine logic, no audio/model dependency - every case here is
constructed from plain sessionId strings, not real or fabricated demo data.
"""

import pytest

from backend.session import session_state


@pytest.fixture(autouse=True)
def reset_state():
    session_state._current_session_id = None
    session_state._frozen = False
    yield
    session_state._current_session_id = None
    session_state._frozen = False


def test_initial_state():
    assert session_state.get_current_session_id() is None
    assert not session_state.is_frozen()


def test_increment_session_sets_current():
    session_state.increment_session("1")
    assert session_state.get_current_session_id() == "1"
    assert session_state.is_current("1")
    assert not session_state.is_current("2")


def test_increment_session_clears_old_buffers(monkeypatch):
    cleared = []
    monkeypatch.setattr(
        "backend.audio.chunker.clear_session", lambda sid: cleared.append(("chunker", sid))
    )
    monkeypatch.setattr(
        "backend.buffer.rolling_text_buffer.clear_session", lambda sid: cleared.append(("buffer", sid))
    )
    session_state.increment_session("1")
    session_state.increment_session("2")
    assert ("chunker", "1") in cleared
    assert ("buffer", "1") in cleared


def test_freeze_then_resume_same_session_does_not_increment():
    session_state.increment_session("1")
    session_state.freeze_session()
    assert session_state.is_frozen()

    session_state.resume_session()
    assert not session_state.is_frozen()
    assert session_state.get_current_session_id() == "1"


def test_resume_with_new_session_id_increments():
    session_state.increment_session("1")
    session_state.freeze_session()

    session_state.resume_session("2")
    assert session_state.get_current_session_id() == "2"
    assert not session_state.is_frozen()


def test_resume_with_same_session_id_does_not_reincrement(monkeypatch):
    calls = []
    monkeypatch.setattr(session_state, "increment_session", lambda sid: calls.append(sid))
    session_state._current_session_id = "1"
    session_state.resume_session("1")
    assert calls == []
