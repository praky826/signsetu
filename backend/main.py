"""Step 1: app entry, model/lookup warm-up orchestration, /health.

Static file mounting and the WebSocket route are added in Phase 9 - this
phase only brings the four startup components up concurrently and exposes
/health reflecting their true readiness.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.audio import vad
from backend.gloss import ollama_client
from backend.lookup import cislr_index, dictionary_loader
from backend.transcription import whisper_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_startup_status: dict[str, bool] = {
    "whisper": False,
    "vad": False,
    "ollama": False,
    "dictionary": False,
    "cislr": False,
}


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

    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health():
    ready = all(_startup_status.values())
    return {
        "status": "ready" if ready else "loading",
        "components": dict(_startup_status),
    }
