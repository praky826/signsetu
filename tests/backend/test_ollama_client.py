"""Phase 17: unit tests for backend/gloss/ollama_client.py (Model 3, Step 12).

Control-flow only: _call_ollama is monkeypatched so these tests do not
depend on Ollama actually being reachable and, per the Real Data Rule, do
not stand in for a real demo transcript - the word tokens used below are
plain control-flow probes, not simulated speech content. The doc's own
instruction to "run the Model 3 prompt against real transcribed fragments
from the demo material" needs the human-supplied real audio fixtures and is
left as a skipped placeholder until then.
"""

import json

import pytest

from backend.buffer import rolling_text_buffer
from backend.gloss import ollama_client
from backend.lookup import cislr_index, dictionary_loader
from backend.session import session_state

SID = "test-session"


@pytest.fixture(autouse=True, scope="module")
def load_lookups():
    dictionary_loader.load()
    cislr_index.build()


@pytest.fixture(autouse=True)
def reset_state():
    rolling_text_buffer._buffers.clear()
    rolling_text_buffer._timestamps.clear()
    session_state._current_session_id = SID
    session_state._frozen = False
    yield
    rolling_text_buffer._buffers.clear()
    rolling_text_buffer._timestamps.clear()
    session_state._current_session_id = None


def test_run_cycle_returns_none_when_no_stable_words():
    assert ollama_client.run_cycle(SID) is None


def test_run_cycle_returns_none_for_stale_session():
    rolling_text_buffer.append_text(SID, "one two three four five six seven", 1.0)
    assert ollama_client.run_cycle("some-other-session") is None


def test_run_cycle_discards_on_malformed_response(monkeypatch):
    rolling_text_buffer.append_text(SID, "one two three four five six seven", 1.0)
    monkeypatch.setattr(ollama_client, "_call_ollama", lambda *a, **kw: "not valid json")

    result = ollama_client.run_cycle(SID)
    assert result is None
    # Fallback E: a discarded cycle must leave the commit boundary untouched
    # so the same stable words retry next cycle.
    batch = rolling_text_buffer.get_commit_batch(SID)
    assert batch["stable_words"] != []


def test_run_cycle_applies_vocab_filter_and_advances_boundary(monkeypatch):
    rolling_text_buffer.append_text(SID, "one two three four five six seven", 1.0)
    real_word = dictionary_loader.keys()[0]
    fake_response = json.dumps({"gloss": [real_word, "NOT_A_REAL_GLOSS_WORD"]})
    monkeypatch.setattr(ollama_client, "_call_ollama", lambda *a, **kw: fake_response)

    result = ollama_client.run_cycle(SID)
    assert result is not None
    words, oldest_timestamp = result
    assert words == [real_word]
    assert oldest_timestamp == 1.0

    batch = rolling_text_buffer.get_commit_batch(SID)
    assert batch["stable_words"] == []


@pytest.mark.skip(
    reason="needs a real transcribed fragment from actual demo material (Real Data Rule)"
)
def test_real_demo_transcript_against_live_ollama():
    pass
