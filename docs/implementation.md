# SignSetu — Frozen Conventions

This document is the single reference for conventions fixed across the whole project. Every later phase must conform to what's recorded here rather than re-deciding it. Updates only happen when a phase confirms new binding facts (e.g. Phase 2's reused-file API signatures) — additions are appended, never silently reinterpreted.

## 1. Model 3 (Ollama) system prompt and few-shot examples — VERBATIM, frozen

Source of truth: `AI_Model_Specification_Document.docx`. Copied character-for-character into `backend/gloss/prompts.py` in Phase 6. Never paraphrased, reformatted, or "improved" by the agent.

**System prompt:**
```
You are a gloss-conversion component in a real-time speech-to-sign-language pipeline. You convert English words into Indian Sign Language (ISL) gloss notation.

RULES YOU MUST FOLLOW EXACTLY:
1. You will receive a JSON input with three fields: "stable_words" (words you must gloss), "provisional_context" (upcoming words, for context only — do not gloss these), and "allowed_vocab" (the complete list of gloss words you are permitted to output).
2. Reorder the words in "stable_words" into typical ISL gloss word order (topic-comment structure, generally Subject-Object-Verb tendency), using "provisional_context" only to inform ordering decisions, never to add words.
3. Remove English articles (a, an, the) and copulas (is, am, are, was, were, be, being, been) if they appear in "stable_words".
4. Convert each remaining word to its uppercase root/dictionary form (e.g. "going" -> GO, "schools" -> SCHOOL, "ate" -> EAT).
5. CRITICAL: every word in your output MUST be an exact match (case-insensitive) to a word in "allowed_vocab". If a word from "stable_words" has no match in "allowed_vocab" after conversion to root form, OMIT it from the output entirely — do not substitute a synonym, do not guess, do not include it anyway.
6. Output ONLY words that appeared in "stable_words" AND exist in "allowed_vocab". Never add, infer, or invent words that were not present in "stable_words".
7. Your entire response must be a single valid JSON object of exactly this shape, with no other text:
{"gloss": ["WORD1", "WORD2"]}
8. Do not include markdown formatting, code fences, explanations, or any text outside the JSON object.
9. If "stable_words" is empty, or no words from "stable_words" have a match in "allowed_vocab", return {"gloss": []}.
```

**Few-shot examples (in order):**
```
Example 1:
Input: {"stable_words": ["I", "am", "going", "to", "the"], "provisional_context": ["school"], "allowed_vocab": ["I", "GO", "SCHOOL", "EAT", "WE"]}
Output: {"gloss": ["I", "GO"]}

Example 2:
Input: {"stable_words": ["she", "ate", "an"], "provisional_context": ["apple", "yesterday"], "allowed_vocab": ["SHE", "EAT", "WE", "GO"]}
Output: {"gloss": ["SHE", "EAT"]}

Example 3:
Input: {"stable_words": ["we"], "provisional_context": ["are", "playing", "football"], "allowed_vocab": ["WE", "PLAY", "FOOTBALL"]}
Output: {"gloss": ["WE"]}

Example 4:
Input: {"stable_words": ["I", "purchased", "a"], "provisional_context": ["laptop"], "allowed_vocab": ["I", "GO", "SCHOOL"]}
Output: {"gloss": ["I"]}
```

Model config: temperature 0.1-0.2, `format="json"` if supported, max_tokens ~100-150. Endpoint: `http://localhost:11434/api/generate` (or `/api/chat`).

## 2. Data structure shapes — frozen

**Ollama request payload** (built by `ollama_client.py`, consumed by Model 3):
```json
{
  "stable_words": ["I", "went", "to", "the"],
  "provisional_context": ["school"],
  "allowed_vocab": ["I", "GO", "SCHOOL", "EAT", "WE", "..."]
}
```

**Ollama response** (strict JSON, nothing else):
```json
{"gloss": ["I", "SCHOOL", "GO"]}
```

**Per-word render record** (Step 13 lookup output, `render_resolver.py` input):
```
{word, hamnosys?: string, videoPath?: string}
```

**Finalized render instruction** (Step 14 output, sent frontend-ward over the WebSocket, Step 15 queue item):
```
{word, renderType: "avatar" | "video" | "unknown", assetRef: string, sessionId: <id>}
```

**Backend-internal chunk object** (Step 8, `chunker.py` -> transcription queue):
```
{audioData, sessionId, timestamp}
```

**`rolling_text_buffer.get_commit_batch()` return shape:**
```
{stable_words: [...], provisional_context: [...]}
```

## 3. `backend/config.py` — constant names and meaning (frozen names; values tunable within documented ranges)

| Constant | Meaning | Range/default |
|---|---|---|
| `VAD_DISCARD_THRESHOLD` | Fallback D: below this aggregated speech-probability, a chunk is dropped before Whisper | 0.3 (tune 0.3-0.5) |
| `CHUNK_TARGET_SECONDS` | Step 8: target chunk size before attempting a silence-snap cut | 1.5-2 |
| `CHUNK_HARD_CAP_SECONDS` | Step 8: hard cut point if no silence found | 2 |
| `CHUNK_CHECK_INTERVAL_MS` | Step 8: how often the chunker timer loop checks the buffer | 100-200 |
| `ROLLING_BUFFER_WORDS` | Step 11: total words held in the rolling buffer | 5-6 |
| `PROVISIONAL_WORDS` | Step 11: newest N words held back as provisional (not yet stable) | 2-3 |
| `OLLAMA_HOST_URL` | Model 3 endpoint | `http://localhost:11434` |
| `OLLAMA_MODEL_NAME` | Model 3 model tag | `llama3.2:3b` |
| `OLLAMA_TEMPERATURE` | Model 3 sampling temperature | 0.1-0.2 |
| `OLLAMA_MAX_TOKENS` | Model 3 response cap | 100-150 |
| `LATENCY_TARGET_SECONDS` | Fallback G: target end-to-end per-word latency | 5 |
| `LATENCY_DEGRADE_THRESHOLD_SECONDS` | Fallback G: average latency above this triggers video-only degrade | 6-7 |
| `LATENCY_WINDOW_SIZE` | Fallback G: rolling window size (in words) for the latency average | 5-10 |
| `SEEK_DEBOUNCE_MS` | Fallback H: debounce window for seek detection | 150-200 |
| `WHISPER_MODEL_SIZE` | Model 1 size | `"small"` |
| `WHISPER_BEAM_SIZE` | Model 1 beam search width | 1-2 |
| `WHISPER_LANGUAGE` | Model 1 fixed language | `"en"` |
| `WHISPER_COMPUTE_TYPE` | Model 1 CTranslate2 compute type | `"float16"` |
| `WHISPER_DEVICE` | Model 1 device | `"cuda"` |
| `ISL_DICTIONARY_PATH` | Path to `assets/isl_dictionary.json` | — |
| `CISLR_DATASET_PATH` | Path to `assets/cislr/dataset.csv` | — |
| `CISLR_CLIPS_DIR` | Path to `assets/cislr/clips/` | — |
| `PLACEHOLDER_ASSET_PATH` | Path to `assets/placeholder/unknown_word.png` | — |

Every tunable constant lives only here — never hardcoded inline elsewhere.

**Exception, decided in Phase 2:** `AVATAR_SIGN_HOLD_MS` is a frontend-only timing constant (how long `avatarRenderer.js` waits before calling `resetAll()` and advancing the queue, since SignEngine.js has no completion event — see section 5). It cannot live in `backend/config.py` because it is never used backend-side, and the file-structure spec defines no `frontend/config.js` module. It is defined as a top-of-file constant directly in `frontend/render/avatarRenderer.js` (Phase 13) — the sole documented exception to "every tunable lives in config.py," since that rule was written before SignEngine.js's real (event-less) API was confirmed.

## 4. sessionId tagging and invalidation convention

- `sessionId` is an opaque, monotonically-incrementing identifier, one per logical "capture session" on a given WebSocket connection.
- Owned on the backend by `backend/session/session_state.py` (single source of truth); owned on the frontend by `frontend/session/sessionManager.js`.
- Every unit of work that crosses a queue or async boundary carries its originating `sessionId`: audio chunks (`{audioData, sessionId, timestamp}`), WebSocket messages in both directions, render instructions (`{word, renderType, assetRef, sessionId}`).
- Before any consumer (backend stage or frontend renderer) acts on a unit of work, it checks the work's `sessionId` against the current live session (`session_state.is_current()` backend-side, `sessionManager`'s `currentSessionId` frontend-side). Mismatch -> silently drop, never render/process, never treated as an error.
- `increment_session()` — called only on a confirmed genuine seek (post-debounce, Fallback H) or a genuinely new stream after a freeze (`resume_session()`); this is the only path that invalidates in-flight work.
- `freeze_session()` — called on stream loss (Fallback C); halts processing but does NOT increment sessionId or clear buffers, since reconnecting to the same content is expected and context should be preserved.
- Rapid seek events are debounced (150-200ms, `SEEK_DEBOUNCE_MS`) before triggering a single increment — never one increment per intermediate scrub event.

## 5. Reused-file API signatures (speech-to-isl repo) — confirmed in Phase 2

All 6 files were fetched from https://github.com/jayakarthik07/speech-to-isl (main branch) and read in full. Actual APIs differ from the Code Reuse doc's hypotheses in several places — the confirmed facts below are binding; the doc's original guesses are superseded.

**hamnosysMap.js** — exports `HAMNOSYS_ACTIONS`, a plain object mapping HamNoSys token strings (e.g. `"hamflathand"`, `"hampalmd"`, `"hamchest"`) to functions of shape `(engine) => void`, where `engine` is a `SignEngine` instance. It is NOT a string parser producing bone-rotation pose targets — each token's function directly calls one of `engine.hand()`, `engine.palm()`, `engine.armTo()`, or `engine.resetAll()`. To play a HamNoSys string, split it on whitespace and call `HAMNOSYS_ACTIONS[token](signEngineInstance)` for each token in order.

**autoBoneMapper.js** — exports `autoMapBones(model)` (named export, not default), returning a plain object `{canonicalBoneName: THREE.Bone}`. Standalone, pure function. Not called by SignEngine.js internally — SignEngine.js does its own independent bone mapping (see below), so this file's output is not required to drive SignEngine and is only useful if our own code needs a bone table independently.

**SignEngine.js** — exports class `SignEngine`, constructed as `new SignEngine({ model })` where `model` is the loaded GLTF scene/group. The constructor does its OWN internal bone mapping (`_universalBoneMapper`, private) — it does not accept or need autoBoneMapper.js's output. There is NO `playSign()` method and NO HamNoSys-string-consuming method at all. Public methods are low-level: `rotate(boneName, x, y, z, speed)`, `reset(boneName)`, `resetAll()`, `armTo(location)` (location one of "chest"/"chin"/"head"/"stomach"/"forward"), `palm(orientation)` (one of "down"/"up"/"left"/"right"/"forward"), `hand(shape)` (one of "flat"/"fist"/"index"/"vee"/"pinch"/"cee"/"thumbup"). Critically, there is NO completion event, callback, or promise of any kind — animation runs continuously via an internal `requestAnimationFrame` loop, and `rotate()` calls interpolate over time with no notification when they finish. Our own `avatarRenderer.js` (Phase 13) must therefore invent its own completion signal (e.g. a fixed timeout per sign, sized to the interpolation speed used) rather than listening for one that doesn't exist. It does not automatically return to neutral rest pose between signs — that requires an explicit `resetAll()` call from our own integration code.

**avatar.js** — exports `initAvatarScene(container)`, returning a `Promise<{model, scene, camera, renderer}>`. This function builds its own complete Three.js scene, camera, renderer, lights, and OrbitControls, and already starts its own render loop internally — it is not a bare "load and pose a model into an existing scene" helper as the Code Reuse doc assumed. Our own `main.js` (Phase 10) should call this once and use its returned scene/camera/renderer rather than constructing separate ones. It hardcodes the GLB fetch path as `"/models/human.glb"` (root-relative) — since the file cannot be modified, the backend's static file mounting (Phase 9) must additionally serve `frontend/vendor/models/` at the `/models` route so this unmodified path resolves. Both `SignEngine.js` and `avatar.js` use bare ES module specifiers (`import * as THREE from "three"`, `three/examples/jsm/loaders/GLTFLoader.js`, `three/examples/jsm/controls/OrbitControls.js`) — this requires an `<script type="importmap">` in index.html mapping `"three"` and `"three/examples/jsm/"` to a CDN ESM build, loaded via `<script type="module">`. This still satisfies "no bundler" (import maps are native browser functionality) but is a stronger requirement than a plain `<script src>` CDN tag — recorded here since Phase 10 must implement it this way for the reused files to load at all.

**isl_dictionary.json** — NOT a flat `{gloss_word: hamnosys_string}` map as assumed. Actual shape: keyed by lowercase English word, e.g. `{"hello": {"gloss": "HELLO", "hamnosys": "hamflathand hampalmd hamchest"}, "hi": {"gloss": "HI", "hamnosys": "..."}}`. 260 entries, 260 unique `gloss` values (multiple English-word keys can map to the same gloss). `dictionary_loader.py` (Phase 3) must iterate `.values()` and index by each entry's `gloss` field (uppercased), not by the JSON's own top-level keys.

**human.glb** — valid glTF binary (magic bytes confirmed), 6.6MB.

**backend/legacy_reference/isl_nlp.py, app.py** — fetched and skimmed per the reference-only instruction; confirms isl_nlp.py loads the same isl_dictionary.json shape above plus a separate hardcoded finger-spelling alphabet map. Neither file is imported or called anywhere in this project.

**CISLR dataset.csv vs prototype.csv vs test.csv** — the Hugging Face repo (Exploration-Lab/CISLR) ships three CSVs, all sharing the schema `uid,gloss,duration,category`: `dataset.csv` (7050 rows, 4765 unique glosses, 1363 of which have up to 13 duplicate clips), `prototype.csv` (4765 rows, exactly one clip per unique gloss, zero duplicates — a subset of dataset.csv), and `test.csv` (2285 rows covering the 1363 duplicated glosses — the original paper's held-out query set for evaluating sign *recognition*, irrelevant here since this project only plays clips back, never classifies one). Decision: `backend/lookup/cislr_index.py` (Phase 3) builds its gloss→video-path index from `prototype.csv`, not `dataset.csv`, since prototype.csv already gives one deterministic, curated clip per gloss rather than requiring us to pick among duplicates ourselves. `dataset.csv` stays in `assets/cislr/` as the full reference set but is not read by `cislr_index.py`. `test.csv` is not used anywhere in this project. `prototype.csv` has one confirmed malformed row (`gloss="#N/A"`) that must be excluded like any other bad entry.

## 6. Structural boundaries (non-negotiable, from SignSetu docs)

- `backend/` contains zero frontend-only JS logic; `frontend/` contains zero Python/pipeline/model-calling logic.
- `backend/ws/connection.py` is the only communication boundary between frontend and backend.
- All chunk-cutting/VAD logic lives backend-side (`backend/audio/`); the frontend's only audio job is continuous raw-PCM capture and transport.
- `vocab_filter.py` runs unconditionally on every Ollama response, regardless of JSON-parse success.
- No word is ever a silent gap — unresolvable words always get the Fallback A placeholder, logged, never skipped.
- All three models (Whisper, Silero-VAD, Ollama) load once at backend startup, persist for the process lifetime.
- Silero-VAD is CPU-only; GPU is reserved for Whisper + Ollama.
- Whisper always runs `language="en"`, `task="transcribe"` explicit.
- Ollama temperature stays 0.1-0.2.
- CISLR clips are pre-downloaded/locally cached, never streamed live.
- No database — static in-memory structures loaded once at startup.
- No frontend bundler — Three.js via pinned CDN `<script>` only.
- Chrome/Chromium only.
- `backend/logs/ollama_raw_log.py` is append-only.
