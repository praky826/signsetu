"""Step 9 (receive half, Phase 4): WebSocket endpoint receiving the frontend's
continuous raw-audio stream and feeding it into chunker.py's per-session buffer.

Not yet registered as a route on the FastAPI app - that wiring, plus the send
half (pushing render instructions back out), is Phase 9's job. This module
only defines the handler function so Phase 9 can attach it without touching
this file.

Wire format decision (not specified in the docs - recorded here since Phase 12's
frontend wsClient.js must produce the exact same framing): each binary
WebSocket message is a fixed 8-byte header followed by raw float32 PCM
samples, all little-endian:
    bytes 0-3: sessionId, uint32
    bytes 4-7: sequence number, uint32 (currently unused backend-side beyond
               logging - per-session ordering is guaranteed by a single
               connection's message order, not by this field)
    bytes 8+:  float32 PCM samples, mono, 16kHz (Step 7)
"""

import logging
import struct

import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

from backend.audio import chunker

logger = logging.getLogger(__name__)

_HEADER = struct.Struct("<II")


async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            if len(data) < _HEADER.size:
                logger.warning("connection: dropped undersized message (%d bytes)", len(data))
                continue

            session_id_int, seq = _HEADER.unpack_from(data, 0)
            session_id = str(session_id_int)
            pcm = np.frombuffer(data, dtype="<f4", offset=_HEADER.size)

            chunker.append_audio(session_id, pcm)
    except WebSocketDisconnect:
        logger.info("connection: client disconnected")
        # Buffer cleanup on disconnect is handled by session/reconnect logic
        # in later phases, not here (Fallback C treats a disconnect as
        # possibly-temporary, not an immediate reset).
