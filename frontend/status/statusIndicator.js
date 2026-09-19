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

// Icon-first per the redesign (this app is for deaf users - status should
// be readable from the icon/color alone, text is a secondary confirmation).
const STATUS_ICON = {
  IDLE: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5"></path>',
  LISTENING:
    '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"></path><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path>',
  NO_AUDIO:
    '<path d="M9 9v3a3 3 0 0 0 4.6 2.5"></path><path d="M12 3a3 3 0 0 1 3 3v3"></path><path d="M5 11a7 7 0 0 0 10.6 6"></path><path d="M12 18v3"></path><path d="M2 2l20 20"></path>',
  RECONNECTING: '<path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 3v6h-6"></path>',
  PROCESSING_DELAY: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path>',
};

const el = document.getElementById("status-indicator");
const labelEl = el.querySelector(".status-label");
const iconEl = el.querySelector(".status-icon");
let currentStatus = Status.IDLE;

export function setStatus(newStatus) {
  if (!(newStatus in STATUS_CLASS)) {
    console.error(`statusIndicator: unknown status "${newStatus}"`);
    return;
  }
  currentStatus = newStatus;
  el.className = STATUS_CLASS[newStatus];
  labelEl.textContent = newStatus.replace(/_/g, " ");
  iconEl.innerHTML = STATUS_ICON[newStatus];
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
