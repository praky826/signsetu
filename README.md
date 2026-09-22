# SignSetu

Real-time speech-to-Indian-Sign-Language (ISL) translation for in-browser video/audio content. SignSetu captures tab audio (e.g. a YouTube or Spotify tab), transcribes it locally, converts the transcript into ISL gloss order, and renders the corresponding signs live — either through a 3D avatar or pre-recorded sign-language video clips — in a small always-on-top output window.

## What it does

1. Captures tab audio via the browser's screen/tab-share picker (no server-side audio capture, no external API calls).
2. Transcribes speech locally and continuously using **faster-whisper**, chunked into ~1.5–2s segments with VAD-based boundary snapping.
3. Converts the rolling transcript into **ISL gloss order** (reordered, articles/copulas dropped) using a local **Ollama** 3B model, constrained to a fixed vocabulary.
4. Renders each gloss word as a sign, using either:
   - a **3D avatar** (Three.js + HamNoSys-driven pose animation), or
   - a **video clip** from the **CISLR** dataset,
   
   with automatic per-word fallback between the two, and a visible placeholder for any word that can't be resolved.
5. Handles seeking/pausing/rewinding the source video gracefully, invalidating stale in-flight output rather than showing incorrect signs.

Everything runs **locally** — no cloud APIs, no external inference calls at runtime.

## Pipeline overview
