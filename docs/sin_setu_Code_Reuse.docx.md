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

**What it is \[confirmed\]:** A flat JSON database of 250+ ISL signs, each entry mapping an English gloss word to its HamNoSys notation string.

**Where used in our pipeline:** Step 13 (Lookup) of our main spec — one of the two parallel dictionaries checked per gloss word.

**How it's integrated:** Copied wholesale, unmodified, into our backend. Loaded once into memory at Step 1 (startup), then validated per Fallback F (parsing every entry once to exclude malformed ones) before being used as our in-memory avatar-vocabulary lookup table for the rest of the session.

**Instruction to AI agent:** Attempt to fetch this file directly from the repo's backend/isl\_dictionary.json path. If network access is unavailable, stop and ask the developer (me) to manually download this file from the repo and paste its contents into the project at the equivalent path, then continue.

**2\. frontend/hamnosysMap.js**

**What it is \[inferred from filename \+ feature list, verify on read\]:** Per the README's "3D Avatar Animation: Realistic ISL signs using HamNoSys notation" feature, this file almost certainly contains the parsing logic that turns a HamNoSys token string (e.g. "hamflathand hampalmd hamchest") into a set of target bone-rotation values — essentially a lookup/mapping table from HamNoSys symbols to pose data.

**Where used in our pipeline:** Step 16B (Avatar Renderer) — this is the module that converts a dictionary entry's HamNoSys string into an actual pose the avatar can perform.

**How it's integrated:** Copied unmodified. Our backend/frontend calls its exported parsing function with a HamNoSys string (retrieved from isl\_dictionary.json via our own lookup layer in Step 13-14) instead of however the original app's main.js/isl\_nlp.py pipeline called it. We're replacing what *feeds* this file, not the file itself.

**Instruction to AI agent:** Fetch frontend/hamnosysMap.js directly if network access allows. Read the file fully first and confirm its actual exported function names/signatures before wiring our Step 14 output into it — **do not assume** the function name/shape described above is exact; adjust our integration code to match what's actually exported. If network access is unavailable, ask the developer to paste this file's contents in, then proceed with the same read-and-confirm step.

**3\. frontend/autoBoneMapper.js**

**What it is \[confirmed from feature list: "Auto Bone Mapping: Works with any Mixamo/ReadyPlayerMe avatar"\]:** Detects the actual bone names present on whatever GLB rig is loaded and builds a translation table from the engine's abstract pose targets to that specific model's real bone names — this is what lets the same HamNoSys-derived poses work across different avatar exports without hand-authored rig mapping per model.

**Where used in our pipeline:** Runs once at avatar load time (our Step 2, when human.glb is loaded into the Three.js scene), producing the bone-name table that Step 16B's animation relies on for every subsequent word.

**How it's integrated:** Copied unmodified, called once during our app's startup/idle sequence (Step 2\) rather than repeatedly — no per-word re-mapping needed, since the rig doesn't change mid-session.

**Instruction to AI agent:** Fetch frontend/autoBoneMapper.js directly if possible. Confirm what function it exports and what triggers it (likely called once after the GLB model finishes loading — verify against actual code, not assumption). If network access is unavailable, ask the developer to paste this file's contents in before proceeding.

**4\. frontend/SignEngine.js**

**What it is \[confirmed: "3D animation engine" per file tree comment; "Smooth Animations: Bio-mechanically accurate hand and arm movements" per features\]:** The core Three.js animation loop — takes a sequence of target poses (from hamnosysMap.js, resolved through autoBoneMapper.js's bone table) and interpolates the avatar's current pose toward each target over time, producing continuous rather than jump-cut motion.

**Where used in our pipeline:** Step 16B (Avatar Renderer) — this is the actual thing that plays a sign once we've resolved a word to a HamNoSys entry.

**How it's integrated:** Copied unmodified. Our own render queue (Step 15\) calls this engine's public "play this sign" function per word, and listens for its own completion signal (likely an event or callback — **verify exact mechanism on read**) to know when to advance our queue to the next word, exactly as described in our Step 16B spec.

**Instruction to AI agent:** Fetch frontend/SignEngine.js directly if possible. This is the most important file to read carefully in full before integrating — identify (a) its public API/exported functions, (b) how it signals "this sign's animation is complete" so our queue-advance logic (Step 15\) can hook into it correctly, and (c) whether it already handles returning to a neutral rest pose between signs (per our Fallback/Step 16B spec) or whether we need to add that ourselves. If network access is unavailable, ask the developer to paste this file's full contents in — do not guess at its API and write integration code against assumptions.

**5\. frontend/avatar.js**

**What it is \[confirmed: "Avatar loader"\]:** Loads human.glb into the Three.js scene and likely poses it in a neutral rest state initially.

**Where used in our pipeline:** Step 2 (frontend load / idle state) — this is what actually gets the avatar visible on screen before any signing starts.

**How it's integrated:** Copied unmodified, called once at app startup.

**Instruction to AI agent:** Fetch frontend/avatar.js and frontend/models/human.glb directly if possible (note: the .glb is a binary asset, not source code — confirm your fetch method handles binary files correctly, or ask the developer to download it manually if unsure). If network access is unavailable for either file, ask the developer to download and place both at the equivalent paths in our project.

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

**How it's integrated:** Not copied. We write our own index.html/main.js/style.css from scratch, per our own Step 2-18 spec, and only *call into* the reused modules (avatar.js, SignEngine.js, hamnosysMap.js, autoBoneMapper.js) from within our own application logic.

**Instruction to AI agent:** Do not copy these three files. Build our frontend shell fresh according to the main specification document already produced, importing/calling only the five files marked "copied unmodified" above (isl\_dictionary.json, hamnosysMap.js, autoBoneMapper.js, SignEngine.js, avatar.js, plus the human.glb asset).

**Summary table**

| File | Copy it? | Used in our Step(s) |
| ----- | ----- | ----- |
| isl\_dictionary.json | ✅ Yes, unmodified | 13, 1 (startup load), Fallback F |
| hamnosysMap.js | ✅ Yes, unmodified | 16B |
| autoBoneMapper.js | ✅ Yes, unmodified | 2 (startup), feeds 16B |
| SignEngine.js | ✅ Yes, unmodified | 16B, 15 (queue-advance hook) |
| avatar.js | ✅ Yes, unmodified | 2 (startup) |
| models/human.glb | ✅ Yes, binary asset | 2 (startup) |
| isl\_nlp.py | ❌ No — role replaced by Ollama \+ our own lookup | — |
| app.py | ❌ No — role replaced by our FastAPI backend | — |
| main.js, index.html, style.css | ❌ No — we build our own UI shell | — |

**Standing instruction to the AI IDE agent (place at top of its task list)**

For every file marked "✅ Yes" above: first attempt to fetch it directly from https://github.com/jayakarthik07/speech-to-isl at its listed path (via git clone or a raw-file fetch, whichever tooling is available). Immediately after fetching, **open and read the file fully** before writing any integration code against it — the descriptions in this spec are working hypotheses based on the repo's README, not confirmed source, and the actual exported function names, parameters, and completion-signaling mechanism (especially in SignEngine.js) must be verified against the real code, not assumed. If network/internet access is not available in this environment, stop and explicitly ask the developer to manually download the specific file from the repo URL above and paste its contents into the project at the path indicated, then resume once provided — do not fabricate or guess at this file's contents under any circumstance.

