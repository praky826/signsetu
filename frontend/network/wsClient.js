// Step 9 (frontend half): the single long-lived WebSocket to the backend -
// audio out (binary), render instructions in (JSON text). Wire format decided
// in Phase 9, recorded in docs/implementation.md section 4.
//
// sessionId is generated here as a placeholder owner until Phase 15's
// sessionManager.js exists and takes over per the frozen sessionId
// convention ("owned on the frontend by sessionManager.js").

let socket = null;
let sessionId = null;
let sequenceNumber = 0;
let onRenderInstruction = null;

function generateSessionId() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0];
}

export function getSessionId() {
  return sessionId;
}

export function setOnRenderInstruction(callback) {
  onRenderInstruction = callback;
}

export function connect() {
  sessionId = generateSessionId();
  sequenceNumber = 0;
  socket = new WebSocket(`ws://${window.location.host}/ws`);

  socket.onmessage = (event) => {
    try {
      const instruction = JSON.parse(event.data);
      if (onRenderInstruction) onRenderInstruction(instruction);
    } catch (err) {
      console.error("wsClient: failed to parse render instruction", err);
    }
  };

  socket.onerror = (err) => {
    console.error("wsClient: socket error", err);
  };

  socket.onclose = () => {
    // Fallback C / Phase 14: statusIndicator.js will set RECONNECTING here.
    // Direct text write is a placeholder until that module exists.
    const statusEl = document.getElementById("status-indicator");
    if (statusEl) statusEl.textContent = "RECONNECTING";
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
  const header = new Uint32Array([sessionId, sequenceNumber++]);
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
export function reconnect() {
  if (socket) socket.close();
  return connect();
}
