// Step 9 (frontend half): the single long-lived WebSocket to the backend -
// audio out (binary), render instructions in (JSON text). Wire format decided
// in Phase 9, recorded in docs/implementation.md section 4.
//
// sessionId is owned by sessionManager.js (Phase 15), per the frozen
// sessionId convention - read fresh on every send rather than cached here.
//
// Incoming messages are discriminated by the presence of a "type" field
// (Phase 14, not specified in the docs): render instructions have the frozen
// {word, renderType, assetRef, sessionId} shape with no "type" key, while
// backend-originated control messages (currently only latency_status, for
// Fallback G) always carry one. This avoids adding a field to the frozen
// render-instruction shape while still allowing new message kinds.

import { Status, setStatus, setProcessingDelay } from "../status/statusIndicator.js";
import { getSessionId } from "../session/sessionManager.js";

let socket = null;
let sequenceNumber = 0;
let onRenderInstruction = null;

export function setOnRenderInstruction(callback) {
  onRenderInstruction = callback;
}

export function connect() {
  // Reconnect (Fallback C) calls this again on the same page load, after
  // sessionManager.js's own capture retry - close any still-open prior
  // socket first so a reconnect never leaves two live connections open
  // (found via Phase 16's end-to-end trace, not caught in isolation since
  // Phase 15 only exercised this path once per test).
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  sequenceNumber = 0;
  socket = new WebSocket(`ws://${window.location.host}/ws`);

  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "latency_status") {
        setProcessingDelay(parsed.degraded);
        return;
      }
      if (onRenderInstruction) onRenderInstruction(parsed);
    } catch (err) {
      console.error("wsClient: failed to parse incoming message", err);
    }
  };

  socket.onerror = (err) => {
    console.error("wsClient: socket error", err);
  };

  socket.onclose = () => {
    // Fallback C.
    setStatus(Status.RECONNECTING);
    console.warn("wsClient: socket closed");
  };

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

// Sends a raw float32 PCM buffer, tagged with the current sessionId and an
// incrementing sequence number, per the Phase 9 binary framing.
export function sendAudio(pcmFloat32Array) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const header = new Uint32Array([getSessionId(), sequenceNumber++]);
  const message = new Uint8Array(header.byteLength + pcmFloat32Array.byteLength);
  message.set(new Uint8Array(header.buffer), 0);
  message.set(new Uint8Array(pcmFloat32Array.buffer), header.byteLength);
  socket.send(message.buffer);
}

// Sends a JSON control envelope (set_mode, seek) per the Phase 9 wire format.
export function sendControlMessage(obj) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(obj));
}

// Exposed for Phase 15's sessionManager.js to call without a full page reload.
// connect() itself now closes any prior socket, so this is just an alias.
export function reconnect() {
  return connect();
}
