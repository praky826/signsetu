**Code Reuse & Integration Specification — speech-to-isl Deep Dive**

**Repository being referenced throughout:** [https://github.com/jayakarthik07/speech-to-isl](https://github.com/jayakarthik07/speech-to-isl) (also titled "Signify \- Speech to ISL" / "Speech2ISL" in its own README). MIT-style open reuse — no licensing blocker for copying these files into your project.

**Important honesty note for this document itself:** what follows is based on the repo's published README, file tree, and stated feature list — not a line-by-line read of the actual source code (I could not fetch raw file contents in this session). Each file's described behavior below is either **\[confirmed from README\]** or **\[inferred from filename/stated feature, verify on first read\]**. Your AI agent's very first task for every file listed should be to actually open it and confirm this description before building on top of it — treat the "what it does" descriptions below as a working hypothesis to validate, not ground truth.

**Repository structure (confirmed from README)**

Speech2ISL/  
├── backend/  
│   ├── app.py              \# Flask server with Whisper & Translation  
│   ├── isl\_nlp.py          \# English → HamNoSys converter  
│   ├── isl\_dictionary.json \# 250+ ISL signs database  
│   └── requirements.txt    \# Python dependencies  
├── frontend/  
│   ├── index.html          \# Main UI  
│   ├── main.js              \# Application logic  
│   ├── SignEngine.js        \# 3D animation engine  
│   ├── avatar.js            \# Avatar loader  
│   ├── hamnosysMap.js       \# HamNoSys → Pose mapping  
│   ├── autoBoneMapper.js    \# Auto bone detection  
│   ├── style.css            \# Styling  
│   └── models/human.glb     \# 3D avatar model  
└── README.md

**File-by-file specification**

**1\. backend/isl\_dictionary.json**

**What it is \[CONFIRMED by reading the fetched file, Phase 2\]:** NOT a flat {gloss: hamnosys} map. Actual shape: a JSON object keyed by lowercase English word, each value an object {gloss: "UPPERCASE\_GLOSS", hamnosys: "hamtoken hamtoken ..."}. 260 entries, 260 unique gloss values (multiple English-word keys can share one gloss, e.g. "hello" and "hi" both map to gloss HELLO).

**Where used in our pipeline:** Step 13 (Lookup) of our main spec — one of the two parallel dictionaries checked per gloss word. dictionary\_loader.py must iterate .values() and index by each entry's gloss field (uppercased), not by the JSON's own top-level keys.

**How it's integrated:** Copied wholesale, unmodified, into our backend. Loaded once into memory at Step 1 (startup), then validated per Fallback F (parsing every entry once to exclude malformed ones) before being used as our in-memory avatar-vocabulary lookup table for the rest of the session.

**Instruction to AI agent:** Attempt to fetch this file directly from the repo's backend/isl\_dictionary.json path. If network access is unavailable, stop and ask the developer (me) to manually download this file from the repo and paste its contents into the project at the equivalent path, then continue.

**2\. frontend/hamnosysMap.js**

**What it is \[CONFIRMED by reading the fetched file, Phase 2\]:** Exports a single named object, HAMNOSYS\_ACTIONS, mapping each HamNoSys token string (e.g. "hamflathand", "hampalmd", "hamchest") to a function of shape (engine) \=\> void. It is not a parser that produces bone-rotation pose data — each token's function directly calls one of engine.hand(), engine.palm(), engine.armTo(), or engine.resetAll() on a passed-in SignEngine instance. 21 tokens total (7 hand shapes, 5 palm orientations, 4 body locations, 4 movement aliases, 1 reset).

**Where used in our pipeline:** Step 16B (Avatar Renderer) — our own avatarRenderer.js splits a dictionary entry's HamNoSys string on whitespace and calls HAMNOSYS\_ACTIONS\[token\](signEngineInstance) for each token in order.

**How it's integrated:** Copied unmodified. Our own avatarRenderer.js drives it directly with the resolved HamNoSys string from Step 13-14, instead of however the original app's main.js/isl\_nlp.py pipeline called it.

**Instruction to AI agent:** Fetched and read in full (Phase 2). Do not reintroduce the earlier "string parser producing pose targets" assumption anywhere downstream — the confirmed token-to-function shape above is what integration code must target.

**3\. frontend/autoBoneMapper.js**

**What it is \[CONFIRMED by reading the fetched file, Phase 2\]:** Exports a single named function, autoMapBones(model), returning a plain object {canonicalBoneName: THREE.Bone}. Standalone and pure. CONFIRMED NOT used internally by SignEngine.js — SignEngine.js performs its own independent bone mapping in its own constructor and never accepts an externally-built bone table as input.

**Where used in our pipeline:** Not functionally required to drive Step 16B, since SignEngine.js does not consume this file's output. Still copied per the standing "never omit a reused file" instruction, but our integration code does not need to call it to make avatar animation work.

**How it's integrated:** Copied unmodified. Not called from our own application logic, since it provides no input SignEngine.js needs.

**Instruction to AI agent:** Fetched and read in full (Phase 2). Do not wire this file's output into SignEngine.js's constructor or into avatarRenderer.js — SignEngine.js ignores it.

**4\. frontend/SignEngine.js**

**What it is \[CONFIRMED by reading the fetched file, Phase 2\]:** Exports a class, SignEngine, constructed as new SignEngine({ model }). The constructor performs its OWN internal bone mapping (a private \_universalBoneMapper method) — it does not need or accept autoBoneMapper.js's output. There is NO playSign() function and NO HamNoSys-consuming method of any kind. Public methods are low-level: rotate(boneName, x, y, z, speed), reset(boneName), resetAll(), armTo(location) (chest/chin/head/stomach/forward), palm(orientation) (down/up/left/right/forward), hand(shape) (flat/fist/index/vee/pinch/cee/thumbup). CONFIRMED: there is no completion event, callback, or promise anywhere in this file — animation runs continuously via an internal requestAnimationFrame loop with no notification when an individual rotate() finishes. CONFIRMED: it does not automatically return to a neutral rest pose between signs — resetAll() must be called explicitly. CONFIRMED: all pose methods (armTo/palm/hand) operate only on Right\* bones — there is no left-hand equivalent, so every sign this engine plays is one-handed regardless of what a HamNoSys string implies. The constructor also runs an automatic self-test animation (tilt, raise arm, bend forearm, fist) starting 1.5 seconds after construction and resetting 3 seconds after that — this fires once, automatically, the moment a SignEngine instance is created, and is not something our integration code triggers or can suppress without modifying the file.

**Where used in our pipeline:** Step 16B (Avatar Renderer) — instantiated once, right after avatar.js's model resolves (Step 2/Phase 10), and reused for the whole session. Our avatarRenderer.js drives it per word by calling hamnosysMap.js's HAMNOSYS\_ACTIONS functions against this one instance, since there is no per-word "play this sign" call to make on SignEngine itself.

**How it's integrated:** Copied unmodified. Since there is no completion signal, our own render queue (Step 15\) advances after a fixed timeout (AVATAR\_SIGN\_HOLD\_MS, a frontend-only constant defined at the top of avatarRenderer.js — see docs/implementation.md section 3 exception — sized to the rotate() interpolation speed used) rather than listening for an event, and explicitly calls resetAll() before signaling completion to return to neutral between words.

**Instruction to AI agent:** Fetched and read in full (Phase 2). Do not build avatarRenderer.js around a playSign() call or a completion event — neither exists. Do not assume two-handed output is possible.

**5\. frontend/avatar.js**

**What it is \[CONFIRMED by reading the fetched file, Phase 2\]:** Exports a single named function, initAvatarScene(container), returning a Promise resolving to {model, scene, camera, renderer}. CONFIRMED this function builds and OWNS the entire Three.js scene, camera, renderer, lights, and OrbitControls itself, and already starts its own render loop internally — it is not a bare "load a model into an existing scene" helper. CONFIRMED it hardcodes the GLB fetch path as "/models/human.glb" (root-relative, cannot be changed without modifying the file). CONFIRMED this file and SignEngine.js both use bare ES module specifiers ("three", "three/examples/jsm/loaders/GLTFLoader.js", "three/examples/jsm/controls/OrbitControls.js"), which requires a native browser import map (not a bundler) in index.html to resolve.

**Where used in our pipeline:** Step 2 (frontend load / idle state) — our own main.js calls initAvatarScene() once and uses its returned scene/camera/renderer as the app's only Three.js state, rather than constructing separate ones.

**How it's integrated:** Copied unmodified, called once at app startup. Our backend's static file mounting (Phase 9\) must additionally serve frontend/vendor/models/ at the /models route so this file's hardcoded path resolves without modifying the file.

**Instruction to AI agent:** Fetched and read in full (Phase 2), including frontend/models/human.glb (valid glTF binary, 6.6MB). Do not have main.js create its own scene/camera/renderer before calling this function.

**6\. backend/isl\_nlp.py**

**What it is \[confirmed: "English → HamNoSys converter"\]:** In the original repo, this module takes English text and converts it directly to a HamNoSys sequence — likely doing both the gloss-ordering *and* the dictionary lookup in one step.

**Where used in our pipeline: NOT reused directly.** This is important — our architecture deliberately replaces this file's *role*, not its code. We're using Ollama for incremental gloss conversion (Step 12\) instead, and our own separate lookup layer (Step 13\) against isl\_dictionary.json instead of however this file internally looked things up. This file's logic doesn't fit our streaming/incremental design (it was almost certainly built for full-sentence, not rolling-buffer, input).

**How it's integrated:** It isn't — explicitly excluded. Noted here so the AI agent doesn't reflexively copy it just because it's in the repo.

**Instruction to AI agent:** Do **not** copy this file. Optionally open and skim it once purely for reference (e.g., to see how the original project structured its dictionary lookups, which might inform how we write our own Step 13 lookup code) — but do not wire it into our pipeline or call it from our backend.

**7\. backend/app.py**

**What it is \[confirmed: "Flask server with Whisper & Translation"\]:** The original repo's backend server, handling Whisper transcription and translation via Flask.

**Where used in our pipeline: NOT reused.** Our backend is FastAPI-based (per our finalized tech stack), built around WebSocket streaming and our own chunk/session-aware pipeline — architecturally quite different from what this file likely does (probably simple request/response, not streaming chunks with session invalidation).

**How it's integrated:** It isn't. We're writing our own app.py\-equivalent from scratch using FastAPI, borrowing *pattern ideas* at most (e.g., how it invokes Whisper) but not copying its code.

**Instruction to AI agent:** Do not copy this file. It may be worth a quick read purely to see how the original project invokes faster-whisper/Whisper as a sanity check on library usage patterns, but our backend is a fresh build per the FastAPI-based architecture already specified.

**8\. frontend/main.js, frontend/index.html, frontend/style.css**

**What they are \[confirmed\]:** The original repo's own application shell — UI layout, event wiring, and styling for its own demo page.

**Where used in our pipeline: NOT reused.** Our frontend has a different UI (mode toggle, fixed-position output window, status indicator, capture button flow) that doesn't match this repo's own demo UI.

**How it's integrated:** Not copied. We write our own index.html/main.js/style.css from scratch, per our own Step 2-18 spec, and only *call into* the reused modules we actually invoke (avatar.js, SignEngine.js, hamnosysMap.js) from within our own application logic. autoBoneMapper.js is copied into frontend/vendor/ per the reuse policy but is CONFIRMED (Phase 2) not to be called anywhere — SignEngine.js maps its own bones internally.

**Instruction to AI agent:** Do not copy these three files. Build our frontend shell fresh according to the main specification document already produced, importing/calling only avatar.js, SignEngine.js, and hamnosysMap.js from the reused set (plus isl\_dictionary.json backend-side and the human.glb asset) — autoBoneMapper.js and human.glb are still copied into the project per the "never omit a reused file" rule, but autoBoneMapper.js is not called from anywhere.

**Summary table**

| File | Copy it? | Used in our Step(s) |
| ----- | ----- | ----- |
| isl\_dictionary.json | ✅ Yes, unmodified — fetched, verified Phase 2 | 13, 1 (startup load), Fallback F |
| hamnosysMap.js | ✅ Yes, unmodified — fetched, verified Phase 2 | 16B |
| autoBoneMapper.js | ✅ Yes, unmodified — fetched, verified Phase 2 | copied only; not functionally called (SignEngine.js maps its own bones) |
| SignEngine.js | ✅ Yes, unmodified — fetched, verified Phase 2 | 16B (instantiated once, Step 2/Phase 10); no completion event — queue advances on fixed timeout |
| avatar.js | ✅ Yes, unmodified — fetched, verified Phase 2 | 2 (startup) — owns the Three.js scene/camera/renderer itself |
| models/human.glb | ✅ Yes, binary asset — fetched, verified Phase 2 | 2 (startup) |
| isl\_nlp.py | ❌ No — role replaced by Ollama \+ our own lookup | — |
| app.py | ❌ No — role replaced by our FastAPI backend | — |
| main.js, index.html, style.css | ❌ No — we build our own UI shell | — |

**Standing instruction to the AI IDE agent (place at top of its task list)**

Completed in Phase 2: every file marked "✅ Yes" above was fetched directly from https://github.com/jayakarthik07/speech-to-isl (main branch) and opened and read in full before any integration code was written against it. The confirmed exported function names, parameters, and completion-signaling mechanisms are recorded per-file above and in docs/implementation.md section 5 — later phases must build against those confirmed facts, not the original hypotheses this document started with. No phase after Phase 2 may reintroduce an assumption already superseded here (in particular: SignEngine.js has no playSign() and no completion event; avatar.js owns its own Three.js scene; autoBoneMapper.js is not consumed by SignEngine.js; isl\_dictionary.json is keyed by English word, not by gloss).

