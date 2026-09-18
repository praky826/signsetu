"""Model 3 mandatory post-response filter (Fallback E's actual guarantee).

Runs on every Ollama response unconditionally, independent of prompt
compliance and independent of whether JSON parsing succeeded - this is what
makes the vocabulary constraint absolute rather than merely likely.
"""

import logging

logger = logging.getLogger(__name__)


def filter_gloss(gloss_words: list[str], allowed_vocab: set[str], stable_words: list[str]) -> list[str]:
    """Keep only words present (case-insensitively) in allowed_vocab, in order.
    Silently drop and log anything else, along with the stable_words that
    produced it, for later prompt-tuning review. Never raises - an entirely
    invalid input list simply returns an empty list."""
    survivors = []
    for word in gloss_words:
        if word.upper() in allowed_vocab:
            survivors.append(word)
        else:
            logger.warning(
                "vocab_filter: dropped off-vocabulary word %r (stable_words=%r)",
                word, stable_words,
            )
    return survivors
