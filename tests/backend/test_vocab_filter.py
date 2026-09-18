"""Phase 17: unit tests for backend/gloss/vocab_filter.py.

Fallback E's mandatory filter must run on every response unconditionally -
these cases cover off-vocabulary words, case differences, and malformed
input, per the phase-wise doc's own instruction for this file.
"""

from backend.gloss import vocab_filter

ALLOWED = {"HELLO", "THANK", "SCHOOL", "GO"}


def test_keeps_only_allowed_words_in_order():
    result = vocab_filter.filter_gloss(["HELLO", "SCHOOL"], ALLOWED, ["hello", "school"])
    assert result == ["HELLO", "SCHOOL"]


def test_drops_off_vocabulary_words():
    result = vocab_filter.filter_gloss(["HELLO", "BANANA", "GO"], ALLOWED, ["hello", "banana", "go"])
    assert result == ["HELLO", "GO"]


def test_case_insensitive_match_against_allowed_vocab():
    result = vocab_filter.filter_gloss(["hello", "Go"], ALLOWED, ["hello", "go"])
    assert result == ["hello", "Go"]


def test_empty_gloss_list_returns_empty():
    assert vocab_filter.filter_gloss([], ALLOWED, ["hello"]) == []


def test_all_off_vocabulary_returns_empty():
    result = vocab_filter.filter_gloss(["BANANA", "APPLE"], ALLOWED, ["hello"])
    assert result == []


def test_does_not_raise_on_empty_allowed_vocab():
    assert vocab_filter.filter_gloss(["HELLO"], set(), ["hello"]) == []
