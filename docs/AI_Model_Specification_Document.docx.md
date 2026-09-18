**AI Model Specification Document**

*(Three models are in use: faster-whisper, silero-vad, and an Ollama-hosted 3B LLM. None of these are to be trained or fine-tuned — all three are used purely off-the-shelf, pretrained. Where a model needs "prompting," exact prompt text is given below for the IDE agent to use verbatim, not invent.)*

---

**MODEL 1 — faster-whisper (small)**

**Purpose:** Convert short audio chunks (\~1.5-2s) into English text, as fast as possible on local GPU, feeding the rolling text buffer for gloss conversion.

**Input — exact format required:**

* Raw audio, 16-bit PCM WAV, mono channel  
* Sample rate: 16kHz (Whisper's native training rate — resampling to this rate before passing in is required if the captured audio is at a different rate, e.g. the Web Audio API's typical 48kHz)  
* Duration: \~1.5-2 seconds per chunk (per our chunking spec)  
* Passed as either a file path or an in-memory NumPy float32 array, depending on which faster-whisper call signature is used

**Output — exact format:**

* A Segment object (or list of segments) containing: text (string), start/end timestamps, and per-segment confidence/log-probability metadata  
* Only the .text field from each segment is consumed downstream; other fields (timestamps, confidence) are optional to log for debugging but not required by the pipeline

**Responsibilities:**

* Transcribe exactly the audio it's given, nothing more  
* Return promptly (this is a real-time pipeline stage — no batching multiple chunks together, no waiting to accumulate more audio before running)

**Actions to avoid:**

* Do **not** run this model on chunks that VAD (Model 2\) has flagged as containing no speech — wasted compute and a known hallucination risk (per Fallback D in the main spec)  
* Do **not** attempt to use Whisper's built-in translation mode (task="translate") — this pipeline only needs transcription (task="transcribe"), since gloss conversion is handled separately by Model 3  
* Do **not** pass full, unchunked audio for transcription — always chunk first, per the streaming architecture

**Exact behavior expected in detail:** For each incoming \~2s audio chunk (already VAD-confirmed to contain speech, and already resampled to 16kHz mono if needed), call the model's transcribe function with language="en" explicitly set (do not rely on language auto-detection — it adds latency and risks misdetection on short chunks) and beam\_size kept low (1-2) to favor speed over marginal accuracy gains, consistent with the project's stated responsiveness-over-accuracy priority. The returned text is appended to the rolling buffer as described in Step 11 of the main pipeline spec.

**Training/prompting instructions:** None required — this is a fixed pretrained model with no prompt interface. The only configuration choices are: model size (small, already decided), compute type (float16 on the RTX 3050 for speed), device (cuda), language (en, fixed), and beam size (low, per above).

**Other instructions for IDE agent/developer:** Confirm the faster-whisper model download happens once at first run (it downloads weights on first instantiation if not cached locally) — this should happen during initial project setup, *before* demo day, not left to happen live for the first time during rehearsal.

---

**MODEL 2 — silero-vad**

**Purpose:** Two jobs, both described in the main spec — (a) find a clean silence point near the \~2s chunk-boundary cap for cutting audio (Step 8), and (b) score whether a finished chunk actually contains speech at all, to gate it before it reaches Whisper (Fallback D).

**Input — exact format required:**

* Raw audio, 16-bit PCM or float32, mono, 16kHz (same resampling requirement as Whisper — worth resampling once and reusing the same 16kHz buffer for both models rather than resampling twice)  
* Passed as short fixed-size frames — CONFIRMED by direct test against the installed silero-vad build (Phase 4): exactly 512 samples at 16kHz is the only accepted frame size (256, 1024, and 1536 samples were all tried and rejected by the model itself). This applies only to the internal VAD-scoring step inside backend/audio/vad.py; nothing upstream (the frontend's 128-sample AudioWorklet blocks, the accumulated streaming buffer, or chunker.py's per-session buffer) needs to arrive already aligned to 512 samples — vad.py slices whatever buffer it is given into consecutive 512-sample sub-frames itself, discarding any leftover remainder shorter than one frame.

**Output — exact format:**

* A speech probability score (float, 0.0-1.0) per frame/window  
* For the chunk-boundary-snapping use case: a sequence of these scores across the tail of the buffer, used to find a local minimum (silence) near the cap  
* For the pre-Whisper gating use case: an aggregated speech-probability score for the whole chunk (e.g. max or mean across frames), compared against a threshold (\~0.3, per Fallback D)

**Responsibilities:**

* Only judge presence/absence of speech-like signal — not transcribe, not identify speaker, not judge language  
* Run fast enough to not become a bottleneck itself (CPU execution is expected to be sufficient — do not allocate GPU resources to this model, reserve those for Whisper and Ollama)

**Actions to avoid:**

* Do not use this model's output as a transcription confidence signal — it has no relationship to transcription accuracy, only to whether speech-like audio is present at all  
* Do not run this on the GPU — unnecessary resource contention with the two models that actually need it

**Exact behavior expected in detail:** Runs twice per chunk lifecycle: once during chunk formation (Step 8\) to help pick a clean cut point instead of the hard 2s cap when possible, and once on the completed chunk right before the transcription handoff (Fallback D) to decide pass/discard. Both uses share the same loaded model instance — do not instantiate it twice.

**Training/prompting instructions:** None required — pretrained, no prompt interface, only a configurable probability threshold to tune (start at \~0.3-0.5 for the discard threshold and adjust based on false-positive/false-negative behavior observed during rehearsal with your actual demo audio).

**Other instructions for IDE agent/developer:** Test the chosen threshold against your actual demo source video's audio characteristics (background music level, speaker volume) during rehearsal — the right threshold is somewhat content-dependent and worth tuning against real material, not just leaving at a default.

## ---

 **MODEL 3 — Ollama (3B instruction-tuned model, e.g. llama3.2:3b)**

**Purpose:** Convert a rolling window of recently transcribed English words into ISL gloss order — reordered, articles/copulas dropped, incrementally, favoring speed over full-sentence grammatical correctness (per the explicit trade-off agreed earlier in this project) — while never producing a gloss word that doesn't actually exist in either the CISLR video index or the avatar's HamNoSys dictionary.

---

**Input — exact format required**

A JSON object constructed by our backend before each call:

json  
{  
  "stable\_words": \["I", "went", "to", "the"\],  
  "provisional\_context": \["school"\],  
  "allowed\_vocab": \["I", "GO", "SCHOOL", "EAT", "WE", "..."\]  
}

* **stable\_words**: the words from the rolling buffer that are ready to be committed to gloss output this cycle.  
* **provisional\_context**: newer words still in the buffer, included only so the model has a little forward context — these must NOT be glossed yet, only used to inform how stable\_words are ordered.  
* **allowed\_vocab**: the complete list of gloss words the model is permitted to output — built once at startup as the **union** of all keys in isl\_dictionary.json and all glosses in the CISLR video index (same load step as Step 1/13 in the main pipeline spec), and passed on every call.

*Note on allowed\_vocab size:* this list could be large (thousands of words once CISLR's index is included). Check the actual token count this adds per request during testing — if it's too large to comfortably fit every call without hurting latency, the fallback is to rely more heavily on the mandatory code-level filter below (which works regardless of whether the model itself ever sees the full list) rather than trying to shrink the prompt.

---

**Output — exact format required (strict JSON, nothing else)**

json  
{"gloss": \["I", "SCHOOL", "GO"\]}

* A single JSON object with one key, gloss, containing an ordered array of uppercase gloss tokens.  
* No prose, no explanation, no markdown code fences, no text before or after the JSON — this must be the entire response body, since it will be parsed directly.

---

**Responsibilities**

* Reorder stable\_words into plausible ISL gloss word order using provisional\_context only as a hint.  
* Drop English articles ("a", "an", "the") and copulas ("is", "am", "are", "was", "were", "be", "being", "been") where standard ISL gloss convention omits them.  
* Normalize words to uppercase root/gloss form (e.g. "went" → "GO", "schools" → "SCHOOL").  
* Return **only** words that (a) were present in stable\_words, in root form, **and** (b) exist in allowed\_vocab — both conditions required.  
* If a word from stable\_words has no match in allowed\_vocab after conversion to root form, omit it entirely rather than substituting a synonym or guessing.

---

**Actions to avoid**

* Do not output any word not present in stable\_words (after root-form conversion) — no elaboration, no filling in implied words, no adding words "for clarity."  
* **Do not output any word absent from allowed\_vocab** — no synonym substitution, no near-matches, no guessing at a plausible-sounding gloss token that isn't actually in the permitted list.  
* Do not wrap the JSON in markdown code fences — return raw JSON only.  
* Do not include any explanatory text, reasoning, or preamble before or after the JSON object.  
* Do not attempt full-sentence grammatical restructuring that would require seeing words beyond what's provided — the model only sees a small rolling window by design, and must always return its best gloss attempt for exactly the words given, never wait or ask for more context.  
* Do not translate into any language other than English-keyed ISL gloss tokens (no Hindi, no actual ISL script, no phonetic notation) — gloss tokens stay in English, per how isl\_dictionary.json and the CISLR index are keyed.

---

**Exact behavior expected in detail**

On each pipeline cycle (roughly every \~1.5-2s, matching the chunk rate), the backend sends the current stable\_words / provisional\_context / allowed\_vocab payload to Ollama's local /api/generate (or /api/chat) endpoint with the system prompt below. The response is parsed as JSON immediately; if parsing fails or the schema doesn't match, per Fallback E, the cycle's output is discarded and the same words are retried next cycle with whatever new context has since arrived — no special retry code needed beyond simply not advancing the buffer's commit boundary. Regardless of whether parsing succeeds, every surviving gloss word must then pass the mandatory code-level vocabulary filter described below before it's allowed to proceed to Step 13 (lookup).

---

**Exact system prompt (use verbatim)**

You are a gloss-conversion component in a real-time speech-to-sign-language pipeline. You convert English words into Indian Sign Language (ISL) gloss notation.

RULES YOU MUST FOLLOW EXACTLY:  
1\. You will receive a JSON input with three fields: "stable\_words" (words you must gloss), "provisional\_context" (upcoming words, for context only — do not gloss these), and "allowed\_vocab" (the complete list of gloss words you are permitted to output).  
2\. Reorder the words in "stable\_words" into typical ISL gloss word order (topic-comment structure, generally Subject-Object-Verb tendency), using "provisional\_context" only to inform ordering decisions, never to add words.  
3\. Remove English articles (a, an, the) and copulas (is, am, are, was, were, be, being, been) if they appear in "stable\_words".  
4\. Convert each remaining word to its uppercase root/dictionary form (e.g. "going" \-\> GO, "schools" \-\> SCHOOL, "ate" \-\> EAT).  
5\. CRITICAL: every word in your output MUST be an exact match (case-insensitive) to a word in "allowed\_vocab". If a word from "stable\_words" has no match in "allowed\_vocab" after conversion to root form, OMIT it from the output entirely — do not substitute a synonym, do not guess, do not include it anyway.  
6\. Output ONLY words that appeared in "stable\_words" AND exist in "allowed\_vocab". Never add, infer, or invent words that were not present in "stable\_words".  
7\. Your entire response must be a single valid JSON object of exactly this shape, with no other text:  
{"gloss": \["WORD1", "WORD2"\]}  
8\. Do not include markdown formatting, code fences, explanations, or any text outside the JSON object.  
9\. If "stable\_words" is empty, or no words from "stable\_words" have a match in "allowed\_vocab", return {"gloss": \[\]}.  
---

**Exact few-shot examples to include in the prompt (append after the system prompt, before each real request)**

Example 1:  
Input: {"stable\_words": \["I", "am", "going", "to", "the"\], "provisional\_context": \["school"\], "allowed\_vocab": \["I", "GO", "SCHOOL", "EAT", "WE"\]}  
Output: {"gloss": \["I", "GO"\]}

Example 2:  
Input: {"stable\_words": \["she", "ate", "an"\], "provisional\_context": \["apple", "yesterday"\], "allowed\_vocab": \["SHE", "EAT", "WE", "GO"\]}  
Output: {"gloss": \["SHE", "EAT"\]}

Example 3:  
Input: {"stable\_words": \["we"\], "provisional\_context": \["are", "playing", "football"\], "allowed\_vocab": \["WE", "PLAY", "FOOTBALL"\]}  
Output: {"gloss": \["WE"\]}

Example 4:  
Input: {"stable\_words": \["I", "purchased", "a"\], "provisional\_context": \["laptop"\], "allowed\_vocab": \["I", "GO", "SCHOOL"\]}  
Output: {"gloss": \["I"\]}

*(Example 3 reinforces that the model must resist glossing "playing football" just because it's visible in provisional\_context. Example 4 reinforces the new vocabulary constraint: "purchased" has no root-form match in this particular allowed\_vocab list, so it's correctly dropped while "I" is kept.)*

---

**Model configuration (not prompting, but required settings)**

* **Temperature: 0.1-0.2** — low, to minimize run-to-run inconsistency, since this is a structured-output task, not creative generation.  
* **Format constraint:** if the installed Ollama version/client supports a JSON-mode or format: "json" parameter, enable it as an extra safeguard on top of the prompt instructions.  
* **Max tokens:** cap the response length tightly (e.g. \~100-150 tokens) — the expected output is always short, and capping prevents a rare runaway generation from stalling the pipeline.

---

**Mandatory code-level validation step (the actual guarantee, not the prompt)**

This is what makes the vocabulary constraint absolute rather than merely likely — prompting alone cannot be fully trusted on a 3B model. Run this immediately after parsing the model's JSON response, before anything proceeds to Step 13/14 of the main pipeline:

1. Take the model's returned gloss array.  
2. For each word, check membership against the same allowed\_vocab set — kept as an in-memory Python set for O(1) lookup, built once at startup, same source used to construct the allowed\_vocab field sent in the request.  
3. Silently drop any word that fails this check, logging it (with the original stable\_words input) for later prompt-tuning review.  
4. Only the surviving, validated words continue to Step 13 (dictionary/video lookup) → Step 14 (render mode determination).

This guarantee is real and absolute regardless of prompt compliance — the prompt-level constraint (rule 5\) exists purely to *reduce how often* the filter has to catch something, preserving as much effective vocabulary coverage as possible, rather than relying on the filter to silently discard words the model could have gotten right with good instruction-following.

---

**Training/prompting instructions**

No fine-tuning — this is prompt engineering only, using the exact system prompt and few-shot examples above. The IDE agent should implement the API call with this prompt hardcoded (not regenerated or paraphrased by the agent itself), since the exact wording has been chosen to constrain the specific failure modes relevant to this pipeline (word invention, off-vocabulary output, format drift).

---

**Other instructions for IDE agent/developer**

* Run a dedicated test pass feeding this prompt a range of real transcribed sentence fragments from your actual demo video *before* the event, specifically checking for: words appearing that weren't in stable\_words, off-vocabulary words slipping past the prompt (confirming the code-level filter actually catches them), malformed JSON, and markdown fences slipping in.  
* If malformed/non-compliant output turns out to be frequent in testing, the next lever to pull is strengthening the few-shot examples with cases drawn from your actual observed failures, not increasing model size (which would cost the latency budget this whole architecture was built around).  
* Log every raw Ollama response during rehearsal runs (even successful, filter-passing ones) to a local file — this gives you a corpus to review and tune the prompt against before demo day, rather than tuning blind.  
* Build allowed\_vocab once at startup from the same in-memory dictionaries used in Step 13, and keep it as a single shared set object reused both for constructing the prompt payload and for the mandatory post-response filter — don't rebuild or reload it per request.

  