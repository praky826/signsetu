// Step 18, Fallback C/H (frontend half): sessionId ownership, seek detection
// via AnalyserNode signal discontinuity, debounce, and stream-loss reconnect.
//
// sessionId ownership moves here from wsClient.js's Phase 12 placeholder, per
// the frozen convention ("owned on the frontend by sessionManager.js").

import { getAnalyser } from "../capture/streamValidation.js";
import { startCapture } from "../capture/tabCapture.js";
import { sendControlMessage } from "../network/wsClient.js";
import { clearQueue } from "../render/renderQueue.js";
import { Status, setStatus } from "../status/statusIndicator.js";

// Frontend-only tunables (no frontend config module exists, per the
// AVATAR_SIGN_HOLD_MS precedent, docs/implementation.md section 3).
// SEEK_DEBOUNCE_MS mirrors backend/config.py's same-named constant's value
// (150-200ms): the backend's copy is Python-only and unusable from JS, so a
// separate frontend constant is required here (flagged during the Phase 14
// consistency check, fixed now that this file actually needs it).
const SEEK_DEBOUNCE_MS = 175;
// Seek detection is inherently indirect and approximate (Step 18: "since the
// source tab isn't directly controllable"). CONFIRMED by testing against
// real narrated speech (not simulated): an initial 150-1500ms window
// triggered on nearly every natural pause between words/sentences, wiping
// the chunker and text buffer on almost every cycle and preventing any real
// transcription from ever accumulating into a gloss. Normal speech pauses
// and a genuine video-seek's audio gap are not reliably distinguishable by
// duration alone at short timescales, so these bounds are set high enough
// that ordinary speech (including deliberate narration pauses) essentially
// never triggers this, accepting that some real seeks will be missed rather
// than destroying good progress on every breath - the far more costly
// failure mode of the two.
const SEEK_SILENCE_GAP_MS = 4000;
const SEEK_RESUME_WINDOW_MS = 10000;

const reconnectBtn = document.getElementById("reconnect-btn");

let currentSessionId = null;
let debounceTimer = null;
let silenceStartedAt = null;
let monitorInterval = null;

function generateSessionId() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0];
}

function incrementSessionId() {
  currentSessionId = (currentSessionId + 1) >>> 0; // wrap within uint32
  return currentSessionId;
}

export function getSessionId() {
  return currentSessionId;
}

// Called once, when capture first succeeds (Phase 11/12's flow, extended).
export function initSession() {
  currentSessionId = generateSessionId();
  return currentSessionId;
}

function hasSignal(analyser, buffer) {
  analyser.getByteTimeDomainData(buffer);
  for (let i = 0; i < buffer.length; i++) {
    if (Math.abs(buffer[i] - 128) > 2) return true;
  }
  return false;
}

function confirmSeek() {
  const newId = incrementSessionId();
  clearQueue();
  sendControlMessage({ type: "seek", sessionId: String(newId) });
}

function onDiscontinuityDetected() {
  // Standard debounce: reset on every new discontinuity signal during a
  // scrub gesture, only firing once settled (Fallback H).
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    confirmSeek();
  }, SEEK_DEBOUNCE_MS);
}

// Monitors the shared AnalyserNode (streamValidation.js) for a silence-then-
// resume pattern within SEEK_RESUME_WINDOW_MS - an approximation of "seek
// happened", not a precise signal, since the source tab cannot be inspected
// directly.
export function startSeekMonitoring() {
  const analyser = getAnalyser();
  if (!analyser) {
    console.warn("sessionManager: no analyser available yet, cannot monitor for seeks");
    return;
  }
  const buffer = new Uint8Array(analyser.frequencyBinCount);

  monitorInterval = setInterval(() => {
    const signalPresent = hasSignal(analyser, buffer);
    const now = Date.now();

    if (!signalPresent) {
      if (silenceStartedAt === null) silenceStartedAt = now;
      return;
    }

    if (silenceStartedAt !== null) {
      const silenceDuration = now - silenceStartedAt;
      silenceStartedAt = null;
      if (silenceDuration >= SEEK_SILENCE_GAP_MS && silenceDuration <= SEEK_RESUME_WINDOW_MS) {
        onDiscontinuityDetected();
      }
    }
  }, 100);
}

export function stopSeekMonitoring() {
  if (monitorInterval) clearInterval(monitorInterval);
  monitorInterval = null;
  silenceStartedAt = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
}

// Fallback C: called when the captured track ends unexpectedly. Deliberately
// does not increment sessionId or clear buffers - reconnecting to the same
// content is expected, and a full reset would discard more context than
// necessary.
function handleStreamEnded(onReconnectRequested) {
  setStatus(Status.RECONNECTING);
  stopSeekMonitoring();
  reconnectBtn.classList.remove("hidden");
  reconnectBtn.onclick = () => {
    reconnectBtn.classList.add("hidden");
    reconnect(onReconnectRequested);
  };
}

export function attachStreamEndListener(stream, onReconnectRequested) {
  const [track] = stream.getAudioTracks();
  if (track) {
    track.onended = () => handleStreamEnded(onReconnectRequested);
  }
}

// Re-triggers tabCapture.js's flow (Steps 3-6) without a full page reload.
// A reconnect keeps the existing sessionId (a mere reconnect to the same
// content, per Fallback C's own framing) - the backend's session_state.
// resume_session() already treats an unchanged sessionId as "unfreeze, keep
// buffers" rather than a full reset, so no separate genuinely-new-stream
// detection is attempted here (a MediaStream object reference can't reliably
// distinguish "same tab reselected" from "different tab selected" anyway).
//
// Does not itself reconnect the WebSocket: onNewStream is main.js's
// validateStream(...) -> handleValidStream chain, which already calls
// wsClient's connect() once real audio is confirmed (Phase 16 fix - this
// function used to also connect here first, opening a second, immediately-
// orphaned socket on every reconnect since neither connect call closed the
// other's before this file's own onNewStream() also connected).
export function reconnect(onNewStream) {
  startCapture((stream) => {
    attachStreamEndListener(stream, onNewStream);
    onNewStream(stream);
  });
}
