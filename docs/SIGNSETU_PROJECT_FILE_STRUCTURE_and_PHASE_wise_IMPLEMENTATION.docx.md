SIGNSETU PROJECT STRUCTURE

signsetu/  
│  
├── frontend/ \# Vanilla JS \+ Three.js (CDN, no bundler) \# No Python/model logic  
│ ├── index.html \# Step 2: Start button, mode toggle, output window shell  
│ ├── style.css \# Step 2/17: Fixed-position output window styling  
│ ├── main.js \# Orchestrator: wires all frontend modules, owns sessionId  
│ │  
│ ├── capture/  
│ │ ├── tabCapture.js \# Steps 3–6: getDisplayMedia, source picker  
│ │ └── streamValidation.js \# Step 5: getAudioTracks() \+ AnalyserNode signal check  
│ │  
│ ├── audio/  
│ │ ├── audioGraph.js \# Step 7: AudioContext \+ AudioWorkletNode raw PCM tap  
│ │ └── pcm-worklet-processor.js \# AudioWorklet module (128-sample callback → postMessage)  
│ │  
│ ├── network/  
│ │ └── wsClient.js \# Step 9: WebSocket send/receive, sessionId \+ seq tagging  
│ │  
│ ├── render/  
│ │ ├── outputWindow.js \# Step 17: Toggles avatar canvas vs video element  
│ │ ├── videoRenderer.js \# Step 16A: playback, preload-next-clip  
│ │ ├── avatarRenderer.js \# Step 16B: Glue calling into SignEngine.js  
│ │ └── renderQueue.js \# Step 15: Session-filtered render queue  
│ │  
│ ├── status/  
│ │ └── statusIndicator.js \# Fallback B: IDLE/LISTENING/NO\_AUDIO/  
│ │ \# RECONNECTING/PROCESSING\_DELAY  
│ │  
│ ├── session/  
│ │ └── sessionManager.js \# Step 18, Fallback C/H: sessionId increments,  
│ \# seek/pause, debounce, reconnect  
│ │  
│ └── vendor/ \#  REUSED FROM speech-to-isl REPO  \# Copied unmodified  
│ ├── hamnosysMap.js \# REUSED — HamNoSys string → bone-rotation pose targets  
│ ├── autoBoneMapper.js \# REUSED — Rig bone-name translation table  
│ ├── SignEngine.js \# REUSED — Three.js pose interpolation/animation loop  
│ ├── avatar.js \# REUSED — Loads human.glb, neutral rest pose  
│ └── models/  
│ └── human.glb \# REUSED — Binary 3D avatar asset  
│  
├── backend/ \# FastAPI, Python 3.10+  \# No frontend/DOM logic  
│ ├── main.py \# Step 1: App entry, /health, model warm-up orchestration  
│ ├── config.py \# All tunable thresholds  
│ │ \# (VAD cutoff, latency limit, debounce ms, etc.)  
│ │  
│ ├── ws/  
│ │ └── connection.py \# WebSocket endpoint: audio in, render instructions out,  
│ \# per-session state  
│ │  
│ ├── audio/  
│ │ ├── vad.py \# Model 2 (Silero-VAD): boundary snap (Step 8\) \+  
│ │ \# hallucination gate (Fallback D)  
│ │ └── chunker.py \# Step 8: Rolling buffer, \~100–200 ms timer loop,  \# VAD-assisted cut  
│ │  
│ ├── transcription/  
│ │ └── whisper\_service.py \# Model 1 (faster-whisper): Step 10,  
│ \# GPU, beam\_size 1–2, lang="en"  
│ │  
│ ├── buffer/  
│ │ └── rolling\_text\_buffer.py \# Step 11: Stable/provisional window,\# commit boundary  
│ │  
│ ├── gloss/  
│ │ ├── ollama\_client.py \# Model 3: Builds payload, calls Ollama /api/generate  
│ │ ├── prompts.py \# Model 3: Verbatim system prompt \+ 4 few-shot examples  
│ │ └── vocab\_filter.py \# Model 3: Mandatory post-response allowed\_vocab  
│ \# filter \+ logging  
│ │  
│ ├── lookup/  
│ │ ├── dictionary\_loader.py \# Step 1/13, Fallback F:  
│ │ \# Loads \+ validates isl\_dictionary.json  
│ │ ├── cislr\_index.py \# Step 1/13: Builds gloss → video-path index  
│ │ \# from dataset.csv  
│ │ └── render\_resolver.py \# Step 14: Per-word avatar/video/fallback decision  
│ │  
│ ├── session/  
│ │ └── session\_state.py \# sessionId tracking, seek invalidation,  
│ \# Fallback C/H hooks  
│ │  
│ ├── monitoring/  
│ │ └── latency\_tracker.py \# Fallback G: Rolling per-word latency,  
│ \# PROCESSING\_DELAY trigger  
│ │  
│ ├── logs/  
│ │ └── ollama\_raw\_log.py \# Logs every raw Ollama response during rehearsal  
│ │  
│ └── legacy\_reference/ \# NOT WIRED IN — Skim-only, per Code Reuse doc  
│ ├── isl\_nlp.py \# REFERENCE ONLY — Role replaced by  
│ │ \# ollama\_client.py \+ render\_resolver.py  
│ └── app.py \# REFERENCE ONLY — Role replaced by  
│ \# main.py \+ ws/connection.py  
│  
├── assets/  
│ ├── isl\_dictionary.json \# REUSED — 250+ gloss → HamNoSys entries,  
│ │ \# unmodified  
│ │  
│ ├── cislr/  
│ │ ├── dataset.csv \# Source metadata for building the video index  
│ │ │ \# once at startup  
│ │ └── clips/ \# Pre-downloaded, locally cached CISLR clips  
│ │ \# (never streamed live)  
│ │  
│ └── placeholder/  
│ └── unknown\_word.png \# Fallback A: Visible placeholder for  
│ \# unrenderable words  
│  
├── docs/ \# Source specs, kept in-repo for traceability  
│ ├── SignSetu.docx  
│ ├── sin\_setu\_Code\_Reuse.docx  
│ └── AI\_Model\_Specification\_Document.docx  
│  
├── tests/  
│ ├── backend/  
│ │ ├── test\_vad.py  
│ │ ├── test\_chunker.py  
│ │ ├── test\_whisper\_service.py  
│ │ ├── test\_ollama\_client.py  
│ │ ├── test\_vocab\_filter.py  
│ │ ├── test\_render\_resolver.py  
│ │ └── test\_session\_state.py  
│ │  
│ └── fixtures/  
│ └── sample\_audio/ \# Short real clips for rehearsal-style testing  
│  
└── requirements.txt

**2\. Component → Pipeline Step Mapping**

**Backend**

| Path | Implements | Step/Fallback |
| ----- | ----- | ----- |
| backend/main.py | model warm-up, /health | Step 1 |
| backend/audio/vad.py | boundary snap \+ hallucination gate | Step 8, Fallback D |
| backend/audio/chunker.py | rolling buffer \+ cut logic | Step 8 |
| backend/transcription/whisper\_service.py | GPU transcription | Step 10 |
| backend/buffer/rolling\_text\_buffer.py | stable/provisional window | Step 11 |
| backend/gloss/ollama\_client.py \+ prompts.py | gloss conversion | Step 12, Model 3 |
| backend/gloss/vocab\_filter.py | vocabulary guarantee | Model 3 (mandatory filter), Fallback E |
| backend/lookup/dictionary\_loader.py | avatar vocab load \+ validate | Step 1/13, Fallback F |
| backend/lookup/cislr\_index.py | video vocab load | Step 1/13 |
| backend/lookup/render\_resolver.py | avatar/video/unknown decision | Step 14, Fallback A |
| backend/session/session\_state.py | session invalidation | Step 18, Fallback C/H |
| backend/monitoring/latency\_tracker.py | GPU-slowdown degrade | Fallback G |
| backend/ws/connection.py | frontend bridge | Step 9, 15 |

**Frontend**

| Path | Implements | Step/Fallback |
| ----- | ----- | ----- |
| frontend/index.html, main.js | idle shell | Step 2 |
| frontend/capture/tabCapture.js | share picker flow | Steps 3-4, 6 |
| frontend/capture/streamValidation.js | audio-present check | Step 5 |
| frontend/audio/audioGraph.js | raw PCM tap | Step 7 |
| frontend/network/wsClient.js | chunk transfer | Step 9 |
| frontend/render/renderQueue.js | session filter | Step 15 |
| frontend/render/videoRenderer.js | video playback | Step 16A |
| frontend/render/avatarRenderer.js | avatar animation glue | Step 16B |
| frontend/render/outputWindow.js | visible output | Step 17 |
| frontend/status/statusIndicator.js | health UI | Fallback B |
| frontend/session/sessionManager.js | seek/pause handling | Step 18, Fallback C/H |
| frontend/vendor/\*.js, human.glb | avatar rig \+ animation | Step 2 (load), 16B |

**SignSetu — Full Phase-Wise Implementation Plan**

*(Blank IDE → fully integrated, testable product. Every phase lists exact files touched, \[HUMAN\] steps, \[AI\] steps, and the development approach.)*

---

**Phase 0 — Environment, Repository & Documentation Setup**

**Files:** docs/SignSetu.docx, docs/sin\_setu\_Code\_Reuse.docx, docs/AI\_Model\_Specification\_Document.docx, requirements.txt, top-level signsetu/ folder skeleton

**\[HUMAN\]**

* Create a blank project folder, initialize git.  
* Install a CUDA-compatible NVIDIA driver at OS level; confirm with nvidia-smi.  
* Install the matching CUDA toolkit version for the planned PyTorch/CTranslate2 build.  
* Install Python 3.10+ system-wide; create and activate a virtual environment.  
* Install Google Chrome/Chromium (the demo browser).  
* Install Ollama as a standalone app; run ollama serve; ollama pull llama3.2:3b (or chosen equivalent).  
* Create a Hugging Face account and accept CISLR's dataset access terms (needed before Phase 2).  
* Place the three source .docx spec files into docs/.

**\[AI\]**

* Scaffold the full directory tree (empty folders, \_\_init\_\_.py in each backend subpackage).  
* Write requirements.txt: fastapi, uvicorn\[standard\], faster-whisper, ctranslate2, torch (CUDA build), silero-vad, numpy, soundfile, httpx, pydantic, python-dotenv.  
* Run pip install \-r requirements.txt in the human-activated venv and report any errors.

**Approach:** No application code yet — pure environment bring-up. Exit condition: venv active with all packages installed, Ollama serving locally with the model pulled, torch.cuda.is\_available() returns True, docs present.

**Refer to:** SignSetu.docx — "Finalized Tech Stack", "Hardware Requirements", "Non-Python Installs", "Python Packages" sections.

---

**Phase 1 — Project Skeleton & Configuration**

**Files:** backend/config.py, backend/\_\_init\_\_.py \+ subpackage inits (ws/, audio/, transcription/, buffer/, gloss/, lookup/, session/, monitoring/, logs/, legacy\_reference/)

**\[HUMAN\]** Review the chosen numeric defaults against demo hardware assumptions.

**\[AI\]**

* Write backend/config.py with every tunable constant named in the docs: VAD\_DISCARD\_THRESHOLD (0.3, tune 0.3–0.5), CHUNK\_TARGET\_SECONDS (1.5–2), CHUNK\_HARD\_CAP\_SECONDS (2), CHUNK\_CHECK\_INTERVAL\_MS (100–200), ROLLING\_BUFFER\_WORDS (5–6), PROVISIONAL\_WORDS (2–3), OLLAMA\_TEMPERATURE (0.1–0.2), OLLAMA\_MAX\_TOKENS (100–150), LATENCY\_TARGET\_SECONDS (5), LATENCY\_DEGRADE\_THRESHOLD\_SECONDS (6–7), SEEK\_DEBOUNCE\_MS (150–200), WHISPER\_BEAM\_SIZE (1–2), WHISPER\_LANGUAGE ("en").  
* Create empty backend package directories with \_\_init\_\_.py files.

**Approach:** One flat config module — every other file imports constants from here; never hardcode a number elsewhere.

**Refer to:** SignSetu.docx — "Technical requirements"/"Implementation approach" under every Step and Fallback; AI\_Model\_Specification\_Document.docx — Model 1/2/3 "Model configuration" subsections.

---

**Phase 2 — Static Asset Acquisition & Legacy Repo Verification**

**Files:** assets/isl\_dictionary.json, frontend/vendor/hamnosysMap.js, frontend/vendor/autoBoneMapper.js, frontend/vendor/SignEngine.js, frontend/vendor/avatar.js, frontend/vendor/models/human.glb, backend/legacy\_reference/isl\_nlp.py, backend/legacy\_reference/app.py, assets/cislr/dataset.csv, assets/cislr/clips/, assets/placeholder/unknown\_word.png

**\[HUMAN\]**

* Complete Hugging Face CISLR access-terms acceptance.  
* If the IDE environment has no internet access, manually download dataset.csv and the required CISLR video clips, and manually download each of the 6 reused speech-to-isl files from [https://github.com/jayakarthik07/speech-to-isl](https://github.com/jayakarthik07/speech-to-isl), pasting contents at the exact target paths above.  
* Visually sanity-check human.glb in any GLB viewer to confirm it isn't corrupted.

**\[AI\]**

* Attempt to fetch all 6 reused files directly from the repo. If successful, copy verbatim into frontend/vendor/ — do not modify a line.  
* Read each fetched file in full before anything later references it. Confirm: hamnosysMap.js's exported parse function name/signature; autoBoneMapper.js's exported function and trigger point; SignEngine.js's public "play sign" function and its exact completion-signaling mechanism (event/callback/promise — do not assume); avatar.js's load/pose function.  
* Record a short findings note (comment block or scratch doc) with each file's confirmed API, for later phases to use.  
* Copy isl\_nlp.py and app.py into backend/legacy\_reference/ for read-only reference — never import or call them.  
* Write a throwaway script to parse dataset.csv, confirm the expected gloss/video-path columns, and download/cache the demo-vocabulary video clips into assets/cislr/clips/.  
* Create assets/placeholder/unknown\_word.png — a simple, visually distinct graphic (e.g. grey box with "?"); fine to generate programmatically since it's a UI placeholder, not demo data.

**Approach:** "Verify before you build" — nothing downstream may assume any of these files' internal APIs until the AI has actually opened them.

**Refer to:** sin\_setu\_Code\_Reuse.docx — entire document, especially each file's "Instruction to AI agent" line and the closing "Standing instruction"; SignSetu.docx — Fallback A (placeholder spec), Static Assets checklist.

---

**Phase 3 — Backend Model Bootstrapping (Step 1\)**

**Files:** backend/main.py (warm-up portion), backend/transcription/whisper\_service.py (init), backend/audio/vad.py (init/load only), backend/gloss/ollama\_client.py (warm-up call only), backend/lookup/dictionary\_loader.py, backend/lookup/cislr\_index.py

**\[HUMAN\]** Run the backend once and visually confirm all three models report ready.

**\[AI\]**

* whisper\_service.py: instantiate faster-whisper "small" with compute\_type="float16", device="cuda"; expose init().  
* vad.py: load the silero-vad ONNX model once; expose the loaded instance for reuse by both Step 8 and Fallback D (Phase 4\) — never instantiate twice.  
* ollama\_client.py: implement warm\_up() — a trivial throwaway POST to /api/generate, response discarded.  
* dictionary\_loader.py: load isl\_dictionary.json into an in-memory dict at startup; run every entry's HamNoSys string through a parser check mirroring hamnosysMap.js's recognized token set (per Phase 2's findings note); exclude and log entries that fail (Fallback F).  
* cislr\_index.py: build the gloss→video-path dict once from assets/cislr/dataset.csv, matched against assets/cislr/clips/.  
* main.py: run all four loaders/warm-ups concurrently at startup; /health reports ready only once all four succeed.

**Approach:** Everything here runs once, at process start, never per-request — this is what every later runtime step depends on being already resident in memory.

**Refer to:** SignSetu.docx — Step 1, Fallback F in full; AI\_Model\_Specification\_Document.docx — Model 1 & Model 2 "Training/prompting" and "Other instructions" subsections.

---

**Phase 4 — Backend Audio Ingestion, VAD Chunking & Hallucination Gate (Steps 7–8, Fallback D)**

**Files:** backend/ws/connection.py (audio-receive portion), backend/audio/chunker.py, backend/audio/vad.py (complete — both responsibilities)

**\[HUMAN\]** Confirm the chunking-location decision (backend-side, per Step 1's explicit model residency — the source doc is ambiguous here) before this phase starts.

**\[AI\]**

* vad.py: implement two functions off the single loaded instance — find\_silence\_point(buffer\_tail) for Step 8's cut-point snapping, and score\_speech\_probability(chunk) for Fallback D's gate.  
* chunker.py: maintain a per-session rolling raw-PCM buffer; check it every CHUNK\_CHECK\_INTERVAL\_MS; near CHUNK\_TARGET\_SECONDS, snap via find\_silence\_point(), else hard-cut at CHUNK\_HARD\_CAP\_SECONDS; before queuing, call score\_speech\_probability() and drop the chunk if below VAD\_DISCARD\_THRESHOLD (log the drop, never forward it).  
* connection.py: accept the continuous raw audio stream from the frontend, feed it into chunker.py's per-session buffer, tagging chunks with sessionId \+ sequence number.

**Approach:** Silence detection and hallucination gating share one loaded VAD instance — two thin functions around it, never duplicated. Discarded chunks never reach Phase 5\.

**Refer to:** SignSetu.docx — Step 7, Step 8, Fallback D in full; AI\_Model\_Specification\_Document.docx — Model 2 section in full.

---

**Phase 5 — Transcription & Rolling Text Buffer (Steps 10–11)**

**Files:** backend/transcription/whisper\_service.py (complete), backend/buffer/rolling\_text\_buffer.py

**\[HUMAN\]** None.

**\[AI\]**

* whisper\_service.py: implement transcribe(chunk) calling model.transcribe(chunk\_audio, language="en", task="transcribe", beam\_size=WHISPER\_BEAM\_SIZE); return only .text, log timestamps/confidence for debugging only; run in a dedicated worker pulling from chunker.py's per-session queue in strict order, discarding chunks whose sessionId no longer matches.  
* rolling\_text\_buffer.py: append new words to a per-session sliding window; once it exceeds ROLLING\_BUFFER\_WORDS, mark the oldest "stable" and the newest PROVISIONAL\_WORDS "provisional"; expose get\_commit\_batch() returning {stable\_words, provisional\_context}, and advance\_commit\_boundary() called only after Phase 6 succeeds.

**Approach:** Strict, in-order, per-session pipeline stage — never batch chunks together, never advance the commit boundary before the corresponding gloss request succeeds.

**Refer to:** SignSetu.docx — Step 10, Step 11 in full; AI\_Model\_Specification\_Document.docx — Model 1 section in full.

---

**Phase 6 — Gloss Conversion via Ollama (Step 12, Model 3, Fallback E)**

**Files:** backend/gloss/prompts.py, backend/gloss/ollama\_client.py (complete), backend/gloss/vocab\_filter.py, backend/logs/ollama\_raw\_log.py

**\[HUMAN\]** Review the copy-pasted prompt text character-for-character against the source doc before treating it as final — the single highest-consequence exact-text dependency in the project.

**\[AI\]**

* prompts.py: hardcode the exact system prompt (all 9 rules) and all 4 few-shot examples from AI\_Model\_Specification\_Document.docx verbatim as Python string constants — no paraphrasing or reformatting.  
* Expose allowed\_vocab as a single shared Python set, built once in Phase 3 — after both dictionary\_loader.py's Fallback F validation and cislr\_index.py's missing-clip exclusion have already run — from the union of dictionary\_loader.py's keys and cislr\_index.py's keys.  
* ollama\_client.py: build {stable\_words, provisional\_context, allowed\_vocab} from Phase 5's output; POST to Ollama's local /api/generate (or /api/chat) with temperature=OLLAMA\_TEMPERATURE, format="json" if supported, max\_tokens=OLLAMA\_MAX\_TOKENS; parse the response as {"gloss": \[...\]}; on parse failure/schema mismatch, discard the cycle and do not advance the commit boundary (Fallback E) — same stable words retry next cycle with fresh context.  
* vocab\_filter.py: regardless of parse success, check every returned word against allowed\_vocab (O(1)); silently drop and log (with the original stable\_words) any failure; only surviving words are returned, and only then is advance\_commit\_boundary() called.  
* ollama\_raw\_log.py: append every raw Ollama response (successful or not), timestamped, to a local rehearsal log file.

**Approach:** Two independent protection layers — the prompt reduces how often bad output occurs; the code-level filter guarantees correctness regardless of prompt compliance. The filter always runs.

**Refer to:** AI\_Model\_Specification\_Document.docx — Model 3 section in full (authoritative for exact prompt text and config); SignSetu.docx — Step 12, Fallback E.

---

**Phase 7 — Dictionary/Video Lookup & Render Mode Resolution (Steps 13–14, Fallback A)**

**Files:** backend/lookup/render\_resolver.py

**\[HUMAN\]** None.

**\[AI\]**

* For each validated gloss word from Phase 6, look up both dictionary\_loader.py's dict (HamNoSys) and cislr\_index.py's dict (video path) — both O(1) in-memory, no I/O.  
* Implement resolve\_render(word, mode) as a pure, stateless function: if mode \== "video", always resolve to videoPath (or "unknown" if missing); if mode \== "avatar", prefer hamnosys, falling back to videoPath for that single word only (without switching the user's overall mode); if both miss, resolve to the Fallback A "unknown" type pointing at assets/placeholder/unknown\_word.png, logged — never a silent skip.

**Approach:** Keep this pure and unit-testable in isolation, no session/queue state touched — just word \+ mode in, render instruction out. Tested directly in Phase 17\.

**Refer to:** SignSetu.docx — Step 13, Step 14, Fallback A in full.

---

**Phase 8 — Session State & Latency Monitoring (backend half of Step 18, Fallback C/G/H)**

**Files:** backend/session/session\_state.py, backend/monitoring/latency\_tracker.py

**\[HUMAN\]** None.

**\[AI\]**

* session\_state.py: track current sessionId per connection; expose increment\_session() (called on a confirmed seek relayed from the frontend), freeze\_session() (called on stream loss — Fallback C — pausing processing without clearing buffers), and is\_current(sessionId) used by every downstream stage before queuing/emitting work.  
* latency\_tracker.py: record a timestamp at chunk creation and at final render-instruction dispatch per word; maintain a rolling average of the last 5–10 words; expose should\_degrade() when the average exceeds LATENCY\_DEGRADE\_THRESHOLD\_SECONDS, checked by Phase 7's render\_resolver.py to temporarily force video-only mode until latency recovers.

**Approach:** session\_state.py is the single source of truth every backend module consults — no module keeps its own separate notion of "current session."

**Refer to:** SignSetu.docx — Step 18, Fallback C, Fallback G in full (Fallback H's debounce timer lives on the frontend — Phase 15 — but its eventual increment calls into this file).

---

**Phase 9 — WebSocket Bridge, App Assembly & Static Serving (Step 9, Step 15, main.py completion)**

**Files:** backend/ws/connection.py (complete — send half added), backend/main.py (complete — static/route mounting added)

**\[HUMAN\]** Run the backend and manually open the (still mostly empty) frontend page in Chrome — confirm the server starts, /health responds, and the WebSocket connects without error. First true integration checkpoint.

**\[AI\]**

* main.py: mount frontend/ as static files served by the FastAPI app; register connection.py's WebSocket endpoint; keep Phase 3's warm-up/health logic intact.  
* connection.py: complete the send half — after render\_resolver.py (Phase 7\) produces a render instruction, check it against session\_state.is\_current() (Phase 8\) and, if valid, push it to the frontend over the open WebSocket; if not, drop silently (Step 15's session-filtered push, enforced backend-side before it's even sent).

**Approach:** First phase where the backend is a runnable, connectable server end-to-end — treat as an integration checkpoint.

**Refer to:** SignSetu.docx — Step 9, Step 15 in full.

---

**Phase 10 — Frontend Shell & Avatar Idle State (Step 2\)**

**Files:** frontend/index.html, frontend/style.css, frontend/main.js (skeleton)

**\[HUMAN\]** Open the page and visually confirm the avatar loads in a neutral rest pose with no console errors — first visual checkpoint.

**\[AI\]**

* index.html: static page — "Start Capture" button, mode toggle (Video/Avatar), fixed-position output-window \<div\> (empty, idle), Three.js via pinned CDN \<script\> tag.  
* style.css: fixed-position styling for the \~300x200px output window, top z-index.  
* main.js: initialize the Three.js scene/camera/renderer on load; call avatar.js's confirmed load function (Phase 2's findings note) to load human.glb and pose it neutral; call autoBoneMapper.js's confirmed function once, immediately after GLB load, to build the bone-name table used in Phase 13; no animation loop yet.

**Approach:** Front-load the GLB parse cost to page-load time so it never delays the first real sign later.

**Refer to:** SignSetu.docx — Step 2 in full; sin\_setu\_Code\_Reuse.docx — avatar.js and autoBoneMapper.js entries (use confirmed API from Phase 2, not the description alone).

---

**Phase 11 — Frontend Capture Flow (Steps 3–6)**

**Files:** frontend/capture/tabCapture.js, frontend/capture/streamValidation.js, frontend/main.js (extended)

**\[HUMAN\]** Physically rehearse the flow once: open a YouTube/Spotify tab, click Start Capture, select the correct tab, check "Share tab audio," click play on the source — confirm no errors. Explicitly the step most likely to go wrong live, so this walk-through is mandatory.

**\[AI\]**

* tabCapture.js: click handler calling navigator.mediaDevices.getDisplayMedia({video:true, audio:true}) in try/catch; on rejection, show a retry prompt rather than failing silently.  
* streamValidation.js: check stream.getAudioTracks().length; if zero, show "No audio detected — please re-share and check 'Share tab audio'" with a button re-triggering tabCapture.js; if non-empty, attach a brief AudioContext \+ AnalyserNode (\~1–2s) to confirm real signal energy before proceeding.  
* main.js: wire a UI reminder ("Make sure the source is playing before sharing"); gate all later steps behind streamValidation.js's result.

**Approach:** No code fires on Step 6 itself (user pressing play on an external tab) — it's inferred via AnalyserNode detecting sustained signal, already handled in streamValidation.js.

**Refer to:** SignSetu.docx — Steps 3–6 in full.

---

**Phase 12 — Frontend Audio Graph & Continuous Streaming (Step 7 frontend half, Step 9 frontend half)**

**Files:** frontend/audio/audioGraph.js, frontend/audio/pcm-worklet-processor.js, frontend/network/wsClient.js, frontend/main.js (extended)

**\[HUMAN\]** Confirm via browser dev-tools that audio frames are actually flowing over the WebSocket once wired in.

**\[AI\]**

* pcm-worklet-processor.js: an AudioWorkletProcessor receiving fixed-size \~128-sample float32 PCM blocks, posting them via port.postMessage.  
* audioGraph.js: wrap the validated MediaStream's audio track into an AudioContext source node, attach the AudioWorkletNode (never the deprecated ScriptProcessorNode), accumulate blocks into a growing main-thread buffer.  
* wsClient.js: open a single long-lived WebSocket for the session; continuously stream the accumulated raw PCM buffer to the backend (chunking happens backend-side, per Phase 4); tag every outgoing message with the current sessionId; on socket close/error, surface it to statusIndicator.js (Phase 14\) rather than failing silently.

**Approach:** Frontend's only job here is capture \+ continuous transport — no chunk-cutting logic lives here.

**Refer to:** SignSetu.docx — Step 7, Step 9 in full.

---

**Phase 13 — Frontend Renderers & Output Window (Steps 15–17)**

**Files:** frontend/render/renderQueue.js, frontend/render/videoRenderer.js, frontend/render/avatarRenderer.js, frontend/render/outputWindow.js, frontend/main.js (extended)

**\[HUMAN\]** Watch a short real test run once complete and confirm signs render in correct order with no visible stutter — visual/timing checkpoint.

**\[AI\]**

* renderQueue.js: receive render instructions from wsClient.js; before enqueueing, compare instruction.sessionId against the frontend's own tracked current session (owned by Phase 15\) — drop if mismatched.  
* videoRenderer.js: set a \<video\> element's src to the resolved local clip path, call .play(), advance the queue on .onended; preload the next queued clip on a hidden second element.  
* avatarRenderer.js: call SignEngine.js's confirmed public play-sign function (Phase 2's findings note) with HamNoSys-derived pose targets (via hamnosysMap.js and the bone table from autoBoneMapper.js, both loaded in Phase 10); listen for SignEngine.js's actual confirmed completion signal to advance the queue; return to neutral rest pose between words if SignEngine.js doesn't already do so (confirm, don't assume).  
* outputWindow.js: both avatar canvas and video element exist in the DOM at all times; toggle display:none/block based on active mode — never re-initialize on a mode switch.

**Approach:** Both renderers advance the same shared queue on their own completion event, so words play strictly sequentially, never overlapping, even across mixed avatar/video sequences.

**Refer to:** SignSetu.docx — Steps 15–17 in full; sin\_setu\_Code\_Reuse.docx — SignEngine.js, hamnosysMap.js, autoBoneMapper.js entries (confirmed APIs only).

---

**Phase 14 — Status Indicator & Degrade Handling (Fallback B, frontend half of Fallback G)**

**Files:** frontend/status/statusIndicator.js, frontend/main.js (extended)

**\[HUMAN\]** None.

**\[AI\]**

* statusIndicator.js: implement the enum-backed state object with states IDLE, LISTENING, NO\_AUDIO, RECONNECTING, PROCESSING\_DELAY; a small UI element (colored dot \+ label) subscribed to it; every relevant module (tabCapture.js, streamValidation.js, wsClient.js, renderQueue.js) calls setStatus() on its own transitions.  
* Wire a PROCESSING\_DELAY display trigger off a backend-sent latency signal (Phase 8's latency\_tracker.py) relayed over the WebSocket, rather than the frontend independently re-measuring latency.

**Approach:** Deliberately simple — a diagnostic aid, not a feature; one shared state object, one setStatus() function, one subscribed UI element.

**Refer to:** SignSetu.docx — Fallback B in full, Fallback G in full.

---

**Phase 15 — Seek/Pause Monitoring, Reconnect & Debounce (Step 18 frontend half, Fallback C/H frontend half)**

**Files:** frontend/session/sessionManager.js, frontend/main.js (extended)

**\[HUMAN\]** Manually rewind/fast-forward/pause the source video a few times during a live test and confirm output doesn't glitch or show stale signs — the trickiest failure mode to catch by code review alone.

**\[AI\]**

* sessionManager.js: maintain currentSessionId; listen for track.onended (stream lost — Fallback C), setting status to RECONNECTING via statusIndicator.js without clearing sessionId/buffers, offering a one-click "Reconnect" that re-triggers tabCapture.js's flow (Steps 3–6) without a full page reload; for seek detection (indirectly, via AnalyserNode signal discontinuity, since the source tab isn't directly controllable), debounce 150–200ms (Fallback H) before incrementing sessionId and clearing the chunk buffer, relaying the new sessionId to the backend via wsClient.js so session\_state.py (Phase 8\) stays in sync.

**Approach:** Only increment sessionId (a full reset) on a genuinely new stream — a mere disconnect/reconnect to the same content should not discard context unnecessarily.

**Refer to:** SignSetu.docx — Step 18, Fallback C, Fallback H in full.

---

**Phase 16 — Full Pipeline Integration**

**Files:** None new — wiring/fix pass across all files built in Phases 3–15

**\[HUMAN\]** Run one full end-to-end pass (play a real video, start capture, watch signs render) and flag anything that doesn't behave as specified before sign-off.

**\[AI\]**

* Trace one word from source audio to rendered sign, phase by phase, confirming every handoff (audio → chunk → transcribe → buffer → gloss → filter → lookup → resolve → queue → render) matches spec exactly, with sessionId correctly carried and checked at every stage.  
* Fix any interface mismatches found between modules built in isolation across earlier phases.  
* Confirm mode switching (Video ↔ Avatar) works instantly mid-session without reloading assets.

**Approach:** No new files by design — this is the seam-check pass that catches integration bugs from building phases somewhat independently.

**Refer to:** SignSetu.docx — the full System Architecture diagram section, used as the end-to-end checklist.

---

**Phase 17 — Testing, Rehearsal & Threshold Tuning**

**Files:** tests/backend/test\_vad.py, tests/backend/test\_chunker.py, tests/backend/test\_whisper\_service.py, tests/backend/test\_ollama\_client.py, tests/backend/test\_vocab\_filter.py, tests/backend/test\_render\_resolver.py, tests/backend/test\_session\_state.py, tests/fixtures/sample\_audio/

**\[HUMAN\]**

* Supply real audio fixtures from the actual demo video/source — never fabricated.  
* Run the full concurrent GPU stress test (Whisper \+ Ollama \+ Three.js together) on the actual RTX 3050 hardware; judge whether latency holds under the 5s target.  
* Tune VAD\_DISCARD\_THRESHOLD and LATENCY\_DEGRADE\_THRESHOLD\_SECONDS in config.py based on observed behavior against real material, not defaults.  
* Do a final full rehearsal run before demo day.

**\[AI\]**

* Write unit tests for each backend module listed above, using the human-supplied real fixtures.  
* test\_vocab\_filter.py specifically: feed known off-vocabulary and malformed-JSON cases, confirm they're caught and logged, never reaching render\_resolver.py.  
* Run the Model 3 prompt against real transcribed fragments from the demo material; log every raw Ollama response (via ollama\_raw\_log.py) for human review; if malformed/non-compliant output is frequent, strengthen the few-shot examples in prompts.py with cases from the actual observed failures — never increase model size as the fix.  
* Confirm Fallback F's dictionary-exclusion list and Fallback A's placeholder are both exercised at least once in a real test run.

**Approach:** Testing here is explicitly rehearsal-driven, not synthetic — fabricated audio/data must never substitute for real demo material at this stage.

**Refer to:** AI\_Model\_Specification\_Document.docx — Model 3 "Other instructions for IDE agent/developer" section in full; SignSetu.docx — Fallback G (GPU stress-testing note).

**End state after Phase 17:** every file in the project tree is built or reused, backend and frontend are fully wired end-to-end over the WebSocket, all fallbacks (A–H) are implemented and exercised at least once, thresholds are tuned against real demo audio, and the system is ready for final demo rehearsal. AS an AI Implement both Human and AI Steps. If unable to implement a specific human step ask the developer to do it and provide him with exact specific steps on how to do it.

**4\. General Development Rules**

* Never invent a step, fallback, model config, prompt wording, threshold, or file path not present in the three docs — flag and ask rather than improvise.  
* On conflict: SignSetu.docx (pipeline, fallbacks, architecture, tech stack)  \> SignSetu PROJECT FILE STRUCTURE AND PHASE WISE IMPLEMENTATION.docx\>AI\_Model\_Specification\_Document.docx (exact prompts/model configs)  \> **sin\_setu\_Code\_Reuse.docx** (its own file descriptions are explicitly marked as hypotheses to verify, not ground truth)\>IMPLEMENTATION ALGORITHM.docx(algorithms for each file can be modified to comply with higher docs).  
* The Model 3 system prompt and few-shot examples must be hardcoded in prompts.py verbatim — never paraphrased or "improved."  
* Every ✅\-marked reused file must be fetched and read in full before integration code is written against it — never assume SignEngine.js's API or completion signal.  
* isl\_nlp.py and app.py are reference-only — never called, never wired in.  
* vocab\_filter.py runs on every Ollama response unconditionally, independent of prompt compliance and independent of whether JSON parsing succeeded — this is the actual guarantee, not the prompt.  
* Failed/invalid gloss words are silently dropped and logged — never surfaced as a visible error, never crash the pipeline.  
* Every render instruction carries a sessionId; every consumer (both frontend and backend) checks it before acting — never render a stale instruction.  
* No word is ever a silent gap — unknown words always get the Fallback A placeholder.  
* All three models load once at backend startup and persist for the session — never re-instantiate per request.  
* silero-vad runs CPU-only, never GPU; GPU is reserved for Whisper \+ Ollama.  
* Whisper always runs with language="en", task="transcribe" explicit — never auto-detect, never translate mode.  
* Ollama temperature stays 0.1-0.2 — never raised for variety.  
* All tunable thresholds live only in backend/config.py — never hardcoded inline.  
* CISLR clips are always pre-downloaded/locally cached — never streamed live during a session.  
* No database — all lookups are static in-memory structures loaded once at startup.  
* No bundler on the frontend — Three.js via pinned CDN \<script\> only; no React/Vue/webpack.  
* Chrome/Chromium only — no cross-browser capture shims.  
* Never fabricate or mock CISLR clips, dictionary entries, or demo transcripts — flag missing assets instead of substituting placeholder data.  
* If a document conflict, missing value, or ambiguous file location arises that this breakdown doesn't resolve, stop and ask — do not assume silently.

