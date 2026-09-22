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

Full pipeline spec: 18 steps, 8 fallback behaviors (unknown words, GPU contention, stream loss, seek debouncing, malformed model output, etc.) — see `docs/`.

## Tech stack

**Frontend**
- Vanilla HTML/CSS/JS — no framework, no bundler
- Three.js (via CDN) for avatar rendering
- Native Web Audio API + MediaDevices API for capture
- Native WebSocket for backend communication
- Chrome/Chromium only

**Backend**
- Python 3.10+, FastAPI + Uvicorn
- faster-whisper (CTranslate2, GPU-accelerated) — speech-to-text
- silero-vad (CPU) — chunk boundary detection + silence/hallucination filtering
- Ollama (local, 3B instruction-tuned model) — English → ISL gloss conversion
- No database — static, pre-built in-memory lookup structures only

**Data**
- `isl_dictionary.json` — gloss → HamNoSys mapping (avatar mode)
- CISLR dataset — gloss → video clip index (video mode), cached locally, never streamed live

## Hardware requirements

- NVIDIA GPU (developed against an RTX 3050) with CUDA-compatible drivers
- 16GB system RAM recommended
- CUDA toolkit matching your PyTorch/CTranslate2 build

## Setup
# 1. Clone
git clone https://github.com/<your-username>/signsetu.git
cd signsetu

# 2. Python environment
python3 -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# 3. Install the CUDA-enabled PyTorch build for your system
#    (see https://pytorch.org/get-started/locally/ — do NOT use the default CPU-only pip package)

# 4. Install and start Ollama
ollama pull llama3.2:3b   # or your chosen small instruction-tuned model
ollama serve

# 5. Place required static assets
#    - assets/isl_dictionary.json
#    - assets/cislr/dataset.csv and assets/cislr/clips/
#    - frontend/vendor/ files (from speech-to-isl repo — see docs/sin_setu_Code_Reuse.docx)

# 6. Run
python backend/main.py
Open `http://localhost:<port>` in Chrome, click **Start Capture**, select the source tab, and check **Share tab audio**.

## Project structure

See `docs/` for the full pipeline specification, file-structure/phase-wise implementation plan, and model specs.

## Status

Under active development, built phase-by-phase against the specification in `docs/`.

## Acknowledgements

Avatar rendering, HamNoSys parsing, and bone-mapping modules adapted from [speech-to-isl](https://github.com/jayakarthik07/speech-to-isl).

## License

TBD
