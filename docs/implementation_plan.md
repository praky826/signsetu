# SignSetu — Implementation Plan

## Authority hierarchy (conflict resolution)
1. SignSetu.docx — 18-step pipeline, 8 fallbacks (A-H), architecture, finalized tech stack. Supreme.
2. SIGNSETU_PROJECT_FILE_STRUCTURE_and_PHASE_wise_IMPLEMENTATION.docx — file/folder layout, frontend/backend boundary, 17-phase order. Absolute for structure.
3. AI_Model_Specification_Document.docx — exact model configs, I/O formats, Model 3 system prompt + few-shot examples.
4. sin_setu_Code_Reuse.docx — guidance only; file descriptions are unverified hypotheses until the real files are read.
5. IMPLEMENTATION_ALGORITHM.docx — step-by-step algorithms; yields to all docs above on conflict.

## Pipeline summary (18 steps, SignSetu.docx)
1. Model warm-up (Whisper, Ollama, Silero-VAD) at backend startup.
2. Frontend idle state, avatar loaded neutral.
3-6. User starts tab capture, selects source + shares audio, confirms playback (autoplay gating).
7. Web Audio graph taps raw PCM (AudioWorkletNode, 16kHz target).
8. Backend VAD-assisted chunking (~1.5-2s, silence-snap or hard cap).
9. Raw PCM streamed continuously over WebSocket; chunking happens backend-side only.
10. faster-whisper transcribes each chunk (GPU, language="en", task="transcribe").
11. Rolling text buffer (~5-6 words: stable vs provisional).
12. Ollama incremental gloss conversion (JSON in/out, temp 0.1-0.2).
13. Parallel dictionary (HamNoSys) + CISLR video-path lookup.
14. Render mode resolution (video/avatar/fallback-per-word).
15. Session-filtered render queue push.
16A/16B. Video renderer / Avatar renderer (SignEngine.js).
17. Fixed output window, toggles avatar canvas vs video element.
18. Continuous seek/pause monitoring, sessionId invalidation.

Fallbacks: A unknown-word placeholder, B status indicator, C stream-loss reconnect, D VAD hallucination gate, E malformed-gloss discard/retry, F dictionary validation at startup, G GPU-contention degrade, H seek debounce.

## Tech stack (frozen, see implementation.md)
- Frontend: vanilla HTML/CSS/JS, Three.js via pinned CDN, no bundler, Chrome-only.
- Backend: Python 3.10+, FastAPI + Uvicorn, WebSocket bridge at backend/ws/connection.py only.
- Models: faster-whisper small (CUDA), silero-vad (CPU-only), Ollama llama3.2:3b (local, HTTP).
- No database — static in-memory dicts loaded once at startup.

## File/folder structure
Exactly as specified in SIGNSETU_PROJECT_FILE_STRUCTURE_and_PHASE_wise_IMPLEMENTATION.docx — see that document for the full tree. Not to be altered without flagging first.

## Phase order (17 phases, 0-indexed)
0. Environment, repo, docs, requirements.txt.
1. Config skeleton (backend/config.py) + package inits.
2. Static asset acquisition + legacy repo verification (6 reused files, CISLR data, placeholder image).
3. Backend model bootstrapping (Step 1): Whisper/VAD/Ollama warm-up, dictionary/CISLR loaders.
4. Audio ingestion, VAD chunking, hallucination gate (Steps 7-8, Fallback D).
5. Transcription + rolling text buffer (Steps 10-11).
6. Gloss conversion via Ollama (Step 12, Model 3, Fallback E).
7. Dictionary/video lookup + render resolution (Steps 13-14, Fallback A).
8. Session state + latency monitoring (Step 18 backend half, Fallback C/G/H).
9. WebSocket bridge + app assembly (Step 9, 15, main.py complete).
10. Frontend shell + avatar idle state (Step 2).
11. Frontend capture flow (Steps 3-6).
12. Frontend audio graph + streaming (Step 7/9 frontend half).
13. Frontend renderers + output window (Steps 15-17).
14. Status indicator + degrade handling (Fallback B, G frontend half).
15. Seek/pause monitoring, reconnect, debounce (Step 18 frontend half, Fallback C/H).
16. Full pipeline integration (no new files — seam-check pass).
17. Testing, rehearsal, threshold tuning (real fixtures only).

A phase does not start until the previous one is confirmed complete by the developer ("go" command required).

## Environment state confirmed at Phase 0 start
- git: repo initialized, branch `master`, no commits yet.
- Python: 3.11.9 venv at `.venv/` already created; torch 2.14.0+cu130 already installed.
- CUDA: driver 591.66, CUDA 13.1, RTX 3050 (6GB) confirmed via nvidia-smi.
- Ollama: v0.34.2 running, `llama3.2:3b` already pulled (2.0GB).
- Chrome: installed (v153.0.8010.52).
- CISLR: video clips already downloaded to `data/cislr/CISLR_v1.5-a_videos/...` (1.1GB) via Hugging Face cache — no `dataset.csv` metadata file present yet (needed in Phase 2 to build the gloss->path index; must be sourced separately since these are the raw videos-only files, keyed by YouTube video ID, not gloss word).
- `isl_dictionary.json` and the 6 reused speech-to-isl frontend files are not yet present — Phase 2 work.

## Decisions made that are not explicit in the docs
- Source spec files exist in-repo as `doc/*.docx.md` (Markdown conversions of the original .docx files, produced before this session). The file-structure spec calls for a `docs/` folder containing the original .docx files. Since only the converted Markdown is available, `docs/` will hold the same Markdown conversions for in-repo traceability rather than the binary .docx originals. Flagged here rather than silently assumed; original `doc/` left untouched.
- CISLR's `dataset.csv` metadata is not part of the video-only Hugging Face repo already downloaded. Phase 2 will need to locate and fetch the correct CISLR metadata source (likely a separate HF dataset file) to build the gloss->path index — this will be raised explicitly at the start of Phase 2 rather than assumed.

## Open items to confirm before/at Phase 2
- Exact CISLR metadata (dataset.csv) source location.
- Demo vocabulary set (which words' CISLR clips to keep locally cached) — needs the real demo source material, per the Real Data Rule.
