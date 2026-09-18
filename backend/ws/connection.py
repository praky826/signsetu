"""Step 9 (complete, Phase 9): WebSocket endpoint - audio in, render
instructions out, per-session state. The only communication boundary
between frontend and backend.

Wire format decisions (not specified in the docs - recorded here since later
frontend phases must produce/consume exactly this):

Binary messages (frontend -> backend): continuous raw audio, an 8-byte
little-endian header followed by raw float32 PCM samples:
    bytes 0-3: sessionId, uint32
    bytes 4-7: sequence number, uint32 (unused backend-side beyond logging -
               per-session ordering is guaranteed by connection message order)
    bytes 8+:  float32 PCM samples, mono, 16kHz (Step 7)

Text messages (frontend -> backend): JSON control envelopes, since the mode
toggle (Step 14) and confirmed-seek relay (Step 18, Fallback H) both need a
channel to the backend and neither has an exact wire shape specified anywhere
in the docs:
    {"type": "set_mode", "mode": "video" | "avatar"}
    {"type": "seek", "sessionId": "<new id>"}

Text messages (backend -> frontend): either a render instruction,
{"word", "renderType", "assetRef", "sessionId"} (Step 14's frozen shape),
sent only once session_state.is_current() confirms it is still valid
(Step 15's session-filtered push, enforced backend-side before sending); or,
since Fallback G's frontend half explicitly requires a backend-sent latency
signal rather than frontend-side re-measurement, and no wire shape for it is
specified anywhere in the docs (Phase 14 decision): a control message
{"type": "latency_status", "degraded": true|false}, sent only when
latency_tracker.should_degrade() actually changes value, never every cycle.
"""

import asyncio
import logging
import struct

import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

from backend.audio import chunker
from backend.config import GLOSS_CYCLE_INTERVAL_MS
from backend.gloss import ollama_client
from backend.lookup import render_resolver
from backend.monitoring import latency_tracker
from backend.session import session_state

logger = logging.getLogger(__name__)

_HEADER = struct.Struct("<II")

_current_websocket: WebSocket | None = None
_current_mode = "video"  # matches Phase 10's planned default mode toggle state


async def websocket_endpoint(websocket: WebSocket) -> None:
    global _current_websocket
    await websocket.accept()
    _current_websocket = websocket
    session_established = False
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                raise WebSocketDisconnect(message.get("code", 1000))

            if message.get("bytes") is not None:
                data = message["bytes"]
                if len(data) < _HEADER.size:
                    logger.warning("connection: dropped undersized message (%d bytes)", len(data))
                    continue

                session_id_int, seq = _HEADER.unpack_from(data, 0)
                session_id = str(session_id_int)
                pcm = np.frombuffer(data, dtype="<f4", offset=_HEADER.size)

                if not session_established:
                    # First message on this connection: resume_session() correctly
                    # handles both a brand-new session and a reconnect carrying the
                    # same or a new sessionId (Step 18, Fallback C).
                    session_state.resume_session(session_id)
                    session_established = True
                elif not session_state.is_current(session_id):
                    logger.debug("connection: dropped message for stale session %s", session_id)
                    continue

                chunker.append_audio(session_id, pcm)

            elif message.get("text") is not None:
                _handle_control_message(message["text"])
    except WebSocketDisconnect:
        logger.info("connection: client disconnected")
        session_state.freeze_session()
    finally:
        if _current_websocket is websocket:
            _current_websocket = None


def _handle_control_message(raw_text: str) -> None:
    import json

    global _current_mode
    try:
        msg = json.loads(raw_text)
    except Exception:
        logger.warning("connection: dropped malformed control message: %r", raw_text)
        return

    if msg.get("type") == "set_mode" and msg.get("mode") in ("video", "avatar"):
        _current_mode = msg["mode"]
    elif msg.get("type") == "seek" and isinstance(msg.get("sessionId"), str):
        session_state.increment_session(msg["sessionId"])
    else:
        logger.warning("connection: dropped unrecognized control message: %r", msg)


async def run_render_loop() -> None:
    """Background task (Phase 9): every GLOSS_CYCLE_INTERVAL_MS, runs one
    Step 12 cycle for the current session, resolves each validated gloss word
    (Step 13-14), and pushes valid instructions out over the open WebSocket.
    ollama_client.run_cycle() runs in a worker thread so its HTTP round-trip
    to Ollama never blocks this event loop (same reasoning as Phase 9's
    whisper_service.run_loop() fix). Also relays Fallback G's latency-degrade
    signal (Phase 14) whenever it changes, never every cycle."""
    interval = GLOSS_CYCLE_INTERVAL_MS / 1000
    last_degraded = False
    while True:
        if _current_websocket is not None:
            degraded = latency_tracker.should_degrade()
            if degraded != last_degraded:
                last_degraded = degraded
                try:
                    await _current_websocket.send_json({"type": "latency_status", "degraded": degraded})
                except Exception:
                    logger.exception("connection: failed to send latency_status")

        session_id = session_state.get_current_session_id()
        if session_id is not None and _current_websocket is not None:
            words = await asyncio.to_thread(ollama_client.run_cycle, session_id)
            if words:
                for word in words:
                    instruction = render_resolver.resolve_render(word, _current_mode, session_id)
                    if session_state.is_current(instruction["sessionId"]) and _current_websocket is not None:
                        try:
                            await _current_websocket.send_json(instruction)
                        except Exception:
                            logger.exception("connection: failed to send render instruction")
                    else:
                        logger.debug("connection: dropped stale render instruction for %s", instruction["sessionId"])
        await asyncio.sleep(interval)
