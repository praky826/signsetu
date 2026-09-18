**SignSetu — Implementation Algorithms for Backend & Frontend**

*(Phase-wise, file-by-file — Purpose, Dependencies, Input, Output, Algorithm for every file in the project structure)*

---

**PHASE 1 — PROJECT SKELETON & CONFIGURATION**

**FILE: backend/config.py**

Purpose  
Central store for every tunable constant used across the backend, so no value is ever hardcoded inline elsewhere.

Dependencies  
python-dotenv (optional, for local overrides). No internal file dependencies — this is a leaf module every other backend file imports from.

Input  
Optional .env file with override values.

Output  
Named constants importable by every other backend module.

Algorithm

1. Load environment variables via python-dotenv if a .env file is present.  
2. Define VAD\_DISCARD\_THRESHOLD (default 0.3).  
3. Define CHUNK\_TARGET\_SECONDS (1.5–2), CHUNK\_HARD\_CAP\_SECONDS (2), CHUNK\_CHECK\_INTERVAL\_MS (100–200).  
4. Define ROLLING\_BUFFER\_WORDS (5–6), PROVISIONAL\_WORDS (2–3).  
5. Define OLLAMA\_HOST\_URL ([http://localhost:11434](http://localhost:11434)), OLLAMA\_MODEL\_NAME, OLLAMA\_TEMPERATURE (0.1–0.2), OLLAMA\_MAX\_TOKENS (100–150).  
6. Define LATENCY\_TARGET\_SECONDS (5), LATENCY\_DEGRADE\_THRESHOLD\_SECONDS (6–7), LATENCY\_WINDOW\_SIZE (5–10 words).  
7. Define SEEK\_DEBOUNCE\_MS (150–200).  
8. Define WHISPER\_MODEL\_SIZE ("small"), WHISPER\_BEAM\_SIZE (1–2), WHISPER\_LANGUAGE ("en"), WHISPER\_COMPUTE\_TYPE ("float16"), WHISPER\_DEVICE ("cuda").  
9. Define file paths: ISL\_DICTIONARY\_PATH, CISLR\_DATASET\_PATH, CISLR\_CLIPS\_DIR, PLACEHOLDER\_ASSET\_PATH.  
10. Expose every constant at module level for direct import by name elsewhere; never redefine a value locally in another file.

**FILE: backend/init.py and all subpackage \_\_init\_\_.py files (ws/, audio/, transcription/, buffer/, gloss/, lookup/, session/, monitoring/, logs/, legacy\_reference/)**

Purpose  
Mark each backend folder as an importable Python package.

Dependencies  
None.

Input  
None.

Output  
Empty package markers enabling from backend.audio import vad style imports.

Algorithm

1. Create an empty \_\_init\_\_.py in each subpackage folder — no logic, no imports, no content required at this stage.

---

**PHASE 2 — STATIC ASSET ACQUISITION & LEGACY REPO VERIFICATION**

**FILE: assets/isl\_dictionary.json**

Purpose  
Flat database of 250+ ISL signs, each mapping an English gloss word to its HamNoSys notation string — the avatar-mode vocabulary source.

Dependencies  
None (static data file, source: speech-to-isl repo, backend/isl\_dictionary.json path).

Input  
None — copied verbatim.

Output  
Raw JSON consumed by backend/lookup/dictionary\_loader.py in Phase 3\.

Algorithm

1. Fetch the file directly from the speech-to-isl repo at its listed path.  
2. If fetch fails, stop and request the developer manually download and paste the file at assets/isl\_dictionary.json.  
3. Do not modify a single entry — copy the file wholesale, unmodified.  
4. Confirm the file parses as valid JSON before proceeding to Phase 3\.

**FILES: frontend/vendor/hamnosysMap.js, autoBoneMapper.js, SignEngine.js, avatar.js, frontend/vendor/models/human.glb**

Purpose  
Reused, unmodified modules from the speech-to-isl repo providing HamNoSys parsing, rig bone-mapping, avatar animation, avatar loading, and the 3D model asset respectively.

Dependencies  
None from this project (each is copied unmodified); human.glb is consumed by avatar.js.

Input  
Source repo at [https://github.com/jayakarthik07/speech-to-isl](https://github.com/jayakarthik07/speech-to-isl).

Output  
Confirmed, documented public APIs later phases call into (Phase 10, 13).

Algorithm (verification procedure — no new logic is written for these files)

1. Attempt to fetch each file directly from its path in the source repo.  
2. If any fetch fails, stop and request the developer manually download and paste that file's contents at the matching frontend/vendor/ path.  
3. Open and read each file in full before any later phase references it.  
4. For hamnosysMap.js: identify and record its exported HamNoSys-string-to-pose-target parsing function's exact name and signature.  
5. For autoBoneMapper.js: identify and record its exported bone-mapping function's name, and confirm it is meant to be called once, after GLB load.  
6. For SignEngine.js: identify and record (a) its public "play this sign" function name/signature, (b) its exact completion-signaling mechanism (event, callback, or promise — verify, do not assume), (c) whether it already returns to a neutral rest pose between signs.  
7. For avatar.js: identify and record its exported load/pose function name and signature.  
8. Record all confirmed names/signatures in a shared findings note for Phase 10 and Phase 13 to consume directly — no phase after this one may assume an unverified API.  
9. Copy every file into frontend/vendor/ unmodified — no edits, no renaming of internal logic.

**FILES: backend/legacy\_reference/isl\_nlp.py, backend/legacy\_reference/app.py**

Purpose  
Kept only for pattern reference (e.g., how the original project invoked Whisper or structured its dictionary lookup) — never imported or called by this project.

Dependencies  
None.

Input  
Source repo files backend/isl\_nlp.py and backend/app.py.

Output  
Read-only reference copies.

Algorithm

1. Fetch both files from the source repo if possible; otherwise skip (they are optional reference material only).  
2. Place them in backend/legacy\_reference/ unmodified.  
3. Optionally skim once for implementation pattern ideas.  
4. Never import either file from any other module in this project.

**FILES: assets/cislr/dataset.csv, assets/cislr/clips/**

Purpose  
Source metadata and locally cached video clips backing the video-mode vocabulary.

Dependencies  
Hugging Face account with CISLR access terms accepted (human step, Phase 0).

Input  
CISLR dataset published on Hugging Face.

Output  
dataset.csv and a folder of locally cached .mp4/clip files for the chosen demo vocabulary, ready for backend/lookup/cislr\_index.py (Phase 3\) to index.

Algorithm

1. Download dataset.csv from the CISLR Hugging Face dataset.  
2. Parse the CSV once to confirm it contains a gloss-word column and a clip-reference column.  
3. Determine the demo vocabulary set (the words expected to appear in the rehearsal/demo content).  
4. Download and cache only the video clips needed for that vocabulary into assets/cislr/clips/, named/keyed consistently with the gloss values in dataset.csv.  
5. Confirm every cached clip plays correctly in a standard video player.  
6. Never leave this dependent on a live Hugging Face fetch at runtime — all clips must be present locally before Phase 3\.

**FILE: assets/placeholder/unknown\_word.png**

Purpose  
Visible, non-blank placeholder shown when a gloss word can't be resolved to either avatar or video (Fallback A).

Dependencies  
None.

Input  
None.

Output  
A small, visually distinct static image (e.g. a greyed-out figure or a "?" icon).

Algorithm

1. Create a simple static image clearly distinguishable from both a real sign and a blank/frozen frame.  
2. Save at assets/placeholder/unknown\_word.png.  
3. Confirm it renders correctly in a browser \<img\> tag before Phase 7 wires it in.

---

**PHASE 3 — BACKEND MODEL BOOTSTRAPPING (STEP 1\)**

**FILE: backend/transcription/whisper\_service.py (init portion)**

Purpose  
Load the faster-whisper "small" model into GPU memory once at startup so the first real transcription isn't slowed by cold-start.

Dependencies  
faster-whisper, ctranslate2, config.py (WHISPER\_MODEL\_SIZE, WHISPER\_COMPUTE\_TYPE, WHISPER\_DEVICE).

Input  
None (triggered on backend startup).

Output  
A resident, GPU-loaded WhisperModel instance shared for the whole session.

Algorithm

1. Read WHISPER\_MODEL\_SIZE, WHISPER\_COMPUTE\_TYPE, WHISPER\_DEVICE from config.py.  
2. Instantiate the faster-whisper model object with these parameters.  
3. Run one throwaway transcription call on a tiny silent/blank audio buffer to force weights fully into VRAM.  
4. Store the instance at module level so it is created exactly once and reused by every later transcription call (completed in Phase 5).  
5. Report success/failure to main.py's startup sequence.

**FILE: backend/audio/vad.py (init portion)**

Purpose  
Load the silero-vad ONNX model into memory once, shared by both chunk-boundary snapping (Phase 4\) and the pre-Whisper hallucination gate (Phase 4).

Dependencies  
silero-vad, config.py.

Input  
None (triggered on backend startup).

Output  
A single resident VAD model instance.

Algorithm

1. Load the silero-vad ONNX model on CPU (never GPU — reserved for Whisper and Ollama).  
2. Run one throwaway inference call on a short silent buffer to confirm the model responds.  
3. Store the instance at module level for reuse by both find\_silence\_point() and score\_speech\_probability() (both implemented fully in Phase 4\) — never instantiate a second copy.  
4. Report success/failure to main.py's startup sequence.

**FILE: backend/gloss/ollama\_client.py (warm-up portion)**

Purpose  
Force the local 3B Ollama model into VRAM and trigger any internal JIT/compilation before the first real gloss request.

Dependencies  
httpx, config.py (OLLAMA\_HOST\_URL, OLLAMA\_MODEL\_NAME).

Input  
None (triggered on backend startup).

Output  
Confirmation that Ollama's local API is responsive.

Algorithm

1. Send a POST request to OLLAMA\_HOST\_URL/api/generate with a trivial throwaway prompt (e.g. "hello").  
2. Discard the response content entirely — only the fact that a response arrived matters.  
3. If the request fails or times out, report failure to main.py's startup sequence.  
4. If it succeeds, mark Ollama as warm; the full request-building logic is completed in Phase 6\.

**FILE: backend/lookup/dictionary\_loader.py**

Purpose  
Load isl\_dictionary.json into memory and validate every HamNoSys entry, excluding any that fail to parse (Fallback F).

Dependencies  
assets/isl\_dictionary.json, hamnosysMap.js's confirmed token-parsing logic (Phase 2 findings — mirrored in Python, or invoked via a subprocess/port if parsing must match exactly), config.py (ISL\_DICTIONARY\_PATH).

Input  
assets/isl\_dictionary.json.

Output  
A validated in-memory Python dict {gloss\_word: hamnosys\_string}, plus a console-logged list of excluded words.

Algorithm

1. Read and parse assets/isl\_dictionary.json into a raw dict, uppercasing every gloss key on load (e.g. {k.upper(): v for k, v in raw.items()}) so keys match the uppercase gloss tokens Ollama is instructed to output.  
2. For every entry, run its HamNoSys string through a parser that mirrors hamnosysMap.js's known token set (per Phase 2's confirmed API).  
3. If an entry's string parses successfully, keep it in the validated dict.  
4. If an entry's string fails to parse, exclude it from the validated dict and log the excluded word and reason to console.  
5. Store the final validated dict at module level, built exactly once at startup.  
6. Expose a get(word) lookup function that uppercases word before lookup, and a keys() accessor (used to build allowed\_vocab in Phase 6\) — both operating on the same normalized-case dict.

**FILE: backend/lookup/cislr\_index.py**

Purpose  
Build a gloss-word → local video-file-path index from dataset.csv, once, at startup.

Dependencies  
assets/cislr/dataset.csv, assets/cislr/clips/, config.py (CISLR\_DATASET\_PATH, CISLR\_CLIPS\_DIR).

Input  
assets/cislr/dataset.csv.

Output  
An in-memory Python dict {gloss\_word: local\_clip\_path}.

Algorithm

1. Read assets/cislr/dataset.csv row by row.  
2. 2\. For each row, extract the gloss word (uppercased on read, e.g. gloss.strip().upper(), so keys match the uppercase gloss tokens Ollama outputs) and its corresponding clip identifier/filename.  
3. Build the local file path for that clip under assets/cislr/clips/.  
4. Confirm the file actually exists on disk at that path; if missing, exclude that entry and log it.  
5. Store the final dict at module level, built exactly once at startup.  
6. Expose a get(word) lookup function that uppercases word before lookup, and a keys() accessor (used to build allowed\_vocab in Phase 6\) — both operating on the same normalized-case dict.

**FILE: backend/main.py (warm-up portion)**

Purpose  
Orchestrate concurrent startup of all four resident components (Whisper, VAD, Ollama, dictionary/CISLR loaders) and expose a /health endpoint that only reports ready once all succeed.

Dependencies  
whisper\_service.py, vad.py, ollama\_client.py, dictionary\_loader.py, cislr\_index.py, FastAPI, Uvicorn.

Input  
None (triggered on process start).

Output  
A running FastAPI app with a /health endpoint reflecting true readiness.

Algorithm

1. On application startup event, kick off all four initialization calls concurrently (async/threaded): whisper\_service.init(), vad.init(), ollama\_client.warm\_up(), dictionary\_loader.load() \+ cislr\_index.build().  
2. Track each component's ready/failed state in a shared startup-status object.  
3. Define /health to return "ready" only once every component reports success; otherwise return the current loading/failure state.  
4. Log any component failure clearly, including which one failed, without crashing the whole process if only one component fails (so the failure is visible rather than silent).  
5. (Static file mounting and WebSocket route registration are added in Phase 9 — not part of this phase's scope.)

---

**PHASE 4 — BACKEND AUDIO INGESTION, VAD CHUNKING & HALLUCINATION GATE (STEPS 7–8, FALLBACK D)**

**FILE: backend/audio/vad.py (complete)**

Purpose  
Provide both VAD responsibilities off the single loaded model instance: finding a clean silence cut-point, and scoring whether a completed chunk actually contains speech.

Dependencies  
The silero-vad instance loaded in Phase 3, config.py (VAD\_DISCARD\_THRESHOLD).

Input  
A raw PCM buffer tail (for cut-point search) or a completed audio chunk (for speech-probability scoring).

Output  
Either a cut-point sample index, or a float speech-probability score (0.0–1.0).

Algorithm

1. Expose find\_silence\_point(buffer\_tail): run the VAD model over short fixed-size frames across the buffer tail; return the position of the lowest-probability (most silent) frame found within the search window nearest the target chunk size.  
2. If no sufficiently silent frame is found in that window, return None (signaling the caller should hard-cut at the cap instead).  
3. Expose score\_speech\_probability(chunk): run the VAD model over the full chunk in fixed-size frames; aggregate (max or mean) the per-frame scores into a single value for the chunk.  
4. Return the aggregated score for comparison against VAD\_DISCARD\_THRESHOLD by the caller.  
5. Both functions use the same module-level model instance loaded once in Phase 3 — never re-instantiate.

**FILE: backend/audio/chunker.py**

Purpose  
Maintain a per-session rolling raw-PCM buffer and cut it into discrete \~1.5–2s chunks, snapping to silence where possible, gating out non-speech chunks before they reach transcription.

Dependencies  
vad.py, config.py (CHUNK\_TARGET\_SECONDS, CHUNK\_HARD\_CAP\_SECONDS, CHUNK\_CHECK\_INTERVAL\_MS, VAD\_DISCARD\_THRESHOLD).

Input  
Continuous raw PCM audio arriving per session from backend/ws/connection.py.

Output  
Discrete, speech-confirmed audio chunk objects {audioData, sessionId, timestamp} pushed to the transcription queue (Phase 5); non-speech chunks are dropped and logged.

Algorithm

1. Maintain one growing raw-PCM buffer per active sessionId.  
2. On a timer running every CHUNK\_CHECK\_INTERVAL\_MS, check whether the current session's buffer has reached CHUNK\_TARGET\_SECONDS worth of audio.  
3. If it has, call vad.find\_silence\_point() on the buffer tail to look for a clean cut point.  
4. If a silence point is found, cut the buffer there; otherwise, hard-cut at CHUNK\_HARD\_CAP\_SECONDS.  
5. Remove the cut segment from the front of the session's buffer; leftover audio remains as the start of the next chunk.  
6. Call vad.score\_speech\_probability() on the cut segment.  
7. If the score is below VAD\_DISCARD\_THRESHOLD, discard the chunk entirely and log it (Fallback D) — do not forward it.  
8. If the score meets the threshold, tag the chunk with {audioData, sessionId, timestamp} and push it onto the per-session transcription queue for Phase 5 to consume.  
9. If the session's sessionId no longer matches the currently active session (per session\_state.py, Phase 8), discard the entire buffer for that stale session instead of processing it further.

**FILE: backend/ws/connection.py (receive portion)**

Purpose  
Receive the continuous raw audio stream from the frontend over WebSocket and feed it into the per-session buffer in chunker.py.

Dependencies  
FastAPI WebSocket, chunker.py, session\_state.py (Phase 8, referenced once available).

Input  
Binary PCM audio frames sent by frontend/network/wsClient.js, each associated with a sessionId and sequence number.

Output  
Raw audio appended into chunker.py's per-session buffer.

Algorithm

1. Accept an incoming WebSocket connection; keep it open for the whole session rather than reconnecting per chunk.  
2. On each incoming binary message, extract the sessionId, sequence number, and raw PCM payload.  
3. If the sessionId doesn't match the currently active session, discard the message immediately.  
4. Otherwise, append the raw PCM payload into chunker.py's buffer for that sessionId.  
5. Keep this loop running for the life of the connection; handle disconnects by leaving state as-is (cleanup handled by session/reconnect logic in later phases).

---

**PHASE 5 — TRANSCRIPTION & ROLLING TEXT BUFFER (STEPS 10–11)**

**FILE: backend/transcription/whisper\_service.py (complete)**

Purpose  
Convert each speech-confirmed audio chunk into text, continuously, as chunks arrive.

Dependencies  
The Whisper model instance loaded in Phase 3, config.py (WHISPER\_BEAM\_SIZE, WHISPER\_LANGUAGE), chunker.py's output queue, session\_state.py (Phase 8, for discard checks).

Input  
A queued, speech-confirmed audio chunk object.

Output  
A transcribed text string (e.g. "and then I went to") pushed to rolling\_text\_buffer.py.

Algorithm

1. Run as a dedicated worker pulling chunks from the per-session queue in strict arrival order.  
2. For each chunk, check its sessionId against the currently active session; if stale, discard without transcribing.  
3. Call model.transcribe(chunk\_audio, language=WHISPER\_LANGUAGE, task="transcribe", beam\_size=WHISPER\_BEAM\_SIZE).  
4. Extract only the .text field from the returned segment(s); log timestamps/confidence for debugging only, not used downstream.  
5. Push the resulting text string, tagged with sessionId, to rolling\_text\_buffer.py.  
6. Never batch multiple chunks together and never wait to accumulate more audio before running — process each chunk as it arrives.

**FILE: backend/buffer/rolling\_text\_buffer.py**

Purpose  
Maintain a short live window of recently transcribed words, splitting it into "stable" (ready to gloss) and "provisional" (context-only) portions.

Dependencies  
config.py (ROLLING\_BUFFER\_WORDS, PROVISIONAL\_WORDS), whisper\_service.py's output, feeds into ollama\_client.py (Phase 6).

Input  
New transcribed text segments, tagged with sessionId.

Output  
get\_commit\_batch() returning {stable\_words, provisional\_context} for the active session.

Algorithm

1. Maintain one word buffer per active sessionId.  
2. On each new text segment, split it into words and append them to that session's buffer.  
3. If the buffer exceeds ROLLING\_BUFFER\_WORDS, mark the oldest words (all but the newest PROVISIONAL\_WORDS) as eligible for commit ("stable"); the newest PROVISIONAL\_WORDS remain "provisional".  
4. Expose get\_commit\_batch(), returning the current stable words and the provisional words separately, without removing them from the buffer yet.  
5. Expose advance\_commit\_boundary(), which is called only after Phase 6 successfully processes a batch — this removes the committed stable words from the buffer, sliding the window forward.  
6. On a sessionId change (per session\_state.py), clear that session's buffer entirely and start fresh.

---

**PHASE 6 — GLOSS CONVERSION VIA OLLAMA (STEP 12, MODEL 3, FALLBACK E)**

**FILE: backend/gloss/prompts.py**

Purpose  
Hold the exact, verbatim Model 3 system prompt and few-shot examples as hardcoded constants — never regenerated or paraphrased by the agent.

Dependencies  
None.

Input  
None — content is copied directly from AI\_Model\_Specification\_Document.docx.

Output  
String constants SYSTEM\_PROMPT and FEW\_SHOT\_EXAMPLES, imported by ollama\_client.py.

Algorithm

1. Copy the 9-rule system prompt text character-for-character from the spec document into a SYSTEM\_PROMPT constant.  
2. Copy all 4 few-shot example input/output pairs character-for-character into a FEW\_SHOT\_EXAMPLES constant, in the same order as specified.  
3. Do not reformat, reword, shorten, or "clean up" any wording — treat this as fixed data, not editable text.  
4. Expose both constants for import by ollama\_client.py.

**FILE: backend/gloss/ollama\_client.py (complete)**

Purpose  
Build the per-cycle request payload, call Ollama's local API, and parse the response into a gloss array — discarding the cycle cleanly on any malformed output (Fallback E).

Dependencies  
prompts.py, rolling\_text\_buffer.py (get\_commit\_batch), dictionary\_loader.py \+ cislr\_index.py (for allowed\_vocab), config.py (OLLAMA\_HOST\_URL, OLLAMA\_MODEL\_NAME, OLLAMA\_TEMPERATURE, OLLAMA\_MAX\_TOKENS), httpx, vocab\_filter.py, ollama\_raw\_log.py.

Input  
{stable\_words, provisional\_context} from rolling\_text\_buffer.py; the shared allowed\_vocab set.

Output  
Either a validated gloss token array proceeding to render\_resolver.py (Phase 7), or a discarded cycle (buffer's commit boundary not advanced).

Algorithm

1. Build allowed\_vocab once, at first use — and only after both dictionary\_loader.py's and cislr\_index.py's startup validation passes have completed (Fallback F exclusions and CISLR missing-file exclusions must run first) — as the union of dictionary\_loader.py.keys() and cislr\_index.py.keys(), stored as a single shared Python set (reused every call, never rebuilt per request).  
2. On each pipeline cycle, call rolling\_text\_buffer.get\_commit\_batch() to obtain stable\_words and provisional\_context for the active session.  
3. If stable\_words is empty, skip this cycle entirely.  
4. Construct the request JSON: {stable\_words, provisional\_context, allowed\_vocab}.  
5. Build the full prompt payload combining prompts.SYSTEM\_PROMPT, prompts.FEW\_SHOT\_EXAMPLES, and the request JSON.  
6. POST to OLLAMA\_HOST\_URL/api/generate (or /api/chat) with temperature=OLLAMA\_TEMPERATURE, max\_tokens=OLLAMA\_MAX\_TOKENS, and format="json" if the installed Ollama client supports it.  
7. Log the raw response via ollama\_raw\_log.py before any parsing (successful or not).  
8. Attempt to parse the response body as JSON matching {"gloss": \[...\]}.  
9. If parsing fails or the shape doesn't match, discard this cycle's output entirely — do not call advance\_commit\_boundary() — and let the same stable words be retried next cycle with whatever new context has arrived (Fallback E).  
10. If parsing succeeds, pass the returned gloss array to vocab\_filter.py for validation before anything proceeds further.  
11. Only after vocab\_filter.py returns its (possibly reduced) validated list does this function call rolling\_text\_buffer.advance\_commit\_boundary() and forward the validated words to render\_resolver.py.

**FILE: backend/gloss/vocab\_filter.py**

Purpose  
Guarantee, independent of prompt compliance, that no gloss word reaching the render pipeline is outside the permitted vocabulary.

Dependencies  
The shared allowed\_vocab set (built in ollama\_client.py), ollama\_raw\_log.py (for logging dropped words).

Input  
The raw gloss array returned by Ollama (post-JSON-parse), plus the original stable\_words for logging context.

Output  
A filtered gloss array containing only validated words.

Algorithm

1. Receive the parsed gloss array and the original stable\_words input for this cycle.  
2. For each word in the gloss array, check case-insensitive membership in the allowed\_vocab set (O(1) lookup).  
3. If a word passes, keep it in the output list, preserving order.  
4. If a word fails, drop it silently from the output list and log it — including the original stable\_words that produced it — for later prompt-tuning review.  
5. Return the surviving, validated word list regardless of whether any words were dropped (an empty list is a valid result).  
6. This function always runs on every response passed to it — it is never bypassed, regardless of upstream JSON validity.

**FILE: backend/logs/ollama\_raw\_log.py**

Purpose  
Persist every raw Ollama response during rehearsal/testing to build a corpus for prompt tuning.

Dependencies  
None beyond standard file I/O.

Input  
Raw response text (successful or not), called from ollama\_client.py.

Output  
An append-only local log file.

Algorithm

1. Receive the raw response string and a timestamp.  
2. Append a new line/entry to a local log file containing the timestamp, the input stable\_words/provisional\_context that produced it, and the raw response text.  
3. Never overwrite or truncate the log — always append.  
4. Keep this logging active in both rehearsal and demo runs so failures remain traceable.

---

**PHASE 7 — DICTIONARY/VIDEO LOOKUP & RENDER MODE RESOLUTION (STEPS 13–14, FALLBACK A)**

**FILE: backend/lookup/render\_resolver.py**

Purpose  
Decide, per gloss word, exactly what gets rendered — avatar, video, or the unknown-word placeholder — based on lookup results and the user's selected mode.

Dependencies  
dictionary\_loader.py, cislr\_index.py, latency\_tracker.py (Phase 8, for the temporary video-only degrade override), config.py (PLACEHOLDER\_ASSET\_PATH).

Input  
A gloss word, the current render mode ("video"/"avatar"), and the current sessionId.

Output  
A render instruction {word, renderType, assetRef, sessionId}.

Algorithm

1. Uppercase the incoming gloss word, then look it up in dictionary\_loader.py (HamNoSys) and cislr\_index.py (video path) \--- both O(1) in-memory lookups against the same normalized-case dicts.  
2. If latency\_tracker.should\_degrade() is true, temporarily force mode to "video" regardless of the user's selection (Fallback G override), without changing the user's stored setting.  
3. If mode is "video": if a video path exists, set renderType="video", assetRef=videoPath; otherwise set renderType="unknown", assetRef=PLACEHOLDER\_ASSET\_PATH.  
4. If mode is "avatar": if a HamNoSys entry exists, set renderType="avatar", assetRef=hamnosysString; else if a video path exists, set renderType="video", assetRef=videoPath for this single word only (silent per-word fallback, mode setting itself unchanged); else set renderType="unknown", assetRef=PLACEHOLDER\_ASSET\_PATH.  
5. Attach the current sessionId to the instruction.  
6. Return the finalized instruction — this function is pure and stateless, taking only word/mode/session and returning one instruction, with no side effects.  
7. Log every "unknown" resolution for later review (Fallback A), but never skip a word silently — always emit an instruction.

---

**PHASE 8 — SESSION STATE & LATENCY MONITORING (STEP 18 BACKEND HALF, FALLBACK C/G/H)**

**FILE: backend/session/session\_state.py**

Purpose  
Single source of truth for the active sessionId per connection, consulted by every backend stage before queuing or emitting work.

Dependencies  
None beyond in-memory state; consulted by chunker.py, whisper\_service.py, ollama\_client.py, connection.py.

Input  
Session-lifecycle signals: new connection, confirmed seek (relayed from frontend), stream loss.

Output  
The current sessionId, and boolean validity checks for any given sessionId.

Algorithm

1. On new WebSocket connection, initialize a sessionId for that connection.  
2. Expose increment\_session(): called when the frontend relays a confirmed seek; increments the stored sessionId and signals downstream buffers (chunker, rolling text buffer) to clear for that connection.  
3. Expose freeze\_session(): called on stream loss (Fallback C); halts processing for that connection without incrementing sessionId or clearing buffers, since reconnection to the same content is expected.  
4. Expose resume\_session(): called when a genuinely new stream is established after a freeze — only this triggers a full sessionId increment/reset, not a mere reconnect.  
5. Expose is\_current(sessionId): returns whether a given sessionId still matches the live session for that connection — called by every stage before forwarding work (Phase 4, 5, 6, 7, 9).

**FILE: backend/monitoring/latency\_tracker.py**

Purpose  
Detect when combined GPU load is pushing end-to-end latency past target, and expose a signal that triggers temporary video-only degrade.

Dependencies  
config.py (LATENCY\_TARGET\_SECONDS, LATENCY\_DEGRADE\_THRESHOLD\_SECONDS, LATENCY\_WINDOW\_SIZE); timestamps recorded at chunk creation (Phase 4\) and final render dispatch (Phase 9).

Input  
Per-word timestamp pairs: chunk-creation time and final-render-dispatch time.

Output  
A rolling average latency value and a boolean should\_degrade() signal.

Algorithm

1. On each word's final render-instruction dispatch, compute its end-to-end latency (dispatch time minus its chunk's creation time).  
2. Append this value to a rolling window of the last LATENCY\_WINDOW\_SIZE words, dropping the oldest when full.  
3. Compute the current average of the window.  
4. Expose should\_degrade(): returns true if the average exceeds LATENCY\_DEGRADE\_THRESHOLD\_SECONDS.  
5. Expose the current average for statusIndicator.js (via the WebSocket, Phase 14\) to display as PROCESSING\_DELAY.  
6. Once the average drops back under threshold, should\_degrade() reverts to false automatically — no manual reset needed.

---

**PHASE 9 — WEBSOCKET BRIDGE, APP ASSEMBLY & STATIC SERVING (STEP 9, STEP 15, main.py COMPLETION)**

**FILE: backend/main.py (complete)**

Purpose  
Extend Phase 3's warm-up/health logic into a fully assembled FastAPI app: serving the frontend statically and exposing the WebSocket endpoint.

Dependencies  
Everything from Phase 3, plus backend/ws/connection.py, FastAPI's StaticFiles mounting.

Input  
None (application assembly, not runtime data).

Output  
A single runnable FastAPI app serving both the frontend and the backend pipeline.

Algorithm

1. Retain Phase 3's startup-event model warm-up and /health logic unchanged.  
2. Mount the frontend/ directory as static files at the app's root route.  
3. Register backend/ws/connection.py's WebSocket endpoint (e.g. at /ws) on the app.  
4. Start the app via Uvicorn on backend launch.  
5. Confirm on manual test that opening the root URL in Chrome loads index.html and that a WebSocket connection to /ws succeeds.

**FILE: backend/ws/connection.py (complete — send half added)**

Purpose  
Extend Phase 4's receive-only logic to also push finalized, session-valid render instructions out to the frontend.

Dependencies  
render\_resolver.py, session\_state.py, everything from Phase 4\.

Input  
Render instructions produced by render\_resolver.py.

Output  
Render instructions delivered to the frontend over the open WebSocket, or silently dropped if stale.

Algorithm

1. Retain Phase 4's receive-side logic (raw audio ingestion into chunker.py) unchanged.  
2. When render\_resolver.py produces a render instruction, check session\_state.is\_current(instruction.sessionId).  
3. If the instruction's sessionId matches the current session, send it to the frontend over the open WebSocket as a JSON message.  
4. If it does not match, drop it silently — do not send, do not log as an error (this is expected, routine invalidation from a seek).  
5. Keep the connection open for the life of the session; do not reconnect per message.

---

**PHASE 10 — FRONTEND SHELL & AVATAR IDLE STATE (STEP 2\)**

**FILE: frontend/index.html**

Purpose  
Static page shell presenting the control surface: start button, mode toggle, and the empty output window.

Dependencies  
Three.js (pinned version, CDN \<script\> tag), style.css, main.js.

Input  
None.

Output  
A rendered idle-state page.

Algorithm

1. Include a pinned-version Three.js \<script\> tag from CDN.  
2. Add a "Start Capture" button element.  
3. Add a mode toggle control (Video / Avatar), defaulting to one mode explicitly (e.g. Video).  
4. Add a fixed-position output-window \<div\> (\~300x200px, top z-index) containing two sibling children: a Three.js canvas element and a \<video\> element, both present but not yet visible.  
5. Add a status-indicator element placeholder (populated in Phase 14).  
6. Link style.css and load main.js as the entry script.

**FILE: frontend/style.css**

Purpose  
Fixed-position styling for the output window and supporting UI elements.

Dependencies  
index.html's element structure.

Input  
None.

Output  
CSS rules.

Algorithm

1. Define position: fixed styling for the output window, anchored bottom-right, \~300x200px, high z-index so it stays above other page content.  
2. Define display: none / display: block toggle classes for the two sibling render elements (canvas vs video), used by outputWindow.js in Phase 13\.  
3. Style the Start Capture button, mode toggle, and status indicator for basic legibility.

**FILE: frontend/main.js (skeleton)**

Purpose  
Application entry point and orchestrator; initializes the Three.js scene and loads the avatar into a neutral idle pose before any capture starts.

Dependencies  
Three.js, frontend/vendor/avatar.js, frontend/vendor/autoBoneMapper.js (both per Phase 2's confirmed APIs).

Input  
Page load event.

Output  
An initialized Three.js scene with the avatar posed neutrally, ready for later phases to extend.

Algorithm

1. On page load, initialize the Three.js scene, camera, and renderer targeting the output window's canvas element.  
2. Call avatar.js's confirmed load function to load human.glb into the scene.  
3. Pose the loaded avatar in a neutral rest position.  
4. Immediately after load completes, call autoBoneMapper.js's confirmed function once to build the bone-name translation table, storing its result for Phase 13's animation calls.  
5. Do not start any animation loop yet — this happens only once real render instructions begin arriving (Phase 13).  
6. Leave placeholders/hooks for later phases (capture button handler, WebSocket client, renderers, status indicator, session manager) to attach to, without implementing them yet.

---

**PHASE 11 — FRONTEND CAPTURE FLOW (STEPS 3–6)**

**FILE: frontend/capture/tabCapture.js**

Purpose  
Handle the user-gesture-gated tab/audio share flow.

Dependencies  
Browser MediaDevices API, main.js (click handler wiring), streamValidation.js.

Input  
User click on "Start Capture".

Output  
A MediaStream (video \+ audio track) or a caught rejection.

Algorithm

1. Attach a click handler to the Start Capture button.  
2. On click, call navigator.mediaDevices.getDisplayMedia({video: true, audio: true}) inside a try/catch block.  
3. If the promise resolves, pass the returned MediaStream to streamValidation.js.  
4. If the promise rejects (user cancels or denies), catch it and display a retry prompt rather than failing silently.  
5. Expose a re-triggerable entry point so sessionManager.js (Phase 15\) can call this same flow again on reconnect.

**FILE: frontend/capture/streamValidation.js**

Purpose  
Confirm the captured stream actually contains usable, non-silent audio before the pipeline proceeds.

Dependencies  
Web Audio API (AudioContext, AnalyserNode), tabCapture.js's output, statusIndicator.js (Phase 14).

Input  
A MediaStream from tabCapture.js.

Output  
Either a confirmed-valid stream passed to audioGraph.js (Phase 12), or an error state with a retry button.

Algorithm

1. Call stream.getAudioTracks(); if the array is empty, show "No audio detected — please re-share and check 'Share tab audio'" with a button that re-triggers tabCapture.js.  
2. If audio tracks exist, attach a temporary AudioContext and AnalyserNode to the stream.  
3. Sample the signal level for \~1–2 seconds.  
4. If real, non-zero signal energy is detected, mark the stream as valid and hand it off to audioGraph.js.  
5. If no signal energy is detected within the sampling window, keep the status at a "waiting for playback" state rather than failing outright, since the source video may not have been started yet (Step 6 is a manual user action outside this app's control).  
6. Continue lightweight background sampling so sessionManager.js (Phase 15\) can later use sustained-signal detection as an indirect seek/pause signal.

---

**PHASE 12 — FRONTEND AUDIO GRAPH & CONTINUOUS STREAMING (STEP 7 FRONTEND HALF, STEP 9 FRONTEND HALF)**

**FILE: frontend/audio/pcm-worklet-processor.js**

Purpose  
An AudioWorkletProcessor running on the audio thread, exposing raw PCM frames as they arrive.

Dependencies  
Web Audio API AudioWorklet.

Input  
Fixed-size blocks (typically 128 samples) of raw float32 PCM at the AudioContext's sample rate.

Output  
PCM blocks posted to the main thread via port.postMessage.

Algorithm

1. Register this file as an AudioWorkletProcessor module.  
2. On each fixed-size callback, receive the raw float32 PCM samples for that block.  
3. Post the block to the main thread via this.port.postMessage(block).  
4. Continue running for as long as the audio graph node remains connected.

**FILE: frontend/audio/audioGraph.js**

Purpose  
Establish the persistent low-level tap into decoded audio samples and accumulate them for continuous streaming.

Dependencies  
Web Audio API (AudioContext, MediaStreamAudioSourceNode, AudioWorkletNode), pcm-worklet-processor.js, streamValidation.js's validated stream, wsClient.js.

Input  
A validated MediaStream from streamValidation.js.

Output  
A growing in-memory float32 PCM buffer, forwarded continuously to wsClient.js.

Algorithm

1. Create an AudioContext with new AudioContext({ sampleRate: 16000 }) (falling back to backend-side resampling in chunker.py if Chrome does not honor this for a getDisplayMedia-sourced track — confirm during Phase 12's manual test) and wrap the validated MediaStream's audio track into a MediaStreamAudioSourceNode.  
2. Load and connect the pcm-worklet-processor.js module as an AudioWorkletNode downstream of the source node.  
3. On each port.onmessage event from the worklet, append the received PCM block into a growing main-thread buffer.  
4. Periodically (or on each received block) hand the accumulated buffer off to wsClient.js for transmission, then clear/reset the local accumulator.  
5. Keep this graph alive for the life of the capture session; tear it down only on stream loss (Fallback C, Phase 15\) or explicit stop.

**FILE: frontend/network/wsClient.js**

Purpose  
Maintain the single long-lived WebSocket connection to the backend, streaming audio out and receiving render instructions in.

Dependencies  
Native WebSocket API, audioGraph.js (outgoing audio), sessionManager.js (current sessionId), renderQueue.js (incoming instructions), statusIndicator.js (connection health).

Input  
PCM buffer chunks from audioGraph.js (outgoing); render instruction JSON messages from the backend (incoming).

Output  
Audio delivered to the backend; parsed render instructions delivered to renderQueue.js.

Algorithm

1. Open a single WebSocket connection to the backend's /ws endpoint once capture starts; keep it open for the whole session.  
2. On each outgoing PCM buffer from audioGraph.js, tag it with the current sessionId (from sessionManager.js) and a sequence number, then send it as a binary message.  
3. On each incoming message, parse it as a render instruction JSON object.  
4. Pass the parsed instruction to renderQueue.js.  
5. On socket error or close, notify statusIndicator.js to set status to RECONNECTING rather than failing silently.  
6. Expose a reconnect function callable by sessionManager.js without requiring a full page reload.

---

**PHASE 13 — FRONTEND RENDERERS & OUTPUT WINDOW (STEPS 15–17)**

**FILE: frontend/render/renderQueue.js**

Purpose  
Session-filtered queue of render instructions, guaranteeing stale instructions never reach the screen.

Dependencies  
wsClient.js (incoming instructions), sessionManager.js (current sessionId), videoRenderer.js, avatarRenderer.js.

Input  
Render instructions from wsClient.js.

Output  
Valid instructions dispatched in order to the appropriate renderer; stale ones dropped.

Algorithm

1. On receiving an instruction, compare its sessionId against sessionManager.js's current sessionId.  
2. If they don't match, drop the instruction immediately — do not enqueue.  
3. If they match, push the instruction onto an in-order queue.  
4. If the queue is not currently playing anything, dequeue the next instruction and dispatch it to videoRenderer.js or avatarRenderer.js based on its renderType (video/avatar/unknown, the last using the placeholder asset via videoRenderer.js or a static display, whichever is simpler to implement consistently).  
5. On a dispatched instruction's completion signal (from the active renderer), dequeue and dispatch the next instruction.  
6. If the queue becomes empty, remain idle until the next instruction arrives.

**FILE: frontend/render/videoRenderer.js**

Purpose  
Play the correct CISLR clip (or placeholder) for a word in the output window.

Dependencies  
HTML \<video\> element (from index.html), renderQueue.js.

Input  
A render instruction with assetRef pointing to a local video/placeholder path.

Output  
Video playback in the output window; a completion signal back to renderQueue.js.

Algorithm

1. Set the visible \<video\> element's src to the instruction's assetRef.  
2. Preload the next queued clip on a hidden second \<video\> element (preload="auto") while the current one plays, to avoid a visible load-stutter.  
3. Call .play() on the visible element.  
4. On the element's onended event, signal completion back to renderQueue.js to advance.  
5. If assetRef is the unknown-word placeholder, hold it visible for a short fixed duration (e.g. \~0.5s) instead of relying on a natural video end event, then signal completion.

**FILE: frontend/render/avatarRenderer.js**

Purpose  
Animate the 3D avatar to perform the sign for a word using HamNoSys-derived pose targets.

Dependencies  
frontend/vendor/hamnosysMap.js, autoBoneMapper.js's bone table (from main.js, Phase 10), SignEngine.js (confirmed API from Phase 2), renderQueue.js.

Input  
A render instruction with assetRef containing a HamNoSys string.

Output  
Avatar animation in the Three.js canvas; a completion signal back to renderQueue.js.

Algorithm

1. Pass the instruction's HamNoSys string to hamnosysMap.js's confirmed parsing function to obtain target bone-rotation poses.  
2. Resolve those abstract pose targets into this rig's actual bone names using the bone table built once in Phase 10 via autoBoneMapper.js.  
3. Call SignEngine.js's confirmed public "play this sign" function with the resolved pose targets.  
4. Listen for SignEngine.js's confirmed completion-signaling mechanism (event/callback/promise, per Phase 2's findings).  
5. If SignEngine.js does not already return to a neutral rest pose between signs, add that transition explicitly before signaling completion.  
6. On completion, signal back to renderQueue.js to advance.

**FILE: frontend/render/outputWindow.js**

Purpose  
Toggle which renderer's visual output (avatar canvas or video element) is currently visible.

Dependencies  
index.html's two sibling render elements, style.css's toggle classes, renderQueue.js (knows the active renderType).

Input  
The currently active renderType ("avatar" or "video").

Output  
The correct element visible, the other hidden — no re-initialization of either.

Algorithm

1. Keep both the Three.js canvas and the \<video\> element permanently present in the DOM inside the fixed output window.  
2. On each dispatched instruction, check its renderType.  
3. Apply display:block to the matching element and display:none to the other.  
4. Never destroy or recreate either element on a toggle — only visibility changes.

---

**PHASE 14 — STATUS INDICATOR & DEGRADE HANDLING (FALLBACK B, FRONTEND HALF OF FALLBACK G)**

**FILE: frontend/status/statusIndicator.js**

Purpose  
Give constant visibility into pipeline health via a small persistent UI element.

Dependencies  
tabCapture.js, streamValidation.js, wsClient.js, renderQueue.js (all call into this), backend's latency signal relayed over the WebSocket (Phase 8/9).

Input  
State-transition calls from other frontend modules; latency data relayed from the backend.

Output  
An updated colored-dot \+ label UI element.

Algorithm

1. Define an enum-backed state object with values: IDLE, LISTENING, NO\_AUDIO, RECONNECTING, PROCESSING\_DELAY.  
2. Expose a single setStatus(newState) function that updates the shared state object and re-renders the associated UI element.  
3. Have tabCapture.js call setStatus(LISTENING) once capture starts successfully.  
4. Have streamValidation.js call setStatus(NO\_AUDIO) on validation failure.  
5. Have wsClient.js call setStatus(RECONNECTING) on socket error/close.  
6. Have the backend relay its latency\_tracker.should\_degrade() signal over the WebSocket; on receiving it, call setStatus(PROCESSING\_DELAY); on receiving the "recovered" signal, revert to LISTENING.  
7. Keep this module deliberately simple — one state object, one setter, one UI subscriber.

---

**PHASE 15 — SEEK/PAUSE MONITORING, RECONNECT & DEBOUNCE (STEP 18 FRONTEND HALF, FALLBACK C/H FRONTEND HALF)**

**FILE: frontend/session/sessionManager.js**

Purpose  
Track the current sessionId, detect seeks/pauses/stream loss, and drive reconnect and debounce behavior.

Dependencies  
tabCapture.js (reconnect re-trigger), streamValidation.js's AnalyserNode signal (indirect seek detection), wsClient.js (relaying sessionId changes to backend), statusIndicator.js, config.js's SEEK\_DEBOUNCE\_MS equivalent constant defined client-side.

Input  
track.onended events; signal-discontinuity data from streamValidation.js's AnalyserNode.

Output  
An up-to-date currentSessionId; triggered reconnect flow; debounced session increments relayed to the backend.

Algorithm

1. Maintain currentSessionId at module level, initialized on first capture start.  
2. Attach a track.onended listener immediately after tabCapture.js's stream resolves.  
3. On track.onended firing (stream lost for any reason), call statusIndicator.setStatus(RECONNECTING), and do not increment sessionId or clear buffers — freeze in place.  
4. Expose a "Reconnect" action that re-triggers tabCapture.js's flow (Steps 3–6) without a full page reload; only on establishing a genuinely new stream does this increment currentSessionId.  
5. For seek detection, monitor the AnalyserNode signal for a discontinuity pattern (e.g. an abrupt silence-then-resume not matching normal pause behavior).  
6. On detecting a potential seek, start (or reset, if already running) a debounce timer of SEEK\_DEBOUNCE\_MS.  
7. Only once the debounce timer completes without being reset again, treat it as a genuine seek: increment currentSessionId, clear the local audio buffer accumulator in audioGraph.js, and send the new sessionId to the backend via wsClient.js so session\_state.py stays in sync.  
8. Ignore rapid repeated discontinuity events during the debounce window — they reset the timer rather than triggering multiple increments.

---

**PHASE 16 — FULL PIPELINE INTEGRATION**

No new files. This phase is a seam-check pass across every file built in Phases 3–15: trace one word end-to-end (audio → chunk → transcribe → buffer → gloss → filter → lookup → resolve → queue → render), confirm every handoff's data shape matches what the receiving file expects, confirm sessionId is correctly carried and checked at every stage, and fix any interface mismatches found between modules built in isolation across earlier phases.

---

**PHASE 17 — TESTING, REHEARSAL & THRESHOLD TUNING**

**FILE: tests/backend/test\_vad.py**

Purpose  
Verify vad.py's two functions behave correctly on known speech and non-speech samples.

Dependencies  
vad.py, tests/fixtures/sample\_audio/.

Input  
Real audio fixtures (some containing speech, some silence/music-only).

Output  
Pass/fail assertions.

Algorithm

1. Feed a known-silent fixture into score\_speech\_probability(); assert the result falls below VAD\_DISCARD\_THRESHOLD.  
2. Feed a known-speech fixture into score\_speech\_probability(); assert the result meets or exceeds the threshold.  
3. Feed a fixture with a clear internal pause into find\_silence\_point(); assert it returns a position near the expected pause.

**FILE: tests/backend/test\_chunker.py**

Purpose  
Verify chunk segmentation respects target/cap sizing and correctly discards non-speech chunks.

Dependencies  
chunker.py, vad.py, tests/fixtures/sample\_audio/.

Input  
A continuous real audio fixture longer than one chunk.

Output  
Pass/fail assertions.

Algorithm

1. Feed a continuous fixture through chunker.py; assert each emitted chunk is within the CHUNK\_TARGET\_SECONDS–CHUNK\_HARD\_CAP\_SECONDS range.  
2. Confirm chunks snap to silence points when present, and hard-cut at the cap when not.  
3. Confirm a chunk scored below VAD\_DISCARD\_THRESHOLD by vad.py never reaches the output queue.

**FILE: tests/backend/test\_whisper\_service.py**

Purpose  
Verify transcription output for known real audio fixtures.

Dependencies  
whisper\_service.py, tests/fixtures/sample\_audio/.

Input  
Real audio fixtures with known expected transcriptions.

Output  
Pass/fail assertions comparing output text to expected text (approximate match).

Algorithm

1. Feed each fixture chunk into whisper\_service.transcribe().  
2. Compare the returned text against the expected transcription for reasonable similarity.  
3. Confirm language="en" and task="transcribe" are always passed, never auto-detected.

**FILE: tests/backend/test\_ollama\_client.py**

Purpose  
Verify the gloss request/response cycle behaves correctly on real transcribed fragments from the demo material, and that malformed responses are handled per Fallback E.

Dependencies  
ollama\_client.py, prompts.py, vocab\_filter.py, real transcribed fragments from demo rehearsal.

Input  
Real stable\_words/provisional\_context pairs drawn from actual demo transcription output.

Output  
Pass/fail assertions; a reviewed log of raw responses.

Algorithm

1. Feed each real fragment through ollama\_client.py's full request cycle.  
2. Confirm a well-formed response produces a correctly reordered, article/copula-stripped gloss array.  
3. Simulate a malformed response (e.g. invalid JSON) and confirm the cycle is discarded without advancing the buffer's commit boundary.  
4. Review the accumulated ollama\_raw\_log.py output; if malformed/non-compliant output appears frequently, add new few-shot examples to prompts.py drawn from these specific observed failures — never increase model size as the fix.

**FILE: tests/backend/test\_vocab\_filter.py**

Purpose  
Confirm the vocabulary guarantee holds even when the model outputs off-vocabulary words.

Dependencies  
vocab\_filter.py.

Input  
Known off-vocabulary and malformed gloss arrays.

Output  
Pass/fail assertions.

Algorithm

1. Construct a gloss array containing a mix of valid and invalid (not-in-allowed\_vocab) words.  
2. Run it through vocab\_filter.py; assert only the valid words remain in the output.  
3. Assert the dropped words are logged with their originating stable\_words.  
4. Confirm the function never raises on an entirely invalid array — it returns an empty list instead.

**FILE: tests/backend/test\_render\_resolver.py**

Purpose  
Confirm avatar/video/unknown resolution logic is correct across all lookup-outcome combinations.

Dependencies  
render\_resolver.py, dictionary\_loader.py, cislr\_index.py.

Input  
Synthetic word/mode combinations covering every branch (both found, avatar-only, video-only, neither found; video mode; avatar mode).

Output  
Pass/fail assertions.

Algorithm

1. For each combination, call resolve\_render(word, mode) and assert the returned renderType/assetRef matches the expected branch from Step 14's logic.  
2. Specifically confirm the avatar-mode-missing-HamNoSys-but-has-video case substitutes video for that single word without altering the stored mode.  
3. Confirm the neither-found case always resolves to the placeholder, never an empty/skipped instruction.

**FILE: tests/backend/test\_session\_state.py**

Purpose  
Confirm session invalidation, freeze, and resume behave correctly.

Dependencies  
session\_state.py.

Input  
Simulated sequences of seek, freeze, and resume calls.

Output  
Pass/fail assertions.

Algorithm

1. Confirm increment\_session() changes the sessionId and that is\_current() correctly reflects the new value.  
2. Confirm freeze\_session() does not change the sessionId.  
3. Confirm resume\_session() after a freeze correctly increments only when a genuinely new stream is passed in.  
4. Confirm instructions tagged with an old sessionId return False from is\_current() after an increment.

**FILE: tests/fixtures/sample\_audio/**

Purpose  
Real audio clips drawn from the actual demo source material, used across the above tests and rehearsal runs — never fabricated or synthesized.

Dependencies  
None (human-supplied).

Input  
Human-provided recordings/extracts from the real demo video.

Output  
A fixed set of .wav files used consistently across test runs.

Algorithm

1. Human extracts short (\~2–5s) real audio segments from the actual demo source, covering speech, silence, and music-only cases.  
2. Save each as a 16-bit PCM WAV, 16kHz mono, matching the pipeline's expected input format.  
3. Never generate or fabricate synthetic speech/audio for these fixtures.

---

**End state after Phase 17:** every file above is implemented and unit-tested against real demo material, the full 18-step pipeline and all 8 fallbacks are exercised end-to-end at least once, GPU concurrency (Whisper \+ Ollama \+ Three.js) has been stress-tested on the actual RTX 3050, and thresholds in config.py are tuned from observed rehearsal behavior rather than left at defaults.

