"""Model 3 (Ollama): the system prompt and few-shot examples.

Originally copied verbatim from AI_Model_Specification_Document.docx (Model
3 section). Deliberately deviated from that source as of this version: the
original prompt required every output word to match an "allowed_vocab" list
sent in the request. Once real CISLR clips were cached, that list grew to
~5000 words, which confirmed (via direct testing against the live model)
caused it to collapse to an empty "{}" response regardless of input size -
a 3B model cannot reliably hold a vocabulary list that large in its prompt.
Per your explicit direction, the vocabulary constraint has been removed
from the prompt entirely: Ollama now only normalizes/reorders words, with
no awareness of what is actually renderable. vocab_filter.py's own
post-hoc check (backend/gloss/ollama_client.py's run_cycle()) is now the
sole gate on renderability, checked against the full dictionary + CISLR
vocabulary - a plain in-memory set lookup with no prompt-size cost, so it
scales to any vocabulary size. This trade-off and the decision to deviate
from the source document are recorded in docs/implementation.md.
"""

SYSTEM_PROMPT = """You are a gloss-conversion component in a real-time speech-to-sign-language pipeline. You convert English words into Indian Sign Language (ISL) gloss notation.

RULES YOU MUST FOLLOW EXACTLY:
1. You will receive a JSON input with two fields: "stable_words" (words you must gloss) and "provisional_context" (upcoming words, for context only — do not gloss these).
2. Reorder the words in "stable_words" into typical ISL gloss word order (topic-comment structure, generally Subject-Object-Verb tendency), using "provisional_context" only to inform ordering decisions, never to add words.
3. Remove English articles (a, an, the) and copulas (is, am, are, was, were, be, being, been) if they appear in "stable_words".
4. Convert each remaining word to its uppercase root/dictionary form (e.g. "going" -> GO, "schools" -> SCHOOL, "ate" -> EAT).
5. Output every remaining word from "stable_words" after these conversions — do not omit, substitute, or skip any of them.
6. Never add, infer, or invent words that were not present in "stable_words".
7. Your entire response must be a single valid JSON object of exactly this shape, with no other text:
{"gloss": ["WORD1", "WORD2"]}
8. Do not include markdown formatting, code fences, explanations, or any text outside the JSON object.
9. If "stable_words" is empty, return {"gloss": []}."""

FEW_SHOT_EXAMPLES = """Example 1:
Input: {"stable_words": ["I", "am", "going", "to", "the", "school"], "provisional_context": ["tomorrow"]}
Output: {"gloss": ["I", "GO", "SCHOOL"]}

Example 2:
Input: {"stable_words": ["she", "ate", "an", "apple"], "provisional_context": ["yesterday"]}
Output: {"gloss": ["SHE", "EAT", "APPLE"]}

Example 3:
Input: {"stable_words": ["we", "are", "playing", "football"], "provisional_context": []}
Output: {"gloss": ["WE", "PLAY", "FOOTBALL"]}

Example 4:
Input: {"stable_words": ["I", "purchased", "a", "laptop"], "provisional_context": []}
Output: {"gloss": ["I", "PURCHASE", "LAPTOP"]}"""
