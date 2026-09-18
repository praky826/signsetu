**SignSetu — Full Step-by-Step Technical Specification**

*(Sequential, from application launch to final sign output. Every step marked as either a **\[USER STEP\]** or **\[SYSTEM STEP\]**.)*

---

**STEP 1 — Application Launch & Local Model Warm-up**

**\[SYSTEM STEP\]**

**Purpose:** Get all local AI models loaded into GPU memory and "warmed up" before the user starts the actual demo, so the first real inference isn't slowed by cold-start overhead.

**Input:** None (triggered on app start).

**Output:** Two models resident in GPU memory (faster-whisper small, Ollama 3B model), both confirmed responsive via a throwaway inference call.

**Technical requirements:**

* Python 3.10+ backend (Flask or FastAPI) running locally  
* faster-whisper package (CTranslate2-based)  
* Ollama installed and running as a local service (ollama serve), with the chosen 3B model already pulled (ollama pull \<model\>)  
* CUDA-enabled PyTorch/CTranslate2 build matching RTX 3050 drivers  
* silero-vad package (lightweight, CPU is fine for this one)

**What happens in detail:** On backend startup, faster-whisper initializes its model object, allocating GPU memory and loading weights — this is a one-time cost that would otherwise be paid on the very first transcription request. Simultaneously, a warm-up HTTP request is sent to Ollama's local API (POST /api/generate with a trivial throwaway prompt like "hello") purely to force the model into VRAM and JIT any compilation Ollama does internally, discarding the response. silero-vad's ONNX model is also loaded into memory. The backend only signals "ready" to the frontend once all three have responded successfully to a test call.

**Implementation approach:** Run all three warm-up calls concurrently (async/threaded) on backend startup, block the frontend's "Start" button until a /health endpoint confirms all three are ready, and show a loading state so this delay is visible and expected rather than confusing.

---

**STEP 2 — Frontend Loads, User Sees Idle State**

**\[USER STEP\] / \[SYSTEM STEP\]**

**Purpose:** Present the user with a clear, minimal control surface — nothing should auto-start, since capture requires explicit user permission anyway.

**Input:** Backend /health \= ready.

**Output:** A page showing: a "Start Capture" button, a mode toggle (Video / Avatar), and an empty output window (bottom-right fixed \<div\>) in idle state.

**Technical requirements:** Single HTML page, vanilla JS or minimal framework, Three.js (for avatar canvas, initialized but empty/idle at this point), CSS for fixed-position output window.

**What happens in detail:** The reused avatar.js module's initAvatarScene(container) call (confirmed API, Phase 2\) builds the Three.js scene, camera, renderer, lights, and controls itself and loads the avatar GLB (human.glb) into it, resolving with {model, scene, camera, renderer}; our own main.js does not construct a separate scene. Immediately after that resolves, a single SignEngine instance is constructed (new SignEngine({model})) and kept for the whole session, since Step 16B has no per-word "play sign" call to make otherwise. Constructing SignEngine automatically triggers its own built-in self-test animation about 1.5 seconds later (a brief arm/hand movement, resetting after 3 more seconds) — this is expected behavior from the reused file, not a bug, and cannot be suppressed without modifying the file.

**Implementation approach:** Load and pose the avatar immediately on page load regardless of which render mode is later selected, so mode-switching later is instant rather than triggering a fresh model load. Because avatar.js and SignEngine.js use bare ES module specifiers ("three", "three/examples/jsm/..."), index.html needs a native \<script type="importmap"\> resolving these to a CDN ESM build, with main.js loaded as \<script type="module"\> — this satisfies the no-bundler requirement since import maps are native browser behavior, not a build step.

---

**STEP 3 — User Clicks "Start Capture"**

**\[USER STEP\]**

**Purpose:** Explicit, deliberate user action that begins the capture-permission flow — required because browsers won't allow silent/automatic tab-audio capture.

**Input:** User click.

**Output:** Triggers the browser's native screen/tab-share picker dialog.

**Technical requirements:** None beyond a standard click handler.

**What happens in detail:** The click handler calls navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }). This is a browser-security-gated API — it can only be invoked as a direct result of a user gesture (a click), not programmatically on page load, which is exactly why this has to be a manual step rather than automated.

**Implementation approach:** Wrap this call in a try/catch — if the user cancels the picker or denies permission, catch the rejected promise and show a retry prompt rather than letting it fail silently.

---

**STEP 4 — User Selects Source Tab & Confirms Audio Sharing**

**\[USER STEP\]**

**Purpose:** User must both pick the correct tab (YouTube/Spotify/etc.) and explicitly check "Share tab audio" — this is the step most likely to go wrong live if rehearsed insufficiently.

**Input:** User selects a tab from the picker's thumbnail list and checks the audio checkbox.

**Output:** A MediaStream object returned to the app containing one video track and (if checked correctly) one audio track.

**Technical requirements:** Source tab (YouTube/Spotify) must already be open and, ideally, already playing (see Step 5\) before this picker is opened, so its thumbnail is live/identifiable rather than blank.

**What happens in detail:** Browser-internal — outside your app's control — the OS/browser compositor sets up a stream tap on the selected tab's rendering and audio-output pipeline. Your app receives a MediaStream handle once the user confirms.

**Implementation approach:** No code here beyond the promise resolving; the *validation* that audio was actually included happens in Step 5\.

---

**STEP 5 — Stream Validation**

**\[SYSTEM STEP\]**

**Purpose:** Immediately confirm the captured stream actually contains a usable audio track before proceeding — catching the single most common failure mode (forgot to check "share audio") right away instead of downstream.

**Input:** The MediaStream object from Step 4\.

**Output:** Either a confirmed-valid audio track proceeding to Step 6, or an error state shown to the user with a retry button.

**Technical requirements:** None beyond the MediaStream API already in use.

**What happens in detail:** stream.getAudioTracks() is checked — if the array is empty, no audio was shared regardless of whether video was. If non-empty, an AudioContext and AnalyserNode are briefly attached to sample actual signal level over \~1-2 seconds, confirming real audio energy is present (not just a silent/muted track).

**Implementation approach:** Gate all subsequent steps behind this check; show a clear "No audio detected — please re-share and check 'Share tab audio'" message with a button that re-triggers Step 3, rather than proceeding into a pipeline with nothing to transcribe.

---

**STEP 6 — Source Video Must Be Playing (User Confirms Playback)**

**\[USER STEP\]**

**Purpose:** Autoplay restrictions mean audio won't flow until playback has been manually started with a user gesture on the source tab itself.

**Input:** User clicks play on the YouTube/Spotify player in the source tab.

**Output:** Actual audio now flowing through the shared MediaStream.

**Technical requirements:** None — this is purely a user action on a page you don't control.

**What happens in detail:** No code-level event fires in your app for this — it's inferred indirectly via the AnalyserNode from Step 5 now detecting non-zero, sustained signal.

**Implementation approach:** Sequence your demo script explicitly: play source video first, then click "Start Capture" — don't assume order; consider a short on-screen reminder in the UI ("Make sure the source is playing before sharing").

---

**STEP 7 — Web Audio Graph Setup for Continuous Tapping**

**\[SYSTEM STEP\]**

**Purpose:** Establish a persistent, low-level tap into the raw decoded audio samples of the shared stream, which downstream chunking will read from continuously.

**Input:** Validated MediaStream with active audio track.

**Output:** A live MediaStreamAudioSourceNode connected into a processing graph (e.g. via AudioWorkletNode or ScriptProcessorNode) that exposes raw PCM audio frames as they arrive.

**Technical requirements:** Web Audio API (native browser), no external package needed for this specific step. The AudioContext MUST be constructed as new AudioContext({ sampleRate: 16000 }) so captured audio is already at Whisper/Silero-VAD's required 16kHz — verify Chrome actually honors this for a getDisplayMedia-sourced track before relying on it; if it doesn't, resample explicitly on the backend instead (see "What happens in detail").

**What happens in detail:** The MediaStream's audio track is wrapped into an AudioContext source node. An AudioWorkletNode (preferred over the deprecated ScriptProcessorNode) is attached downstream, which runs a small processing callback on a background audio thread, receiving fixed-size blocks of raw float32 PCM samples (typically 128 samples per callback at the audio context's sample rate — 16kHz per the Technical requirements above, not the browser's usual 48kHz default) continuously for as long as the stream is active. If the AudioContext cannot be forced to 16kHz in testing, resample every accumulated buffer to 16kHz mono on the backend (e.g. in chunker.py, before VAD/Whisper ever see it) instead of assuming the frontend rate matches.

**Implementation approach:** Buffer these small callback blocks into a growing in-memory float32 array on the main thread (via port.postMessage from the worklet), rather than processing each tiny 128-sample block individually — that buffer is what Step 8 slices into chunks.

---

**STEP 8 — VAD-Assisted Chunk Segmentation (runs backend-side, in Python, after Step 9's raw-audio transport)**

**\[SYSTEM STEP\]**

**Purpose:** Convert the continuous raw audio stream into short, boundary-aware chunks (\~1.5-2s) ready for transcription, without waiting for full-sentence pauses. Rns completely on the backend.

**Input:** Growing raw PCM buffer from Step 7\.

**Output:** Discrete audio chunks (\~1.5-2s each), each tagged with the current sessionId, pushed into a processing queue.

**Technical requirements:** silero-vad (ONNX runtime, CPU is sufficient), a rolling buffer data structure.

**What happens in detail:** A timer/loop checks the accumulated buffer every \~100-200ms. Once the buffer reaches the \~2s target size, silero-vad is run over the tail end of that buffer to check for a short silence within roughly the last few hundred milliseconds — if found, the chunk boundary snaps there; if not, the chunk is cut at the hard 2s cap regardless. The cut audio segment is removed from the front of the buffer and pushed to the transcription queue; leftover audio after the cut point remains in the buffer as the start of the next chunk.

**Implementation approach:** Keep this entirely on the backend's asyncio timer loop (VAD inference on a 2s CPU-bound chunk is fast enough not to need a separate worker process), and stamp each emitted chunk object with {audioData, sessionId, timestamp}. This logic runs server-side in Python (backend/audio/chunker.py \+ vad.py) — the frontend has no chunk-cutting or VAD logic of its own; its only job is the continuous raw-audio transport described in Step 9\.

**STEP 9 — Chunk Transfer to Local Transcription Service**

**\[SYSTEM STEP\]**

**Purpose:** Continuously stream raw (not yet chunked) PCM audio from the browser to the local Python backend, where Step 8's VAD-based chunking is then applied server-side.

**Input:** A queued audio chunk object from Step 8\.

**Output:** Raw chunk delivered to backend, awaiting transcription.

**Technical requirements:** WebSocket connection (preferred over repeated HTTP POSTs for lower per-request overhead) between frontend and local Flask/FastAPI backend; audio encoded as WAV/PCM bytes for transfer.

**What happens in detail:** The growing raw float32 PCM buffer accumulated in Step 7 is sent, unchunked, as binary WebSocket messages to localhost (no real network latency since both ends are on the same machine), tagged with sessionId and a sequence number. The backend appends each incoming buffer into its own per-session raw-PCM buffer (backend/audio/chunker.py), which Step 8 then slices into VAD-aligned chunks server-side.

**Implementation approach:** Keep the WebSocket connection open for the whole session rather than reconnecting per chunk; include sessionId and a sequence number in each message so the backend can also independently discard stale-session chunks if a seek event outraces the frontend's own cleanup.

---

**STEP 10 — Local Transcription (faster-whisper)**

**\[SYSTEM STEP\]**

**Purpose:** Convert the raw audio chunk into text.

**Input:** \~2s WAV chunk.

**Output:** Transcribed text string for that chunk (e.g. "and then I went to"), plus confidence/metadata.

**Technical requirements:** faster-whisper "small" model, CUDA execution provider, RTX 3050\.

**What happens in detail:** The backend calls model.transcribe(chunk\_audio), which runs the chunk through Whisper's encoder-decoder architecture on GPU, producing a text segment. Because chunks are processed as they arrive rather than batched, this operates as a continuous pipeline — chunk N's transcription runs while chunk N+1's audio is still being captured on the frontend.

**Implementation approach:** Run this in a dedicated backend worker/thread pulling from the chunk queue in strict order per sessionId, discard any chunk whose sessionId no longer matches the currently-active session (set via a message from the frontend on seek), and push completed text segments onward immediately rather than batching multiple chunks' results together.

---

**STEP 11 — Rolling Text Buffer Update**

**\[SYSTEM STEP\]**

**Purpose:** Maintain a short, live window of recently recognized words as light grammatical context for gloss conversion.

**Input:** New transcribed text segment from Step 10\.

**Output:** Updated rolling buffer (last \~5-6 words), with newly arrived words marked "provisional" and older words marked "stable."

**Technical requirements:** Simple in-memory queue/array structure, backend-side.

**What happens in detail:** The new segment's words are appended to the buffer. If the buffer exceeds \~5-6 words, the oldest words are marked eligible for "commit" (i.e., ready to be finalized and sent to gloss conversion), while the newest 2-3 words remain provisional, since a following chunk could still add context that would change how they should be reordered into gloss.

**Implementation approach:** A simple sliding window with an index marking the "commit boundary" — words behind it are sent to Step 12, words ahead of it wait for the next cycle.

---

**STEP 12 — Incremental Gloss Conversion (Ollama)**

**\[SYSTEM STEP\]**

**Purpose:** Convert the newly stable English words into ISL gloss order (reordered, articles/copulas dropped) — quickly, sacrificing full-sentence grammatical correctness for speed.

**Input:** The committed (stable) words from the rolling buffer, plus the remaining buffer as light context.

**Output:** A small ordered array of gloss tokens, e.g. \["I", "SCHOOL", "GO"\].

**Technical requirements:** Ollama running locally, 3B parameter model, low temperature (\~0.1-0.2) setting, strict prompt requiring JSON array output.

**What happens in detail:** A prompt is constructed containing the full rolling buffer (for context) but explicitly instructing the model to only output gloss for the marked "stable" portion. The request is sent to Ollama's local /api/generate (or /api/chat) endpoint over localhost. The model returns a JSON array of gloss tokens, which is parsed; malformed responses (not valid JSON, unexpected tokens) are caught and that cycle's output is discarded/retried rather than crashing downstream.

**Implementation approach:** Few-shot the prompt with 2-3 example input/output pairs showing the exact expected JSON shape, validate the response with a JSON schema check before using it, and log/skip on validation failure.

---

**STEP 13 — Parallel Dictionary & Video Index Lookup**

**\[SYSTEM STEP\]**

**Purpose:** For each gloss token, determine whether it's renderable via avatar (HamNoSys), video (CISLR), both, or neither.

**Input:** Gloss token array from Step 12\.

**Output:** A per-word render record: {word, hamnosys?: string, videoPath?: string}.

**Technical requirements:** Pre-built in-memory (or lightweight DB) lookup structures: isl\_dictionary.json loaded fully into memory at backend startup; CISLR gloss→video-path index similarly pre-built and loaded at startup.

**What happens in detail:** For each gloss word, two independent dictionary lookups happen (effectively O(1) hash lookups, since both are pre-loaded in-memory maps) — no per-word disk I/O or network calls, keeping this step effectively instantaneous relative to the rest of the pipeline.

**Implementation approach:** Load both lookup structures once at backend startup (Step 1), keep them as plain in-memory dicts/objects for the whole session.

---

**STEP 14 — Render Mode Determination**

**\[SYSTEM STEP\]**

**Purpose:** Decide, per word, exactly what gets rendered, based on the user's selected mode and fallback rules.

**Input:** Per-word render record from Step 13, current user-selected mode (Video/Avatar), current sessionId.

**Output:** A finalized render instruction per word: {word, renderType: "avatar"|"video", assetRef, sessionId}.

**Technical requirements:** None beyond simple conditional logic.

**What happens in detail:** If Video Mode is active, every word resolves to its videoPath (if available; otherwise flagged unknown per Step "unknown word" handling). If Avatar Mode is active, the system prefers hamnosys if present; if absent, it automatically substitutes videoPath for that single word (the mid-sequence fallback discussed earlier), without switching the user's overall mode setting.

**Implementation approach:** A pure function taking the render record \+ mode \+ fallback rules, returning the render instruction — kept stateless and easily unit-testable in isolation from the rest of the pipeline.

---

**STEP 15 — Render Queue Push (Session-Filtered)**

**\[SYSTEM STEP\]**

**Purpose:** Queue finalized render instructions for playback, while guaranteeing stale (pre-seek) instructions never reach the screen.

**Input:** Render instruction from Step 14\.

**Output:** Instruction either enters the live playback queue, or is silently discarded.

**Technical requirements:** Frontend-side queue array, compared against a live currentSessionId variable updated on every seek event.

**What happens in detail:** Before enqueueing, the instruction's sessionId is compared against the currently active session ID (tracked from Step where seek events are handled). If they don't match, the instruction is dropped — this is the mechanism that makes rewinds/fast-forwards "just work" without visible glitches, since any output generated from now-obsolete audio never makes it to the screen.

**Implementation approach:** A simple if (instruction.sessionId \!== currentSessionId) return; guard right before pushing to the queue.

---

**STEP 16A — Video Renderer (if word resolves to video)**

**\[SYSTEM STEP\]**

**Purpose:** Play the correct CISLR clip for a word.

**Input:** Render instruction with videoPath.

**Output:** Video plays in the output window.

**Technical requirements:** Standard HTML \<video\> element, locally cached CISLR clips (pre-downloaded, not streamed from Hugging Face live).

**What happens in detail:** The output window's \<video\> element's src is set to the resolved local file path, and .play() is called. The queue advances to the next instruction on the video's onended event, ensuring words play sequentially rather than overlapping.

**Implementation approach:** Preload the next queued video clip (video.preload \= 'auto' on a hidden second element) while the current one plays, to avoid a visible load-stutter between words.

---

**STEP 16B — Avatar Renderer (if word resolves to avatar)**

**\[SYSTEM STEP\]**

**Purpose:** Animate the 3D avatar to perform the sign for this word.

**Input:** Render instruction with hamnosys string.

**Output:** Avatar performs the corresponding hand/arm animation in the Three.js canvas.

**Technical requirements:** Three.js, the copied hamnosysMap.js and SignEngine.js modules from speech-to-isl (autoBoneMapper.js is copied per the reuse policy but not functionally called — SignEngine.js maps its own bones internally), loaded human.glb, the single SignEngine instance constructed once in Step 2\.

**What happens in detail (CONFIRMED against the actual fetched code, Phase 2 — supersedes the original hypothesis below):** hamnosysMap.js does not parse the HamNoSys string into pose data — it exports HAMNOSYS\_ACTIONS, a map from each HamNoSys token directly to a function that calls a method (hand/palm/armTo/resetAll) on a SignEngine instance. Our avatarRenderer.js splits the resolved HamNoSys string on whitespace and calls HAMNOSYS\_ACTIONS\[token\](signEngineInstance) for each token in order, against the one SignEngine instance created in Step 2\. SignEngine.js has no playSign() function and no completion event, callback, or promise of any kind — its animations run continuously via an internal requestAnimationFrame loop with no notification when they finish. Our own queue-advance logic therefore waits a fixed timeout, AVATAR\_SIGN\_HOLD\_MS (a frontend-only constant defined at the top of avatarRenderer.js — see docs/implementation.md section 3 exception — sized to the rotate() interpolation speed SignEngine uses), rather than listening for a signal that doesn't exist, then explicitly calls signEngine.resetAll() to return to a neutral pose before advancing. Note also that SignEngine.js's pose methods only ever animate right-side bones — every avatar sign produced this way is one-handed, regardless of what a HamNoSys string might imply.

**Implementation approach:** Reuse these modules unmodified — the integration work is calling hamnosysMap.js's HAMNOSYS\_ACTIONS functions against the shared SignEngine instance from your own queue-advance logic, with a fixed-timeout completion in place of the originally assumed event/callback mechanism.

---

**STEP 17 — Output Window Display**

**\[SYSTEM STEP\]**

**Purpose:** Present whichever renderer is active in a small, fixed, always-visible window.

**Input:** Active renderer's visual output (canvas or video element).

**Output:** Visible sign output in the bottom-right corner of the screen.

**Technical requirements:** CSS position: fixed div; optionally documentPictureInPicture if output must float above other tabs/apps.

**What happens in detail:** The output container toggles which child element is visible (avatar canvas vs. video element) based on the currently active render mode — both exist in the DOM at all times, only visibility/display changes, avoiding re-initialization overhead on every mode switch.

**Implementation approach:** Simple display: none/display: block toggle on two sibling elements inside the fixed-position container.

---

**STEP 18 — Continuous Seek/Pause Monitoring (runs throughout, parallel to all steps above)**

**\[SYSTEM STEP\]**

**Purpose:** Detect user rewinding/fast-forwarding/pausing the source video at any time and correctly invalidate in-flight data.

**Input:** seeking, seeked, pause, play events on the source video (if you control it) — or, for tab-audio-capture of an external site like YouTube, inferred indirectly via a detected discontinuity/silence in the audio signal, since you don't have direct DOM event access to another site's player.

**Output:** sessionId incremented on confirmed seeks; paused state halts chunk capture without wiping buffers; resume continues normally.

**Technical requirements:** Event listeners (native), or signal-discontinuity heuristics via AnalyserNode if the source is an external tab you don't control.

**What happens in detail:** This runs as a background listener for the entire session duration, independent of the main pipeline's step sequence — the moment a seek is detected, currentSessionId increments immediately, the chunk buffer (Step 8\) is cleared, any in-flight backend transcription/gloss requests tagged with the old sessionId are left to complete but their results are discarded on arrival (Steps 9-15's session checks), and chunk capture resumes fresh from the new position.

**Implementation approach:** Debounce seek detection by \~150-200ms to avoid session-thrashing on rapid scrub gestures, as discussed earlier.

**Fallback & Recovery Specifications**

*(Same format as before. These run alongside or are triggered by specific conditions within the main 18-step pipeline — each names exactly which step(s) it attaches to.)*

---

**FALLBACK A — Unknown Word Handling**

**Attaches to:** Step 13 (Lookup) → Step 14 (Render Mode Determination)

**Purpose:** Define exactly what happens when a gloss word has no match in either the CISLR video index or isl\_dictionary.json — this must never be a silent gap, since an unexplained freeze looks like a bug on stage.

**Input:** A gloss word where both hamnosys and videoPath come back null from Step 13\.

**Output:** One of three defined behaviors, consistently applied — a rendered fingerspelled sequence, a visible placeholder sign, or a logged skip — never a silent stall.

**Technical requirements:** A small fingerspelling asset set (either 26 pre-recorded letter videos/clips, or 26 simple HamNoSys hand-shape entries for A-Z, since ISL/most sign languages have a manual alphabet) if choosing the fingerspelling option; otherwise just a placeholder graphic asset.

**What happens in detail:** Given your stated priority (responsiveness over accuracy, minimal build complexity), fingerspelling every unknown word is the most build-effort-intensive option — it requires a full alphabet asset set integrated into both renderers. Given the 2-day constraint, the pragmatic choice is: **show a brief, visually distinct placeholder** (e.g. a small "?" icon or greyed-out avatar pose held for \~0.5s) in place of the unknown word, while logging the missed word to console/a debug panel — this keeps the sign sequence flowing without a dead gap, is trivial to implement, and doesn't require new assets. Skipping the word entirely (rendering nothing, zero duration) is the cheapest option but risks looking like a bug/freeze rather than a deliberate "word not available" signal — the placeholder is worth the small extra effort for that reason.

**Implementation approach:** A single reusable "unknown" render instruction type handled identically by Step 15's queue — same session-tagging, same queue-advance-on-complete logic as real words, just pointing at a static placeholder asset instead of a video/avatar pose.

---

**FALLBACK B — Live Status Indicator**

**Attaches to:** Runs continuously across all 18 steps, as a persistent UI element.

**Purpose:** Give the user (and audience) constant visibility into pipeline health, so degraded states are legible rather than looking like silent failure.

**Input:** Internal pipeline state signals — capture active/inactive, last chunk processed timestamp, last error encountered, current session validity.

**Output:** A small persistent UI element (colored dot \+ short label) near the output window, updating in near-real-time.

**Technical requirements:** No new packages — just a small reactive state object on the frontend and a corresponding UI element.

**What happens in detail:** Define a small fixed state machine with states such as: IDLE (before capture starts), LISTENING (capture active, waiting for/processing audio), NO\_AUDIO (Fallback in Step 5 triggered), RECONNECTING (stream ended unexpectedly, see Fallback C below), PROCESSING\_DELAY (a chunk has been in the transcription/gloss queue longer than an expected threshold — e.g. 3x normal latency — suggesting GPU contention or a stall). Each pipeline stage updates this shared state object as it transitions, and the UI element re-renders on every state change.

**Implementation approach:** A simple enum-backed state object with a single setStatus(newState) function called from each relevant step, and a small UI component subscribed to it — deliberately simple, since this is a diagnostic aid, not a feature.

---

**FALLBACK C — Audio Stream Lost Mid-Session (tab closed/sharing stopped)**

**Attaches to:** Step 7 (Web Audio Graph) — extends what happens if the stream dies after setup.

**Purpose:** Detect and recover gracefully if the user closes the shared tab, navigates away from it, or manually stops sharing via the browser's native "Stop sharing" control — all of which are possible at any point during a live demo.

**Input:** The stream's native track.onended event.

**Output:** Pipeline pauses cleanly, status indicator shows RECONNECTING, and a one-click "Reconnect" affordance re-triggers Step 3 (the share picker) without requiring a full page reload.

**Technical requirements:** None beyond the MediaStream API already in use.

**What happens in detail:** track.onended fires automatically whenever tab sharing stops for any reason (tab closed, user clicked the browser's built-in "Stop sharing" button, tab navigated to a different URL). The handler immediately halts the chunk controller (Step 8), sets the status indicator to RECONNECTING, and does **not** clear the current sessionId/rolling buffer outright — instead it freezes them, since the user might reconnect to the same content at roughly the same point, and a full reset would lose more context than necessary.

**Implementation approach:** Attach the onended listener immediately after Step 4 resolves, tied to a single "Reconnect" button that re-runs the Step 3-6 flow; only increment sessionId (full reset) if a genuinely new stream is established, not merely on disconnect.

---

**FALLBACK D — Whisper Hallucination on Silence/Non-Speech**

**Attaches to:** Step 8 (Chunk Segmentation) → Step 10 (Transcription)

**Purpose:** Prevent Whisper from inventing plausible-sounding but fake text when fed silence, music-only, or non-speech audio — a documented behavior of Whisper-family models.

**Input:** A completed audio chunk from Step 8, before it's sent to transcription.

**Output:** Chunks confirmed to contain no speech are dropped before ever reaching Whisper; only speech-containing chunks proceed to Step 9-10.

**Technical requirements:** silero-vad (already in use for chunk-boundary snapping in Step 8\) — reused here for a second purpose.

**What happens in detail:** In addition to VAD's role in finding a clean cut point (Step 8), the same VAD pass also computes an overall speech-probability score for the finished chunk. If that score falls below a set threshold (i.e., the chunk is judged to contain no meaningful speech — silence, pure music, background noise only), the chunk is discarded immediately rather than being sent to the transcription queue at all, preventing wasted GPU cycles and, more importantly, preventing Whisper from hallucinating a plausible-sounding sentence from nothing.

**Implementation approach:** A simple threshold check (if (vadResult.speechProbability \< 0.3) return;) inserted right before Step 9's WebSocket send.

---

**FALLBACK E — Malformed Ollama Gloss Output**

**Attaches to:** Step 12 (Gloss Conversion)

**Purpose:** Prevent a malformed or unexpected LLM response from crashing or corrupting the downstream render queue.

**Input:** Raw text response from Ollama's API call.

**Output:** Either a validated, parsed gloss array proceeding to Step 13, or the cycle is silently discarded and the buffer's "commit boundary" (Step 11\) simply doesn't advance, retrying on the next cycle with more context instead.

**Technical requirements:** A JSON schema validator (even a minimal hand-written check is sufficient — no heavy library needed).

**What happens in detail:** The response is first checked for valid JSON parseability; if it fails, or parses but doesn't match the expected shape (array of strings), the entire gloss output for that cycle is discarded. Critically, this does not advance the rolling buffer's commit boundary \--- the same words remain marked "stable" (i.e., uncommitted, per Step 11's terminology) and get resent (with whatever new words have since arrived) on the next cycle, giving the model another attempt with slightly more context rather than permanently losing those words.

**Implementation approach:** Wrap the parse in try/catch; on failure, log the raw bad output for later prompt-tuning, and simply return without updating buffer state — the natural retry-on-next-cycle behavior requires no special retry logic of its own.

---

**FALLBACK F — Malformed Dictionary Entries (Avatar Mode)**

**Attaches to:** Step 1 (Warm-up) — extended to include dictionary validation at startup, not just model loading.

**Purpose:** Catch broken/malformed HamNoSys entries in isl\_dictionary.json before the demo starts, rather than discovering a crash mid-sentence when that specific word happens to come up live.

**Input:** The full isl\_dictionary.json file, loaded at backend startup.

**Output:** A validated in-memory dictionary containing only entries whose HamNoSys strings parse successfully against hamnosysMap.js's known token set; invalid entries are excluded and logged.

**Technical requirements:** The same hamnosysMap.js token-parsing logic already used at render time, run once eagerly at load time instead of lazily.

**What happens in detail:** For every entry in the dictionary, its HamNoSys string is run through the same tokenizer/parser that Step 16B would normally use at render time — but here, purely to check it parses without error, discarding the actual pose output. Entries that fail are removed from the in-memory lookup used by Step 13, meaning any word with a broken dictionary entry is treated identically to "not found in avatar dictionary at all," which correctly triggers the existing video-clip fallback (Step 14\) rather than crashing when that word comes up live.

**Implementation approach:** A single validation pass in the Step 1 startup sequence, producing a cleaned dictionary object and a console-logged list of excluded words for your own debugging before the demo.

---

**FALLBACK G — GPU Contention / Pipeline Slowdown**

**Attaches to:** Runs as a monitor across Steps 9-16 (the GPU-heavy stages: Whisper, Ollama, Three.js rendering all sharing the RTX 3050).

**Purpose:** Detect if combined GPU load is pushing latency past your 5-second target live, and degrade gracefully rather than silently falling further and further behind.

**Input:** Timestamps recorded at chunk creation (Step 8\) and at final render (Step 16A/16B) for each word, giving a measured end-to-end latency per word.

**Output:** If measured latency consistently exceeds a set threshold (e.g. 6-7 seconds, giving some margin above your 5s target) across several consecutive words, status indicator shows PROCESSING\_DELAY, and — as a last-resort automatic mitigation — the system can drop to skipping avatar rendering for a stretch (falling back to video-only mode temporarily, since avatar rendering is the extra GPU consumer on top of Whisper+Ollama) until latency recovers.

**Technical requirements:** A simple rolling latency tracker (last 5-10 words' timings averaged).

**What happens in detail:** This is intentionally a monitoring-and-degrade mechanism, not a hard guarantee — its main value is making a slowdown *visible* (via the status indicator) rather than letting the audience wonder why signs have started lagging noticeably behind the audio. The automatic mode-drop is a defensive measure worth having, but the real mitigation, as noted earlier, is testing the full three-way GPU load (Whisper \+ Ollama \+ Three.js concurrently) well before demo day and pre-emptively choosing smaller models if needed, rather than relying on a live automatic downgrade to save the demo.

**Implementation approach:** A simple moving average over recent per-word latencies, compared against a threshold constant; the automatic video-only fallback is just a temporary override on Step 14's mode logic, reverting once the average drops back under threshold.

---

**FALLBACK H — Rapid Seek Debounce**

**Attaches to:** Step 18 (Seek Monitoring)

**Purpose:** Prevent a fast scrubbing gesture (user drags the seek bar rapidly) from spinning up and tearing down many sessions in immediate succession, which would otherwise waste processing on chunks that get invalidated almost instantly.

**Input:** Rapid-fire seeking events during a scrub gesture.

**Output:** Only one sessionId increment and one chunk-buffer reset per genuine seek action, not one per intermediate event during the drag.

**Technical requirements:** A simple debounce timer (no new package needed).

**What happens in detail:** seeking events fire continuously and rapidly while a user drags a scrub bar, not just once at the end. Rather than reacting to every one of these, a short debounce timer (\~150-200ms) resets on each new seeking event; the actual session-invalidation logic only fires once that timer completes without being reset again — i.e., once the user has actually stopped dragging and settled on a position (confirmed by the seeked event firing and staying stable).

**Implementation approach:** Standard debounce pattern — clearTimeout \+ setTimeout on every seeking event, with the real invalidation logic inside the timeout callback, triggered only once dragging has visibly stopped.

SYSTEM ARCHITECTURE

SOURCE VIDEO (in-page)

|  \<video\> element playing the source content

v

AUDIO CAPTURE LAYER

|  Web Audio API:

|  AudioContext.createMediaElementSource(video)

|  \- Clean digital audio tap

|  \- Removes ambient/hall noise

|  Listens for video "seeking"/"seeked" events

|  \- On seek:

|       \* Increment sessionId

|       \* Discard in-flight chunks

|       \* Clear buffers

v

STREAMING CHUNK CONTROLLER

|  Rolling 1.5–2 second audio window

|  Continuous processing (does not wait for silence)

|  Lightweight VAD (silero-vad):backend

|       \- Finds nearby silence for cleaner cut points

|       \- Otherwise hard-cuts at 2 seconds maximum

|  Each chunk tagged with current sessionId

v

LOCAL TRANSCRIPTION — faster-whisper (small)

|  Runs on RTX 3050 with GPU acceleration

|  Input:

|       \~2 second audio chunk

|  Output:

|       Partial text in \~0.3–0.6 seconds

|  Pipeline:

|       Chunk N+1 recording continues

|       while Chunk N is being transcribed

v

ROLLING TEXT BUFFER

|  Stores last \~5–6 words

|  \- New words appended from Whisper output

|  \- Buffer tagged with sessionId

|  \- Seek event clears buffer and starts fresh

v

LOCAL LLM — Ollama (small 3B model)

|  Incremental gloss conversion:

|       \- Processes whatever words are currently marked "stable" (buffer holds \~5-6 words total; the newest 2-3 are held back as "provisional", per Step 11\)

|       \- Uses rolling buffer as grammatical context

|  Behaviour:

|       \- Emits gloss for earliest stable words

|       \- Keeps newest words provisional

|       \- Allows later revision

|  Output:

|       Ordered gloss tokens (\~0.5–1.5 seconds)

v

LOOKUP / ROUTING LAYER

|  For every gloss word:

|  \+-----------------------+       \+-------------------------+

|  | CISLR Video Index     |       | isl\_dictionary.json     |

|  | gloss \-\> video path   |       | gloss \-\> HamNoSys       |

|  \+-----------------------+       \+-------------------------+

v

RENDER MODE CONTROLLER

|  User Toggle:

|       \[ VIDEO MODE \] \<-----\> \[ AVATAR MODE \]

|  Avatar Mode:

|       \- Lookup HamNoSys for each gloss word

|       \- If unavailable:

|             Use CISLR video clip for that word

|       \- Continue avatar rendering for next word

|  Queue Management:

|       \- Every sign tagged with sessionId

|       \- Old session signs are discarded after seeking

v

OUTPUT WINDOW (bottom-right fixed)

|  Fixed-position \<div\>

|  Size: approximately 300x200 px

|  Top-layer z-index

|  Displays either:

|       1\. Three.js avatar canvas OR

|       2\. CISLR video element

|  If needed:

|       documentPictureInPicture allows floating window

|       above other apps/tabs

**SignSetu — Finalized Tech Stack**

**Frontend**

| Component | Choice |
| ----- | ----- |
| Structure | Plain HTML/CSS/Tailwind JavaScript — no framework (React/Vue not needed given the scope; avoids build-tooling overhead for a 2-day build) |
| 3D rendering | **Three.js** (via CDN \<script\> tag, pinned version — no bundler required) |
| Audio capture | Native **Web Audio API** (AudioContext, AudioWorkletNode) — built into the browser, no package |
| Screen/tab capture | Native **MediaDevices API** (getDisplayMedia) — built into the browser |
| Backend communication | Native **WebSocket API** (browser built-in) for streaming audio chunks \+ receiving gloss/render instructions |
| Browser requirement | **Chrome / Chromium-based only** — most reliable and best-tested support for tab-audio-share and AudioWorkletNode behavior |

No npm/webpack/bundler needed — Three.js via CDN keeps this a zero-build-step static frontend, served directly by the backend.

**Backend**

| Component | Choice |
| ----- | ----- |
| Language | Python 3.10+ |
| Framework | **FastAPI** — chosen over Flask specifically for native async support and clean WebSocket handling, both of which this pipeline depends on heavily |
| Server | **Uvicorn** (ASGI server to run FastAPI) |
| Communication with frontend | WebSocket endpoint (audio chunks in, render instructions out) |
| Communication with Ollama | HTTP REST calls to Ollama's local API (http://localhost:11434) |

**Database**

**No traditional database required.** All lookups are static, pre-built, in-memory structures loaded once at startup:

* isl\_dictionary.json (keyed by English word, each entry {gloss, hamnosys} — CONFIRMED shape, Phase 2, not a flat gloss→HamNoSys file as first assumed) — loaded and re-indexed by gloss into a Python dict  
* CISLR gloss → video-path index — built once from prototype.csv (not dataset.csv — decision recorded in docs/implementation.md, since prototype.csv is the Hugging Face-provided one-clip-per-gloss subset), also loaded into a Python dict

**Models**

| Model | Purpose | Notes |
| ----- | ----- | ----- |
| **faster-whisper**, small (or base if small is too slow on your hardware) | Speech-to-text transcription | CTranslate2-optimized Whisper reimplementation, GPU-accelerated |
| **Ollama**, 3B model (e.g. llama3.2:3b or similar small instruction-tuned model) | Incremental English → ISL gloss conversion | Runs as a local service via the Ollama app, not a pip package |
| **silero-vad** | Voice activity detection for chunk-boundary snapping and silence/hallucination filtering | Lightweight, CPU is sufficient |
| human.glb (from speech-to-isl repo, or any Mixamo/ReadyPlayerMe rig) | 3D avatar model | Static asset, not an inference model |

**Hardware Requirements**

* **GPU**: NVIDIA RTX 3050 (confirmed sufficient for faster-whisper small \+ Ollama 3B concurrently, per earlier discussion — worth stress-testing both running together before demo day)  
* **NVIDIA drivers**: current drivers supporting CUDA, matched to whatever CUDA version your CTranslate2/PyTorch builds require  
* **RAM**: enough headroom for GPU model residency \+ browser \+ OS overhead — 16GB system RAM recommended as a safe baseline  
* **CUDA toolkit**: version compatible with your ctranslate2/PyTorch install (check compatibility tables before installing, since mismatches are a common local-setup failure point)

**Non-Python Installs (before running anything)**

1. **Ollama** — installed as a standalone application (not pip), running as a local background service (ollama serve), with the chosen model pulled ahead of time (ollama pull llama3.2:3b or equivalent)  
2. **Google Chrome / Chromium** — the browser you'll actually run the demo in  
3. **Hugging Face account** — needed once, to accept CISLR's access terms and download the dataset  
4. **CUDA-compatible NVIDIA driver** — installed at the OS level, not via pip

**Python Packages (pip install)**

fastapi  
uvicorn\[standard\]        \# includes websocket support  
faster-whisper  
ctranslate2               \# usually pulled in automatically by faster-whisper, listed for clarity  
torch                     \# CUDA build — needed by silero-vad  
silero-vad  
numpy  
soundfile \# for reading the real .wav test fixtures in tests/fixtures/sample\_audio/ (Phase 17\) — NOT used on the live audio path, which carries raw float32 PCM directly, no WAV container  
httpx                     \# for calling Ollama's local REST API from the backend  
pydantic                  \# comes bundled with FastAPI, listed for clarity  
python-dotenv             \# optional, for managing any local config/paths cleanly

*Note on torch*: install the CUDA-enabled build matching your driver/CUDA version specifically (via the official PyTorch install selector), not the default CPU-only pip package — this is a common silent-slowdown trap if skipped.

**Frontend Libraries (via CDN, no install step)**

Three.js (pinned version, e.g. r128 or your chosen stable release)

That's the only external frontend library — everything else (audio capture, WebSocket, DOM/canvas handling) is native browser APIs.

**Static Assets to Prepare Before Demo Day**

* human.glb — avatar model (from speech-to-isl repo or a Mixamo/ReadyPlayerMe export)  
* isl\_dictionary.json — copied from speech-to-isl repo  
* hamnosysMap.js, autoBoneMapper.js, SignEngine.js, avatar.js — copied from speech-to-isl repo  
* Pre-downloaded, **locally cached** CISLR video clips for your chosen demo vocabulary (not streamed live from Hugging Face during the demo)  
* Pre-built CISLR gloss → local-file-path index (generated once from prototype.csv, not dataset.csv — see docs/implementation.md)

