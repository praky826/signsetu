// Fallback B: enum-backed status state machine. Deliberately simple - one
// shared state object, one setStatus() function, one UI subscriber.

export const Status = Object.freeze({
  IDLE: "IDLE",
  LISTENING: "LISTENING",
  NO_AUDIO: "NO_AUDIO",
  RECONNECTING: "RECONNECTING",
  PROCESSING_DELAY: "PROCESSING_DELAY",
});

const STATUS_CLASS = {
  IDLE: "status-idle",
  LISTENING: "status-listening",
  NO_AUDIO: "status-no-audio",
  RECONNECTING: "status-reconnecting",
  PROCESSING_DELAY: "status-processing-delay",
};

const el = document.getElementById("status-indicator");
let currentStatus = Status.IDLE;

export function setStatus(newStatus) {
  if (!(newStatus in STATUS_CLASS)) {
    console.error(`statusIndicator: unknown status "${newStatus}"`);
    return;
  }
  currentStatus = newStatus;
  el.textContent = newStatus.replace(/_/g, " ");
  el.className = STATUS_CLASS[newStatus];
}

export function getStatus() {
  return currentStatus;
}

// Fallback G, frontend half: driven by a backend-sent latency signal
// (Phase 8's latency_tracker.py relayed over the WebSocket, Phase 14), never
// by the frontend independently re-measuring latency.
export function setProcessingDelay(active) {
  setStatus(active ? Status.PROCESSING_DELAY : Status.LISTENING);
}
