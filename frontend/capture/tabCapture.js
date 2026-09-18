// Steps 3-4, 6: user-gesture-gated tab/audio share flow.
// getDisplayMedia can only be invoked as a direct result of a user gesture
// (a click), never programmatically on page load - this is why capture is a
// manual step rather than automated.

import { Status, setStatus } from "../status/statusIndicator.js";

const messageEl = document.getElementById("capture-message");
const messageTextEl = document.getElementById("capture-message-text");
const retryBtn = document.getElementById("capture-retry-btn");

function showMessage(text, onRetry) {
  messageTextEl.textContent = text;
  messageEl.classList.remove("hidden");
  retryBtn.onclick = onRetry;
}

function hideMessage() {
  messageEl.classList.add("hidden");
  retryBtn.onclick = null;
}

// Exposed as the re-triggerable entry point so sessionManager.js (Phase 15)
// can call this same flow again on reconnect, and so a failed attempt's own
// retry button can call it again with the same onSuccess callback.
export async function startCapture(onSuccess) {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    hideMessage();
    setStatus(Status.LISTENING);
    onSuccess(stream);
  } catch (err) {
    console.error("tabCapture: getDisplayMedia failed or was cancelled", err);
    showMessage("Screen/tab share was cancelled or denied.", () => startCapture(onSuccess));
  }
}
