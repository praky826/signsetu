// Step 5: confirm the captured stream actually contains usable, non-silent
// audio before the pipeline proceeds.

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

let sharedAnalyser = null;
let sharedAudioContext = null;

// Exposed for Phase 15's sessionManager.js to later use sustained-signal
// discontinuity as an indirect seek/pause signal, per Step 18.
export function getAnalyser() {
  return sharedAnalyser;
}

function hasSignal(analyser, buffer) {
  analyser.getByteTimeDomainData(buffer);
  for (let i = 0; i < buffer.length; i++) {
    if (Math.abs(buffer[i] - 128) > 2) return true;
  }
  return false;
}

// onValid is called exactly once, the first time real signal energy is
// detected. Sampling continues indefinitely afterward (Phase 15's future use)
// rather than stopping once validated.
function sampleSignal(stream, onValid) {
  // Reconnect (Fallback C) calls validateStream() again on a new stream -
  // close the previous validation AudioContext first so reconnecting doesn't
  // leak one live AudioContext per reconnect (Phase 16 end-to-end trace).
  if (sharedAudioContext) {
    sharedAudioContext.close();
  }
  const audioContext = new AudioContext();
  sharedAudioContext = audioContext;
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);
  sharedAnalyser = analyser;

  const buffer = new Uint8Array(analyser.frequencyBinCount);
  let validated = false;

  // No separate "waiting for playback" state exists in Fallback B's enum -
  // LISTENING already covers "capture active, waiting for/processing audio"
  // per its own definition, so no status change is needed here; tabCapture.js
  // already set LISTENING when capture started.

  setInterval(() => {
    const signalPresent = hasSignal(analyser, buffer);
    if (signalPresent && !validated) {
      validated = true;
      onValid(stream);
    }
  }, 200);
}

// onRetryCapture re-triggers tabCapture.js's flow (Steps 3-6) when there is
// no audio track at all - a real failure, unlike "no signal yet" below.
export function validateStream(stream, onValid, onRetryCapture) {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    setStatus(Status.NO_AUDIO);
    showMessage("No audio detected — please re-share and check 'Share tab audio'.", onRetryCapture);
    return;
  }

  hideMessage();
  sampleSignal(stream, onValid);
}
