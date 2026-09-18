"""Step 1: app entry, model/lookup warm-up orchestration, /health.
Phase 9 (complete): mounts the frontend as static files, mounts
frontend/vendor/models/ at /models (avatar.js hardcodes this path,
confirmed Phase 2), registers the WebSocket endpoint at /ws, and starts
the three background pipeline loops. Also mounts assets/ at /assets (bug
found via a real capture session, Phase 15: render_resolver.py and
cislr_index.py send asset paths as URLs, which need an actual route to
resolve against - the placeholder image and CISLR clips are both under
assets/, so one mount serves both).
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.audio import chunker, vad
from backend.config import BASE_DIR
from backend.gloss import ollama_client
from backend.lookup import cislr_index, dictionary_loader
from backend.transcription import whisper_service
from backend.ws import connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_startup_status: dict[str, bool] = {
    "whisper": False,
    "vad": False,
    "ollama": False,
    "dictionary": False,
    "cislr": False,
}

_background_tasks: list[asyncio.Task] = []


def _load_lookups() -> None:
    """dictionary_loader and cislr_index are cheap/synchronous file-IO loads,
    run together as one worker-thread task."""
    _startup_status["dictionary"] = dictionary_loader.load()
    _startup_status["cislr"] = cislr_index.build()


@asynccontextmanager
async def lifespan(app: FastAPI):
    results = await asyncio.gather(
        asyncio.to_thread(whisper_service.init),
        asyncio.to_thread(vad.init),
        asyncio.to_thread(ollama_client.warm_up),
        asyncio.to_thread(_load_lookups),
    )
    _startup_status["whisper"] = results[0]
    _startup_status["vad"] = results[1]
    _startup_status["ollama"] = results[2]

    for name, ok in _startup_status.items():
        if not ok:
            logger.error("startup: component failed: %s", name)
    if all(_startup_status.values()):
        logger.info("startup: all components ready")

    _background_tasks.extend([
        asyncio.create_task(chunker.run_loop()),
        asyncio.create_task(whisper_service.run_loop()),
        asyncio.create_task(connection.run_render_loop()),
    ])

    yield

    for task in _background_tasks:
        task.cancel()
    await asyncio.gather(*_background_tasks, return_exceptions=True)


app = FastAPI(lifespan=lifespan)

# avatar.js (frontend/vendor/avatar.js, confirmed Phase 2) hardcodes its GLB
# fetch as the root-relative path "/models/human.glb" and cannot be modified -
# this second mount makes that path resolve without touching the reused file.
app.mount("/models", StaticFiles(directory=BASE_DIR / "frontend" / "vendor" / "models"), name="models")

# Serves the Fallback A placeholder image and, once cached, real CISLR clips -
# render_resolver.py and cislr_index.py both produce assetRef values relative
# to this mount (e.g. "/assets/placeholder/unknown_word.png").
app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")

app.websocket("/ws")(connection.websocket_endpoint)


@app.get("/health")
def health():
    ready = all(_startup_status.values())
    return {
        "status": "ready" if ready else "loading",
        "components": dict(_startup_status),
    }


# Mounted last: StaticFiles(html=True) serves index.html for "/" and is a
# catch-all for the mount path, so routes above it would otherwise be shadowed.
app.mount("/", StaticFiles(directory=BASE_DIR / "frontend", html=True), name="frontend")
