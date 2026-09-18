// Application entry point and orchestrator (Step 2 skeleton, Phase 10).
// Wires all frontend modules together; sessionId is owned by
// sessionManager.js (Phase 15), not this file.
//
// avatar.js's initAvatarScene() builds and owns the entire Three.js scene,
// camera, and renderer itself - main.js does not construct a separate one
// (confirmed API, Phase 2). SignEngine is constructed exactly once, here,
// immediately after the avatar model resolves, since it has no per-word
// construction step and Phase 13's avatarRenderer.js calls methods on it.
// Constructing it automatically triggers SignEngine's own built-in self-test
// animation (~1.5s after construction, resetting ~3s later) - expected
// reused-file behavior, not an error to catch.

import { initAvatarScene } from "./vendor/avatar.js";
import { SignEngine } from "./vendor/SignEngine.js";
import { startCapture } from "./capture/tabCapture.js";
import { validateStream } from "./capture/streamValidation.js";
import { startAudioGraph } from "./audio/audioGraph.js";
import { connect as connectWebSocket, setOnRenderInstruction, sendControlMessage } from "./network/wsClient.js";
import { enqueue } from "./render/renderQueue.js";
import { setSignEngine } from "./render/avatarRenderer.js";
import { initSession, attachStreamEndListener, startSeekMonitoring } from "./session/sessionManager.js";

let signEngine = null;

// Our human.glb's bones are all named with a trailing numeric suffix
// (e.g. "mixamorigRightArm_033"), confirmed by direct test in the browser.
// SignEngine.js's own internal bone matcher only ever checks whether a
// normalized bone name ENDS WITH an expected pattern (e.g. "rightarm") - a
// trailing "_033" breaks that for 65 of this model's 66 bones, silently
// leaving every arm/hand bone unmapped and every avatar sign a no-op.
// Fixed entirely in our own code, not by editing SignEngine.js: strip the
// trailing "_<digits>" suffix from bone names before SignEngine ever sees
// the model. Verified this restores all needed bone mappings.
function stripBoneNameSuffixes(model) {
  model.traverse((node) => {
    if (node.isBone && /_\d+$/.test(node.name)) {
      node.name = node.name.replace(/_\d+$/, "");
    }
  });
}

async function init() {
  const container = document.getElementById("avatar-container");
  const { model } = await initAvatarScene(container);
  stripBoneNameSuffixes(model);
  signEngine = new SignEngine({ model });
  setSignEngine(signEngine);
}

init().catch((err) => {
  console.error("main.js: avatar scene failed to initialize", err);
});

// Steps 3-6 (Phase 11): capture flow, wired here since main.js owns the
// cross-module orchestration. No code fires on Step 6 itself (the user
// pressing play on an external, uncontrollable source tab) - it is only
// inferred indirectly via streamValidation.js's AnalyserNode detecting
// sustained signal, already handled inside validateStream().
let sessionStarted = false;

function beginCaptureFlow() {
  startCapture(handleStreamReady);
}

// Step 18/Fallback C (Phase 15): sessionId is created exactly once, on the
// very first successful capture, never again on a later reconnect (a
// reconnect deliberately keeps the same sessionId - see sessionManager.js).
// The track.onended listener is (re)attached every time so Fallback C keeps
// working across repeated reconnects, re-running this same validation path
// for whatever new stream reconnect() obtains.
function handleStreamReady(stream) {
  if (!sessionStarted) {
    sessionStarted = true;
    initSession();
  }
  attachStreamEndListener(stream, (newStream) => {
    validateStream(newStream, handleValidStream, beginCaptureFlow);
  });
  validateStream(stream, handleValidStream, beginCaptureFlow);
}

// Step 7/9 frontend halves (Phase 12): once the stream is validated, start
// seek monitoring (Phase 15, needs streamValidation.js's analyser to already
// exist), then open the WebSocket, then start the audio graph so sendAudio()
// always has a live socket to write to.
async function handleValidStream(stream) {
  startSeekMonitoring();
  try {
    await connectWebSocket();
  } catch (err) {
    console.error("main.js: WebSocket connection failed", err);
    return;
  }
  // Sync the currently selected mode in case the user changed it before the
  // WebSocket existed to send it to (see the mode-toggle wiring below).
  sendControlMessage({ type: "set_mode", mode: getSelectedMode() });
  await startAudioGraph(stream);
}

setOnRenderInstruction(enqueue);

document.getElementById("start-capture-btn").addEventListener("click", beginCaptureFlow);

// Step 14's mode toggle (Fallback-free, just Step 14's own render-mode
// input): no phase's file list explicitly assigned wiring this UI element's
// change event to the set_mode control message, even though render_resolver.py's
// mode resolution depends entirely on the backend knowing it - found and
// fixed directly rather than left dangling.
function getSelectedMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

document.getElementById("mode-toggle").addEventListener("change", (event) => {
  if (event.target.name === "mode") {
    sendControlMessage({ type: "set_mode", mode: event.target.value });
  }
});
