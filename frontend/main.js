// Application entry point and orchestrator (Step 2 skeleton, Phase 10).
// Owns sessionId (later phases) and wires all frontend modules together.
//
// avatar.js's initAvatarScene() builds and owns the entire Three.js scene,
// camera, and renderer itself - main.js does not construct a separate one
// (confirmed API, Phase 2). SignEngine is constructed exactly once, here,
// immediately after the avatar model resolves, since it has no per-word
// construction step and Phase 13 will call methods on this same instance.
// Constructing it automatically triggers SignEngine's own built-in self-test
// animation (~1.5s after construction, resetting ~3s later) - expected
// reused-file behavior, not an error to catch.

import { initAvatarScene } from "./vendor/avatar.js";
import { SignEngine } from "./vendor/SignEngine.js";
import { startCapture } from "./capture/tabCapture.js";
import { validateStream } from "./capture/streamValidation.js";
import { startAudioGraph } from "./audio/audioGraph.js";
import { connect as connectWebSocket, setOnRenderInstruction } from "./network/wsClient.js";

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
}

init().catch((err) => {
  console.error("main.js: avatar scene failed to initialize", err);
});

// Steps 3-6 (Phase 11): capture flow, wired here since main.js owns the
// cross-module orchestration. No code fires on Step 6 itself (the user
// pressing play on an external, uncontrollable source tab) - it is only
// inferred indirectly via streamValidation.js's AnalyserNode detecting
// sustained signal, already handled inside validateStream().
function beginCaptureFlow() {
  startCapture(handleStreamReady);
}

function handleStreamReady(stream) {
  validateStream(stream, handleValidStream, beginCaptureFlow);
}

// Step 7/9 frontend halves (Phase 12): once the stream is validated, open the
// WebSocket first, then start the audio graph so sendAudio() always has a
// live socket to write to.
async function handleValidStream(stream) {
  try {
    await connectWebSocket();
  } catch (err) {
    console.error("main.js: WebSocket connection failed", err);
    return;
  }
  await startAudioGraph(stream);
}

setOnRenderInstruction((instruction) => {
  // Phase 13 attaches renderQueue.js here.
  console.log("main.js: received render instruction, ready for render queue (Phase 13)", instruction);
});

document.getElementById("start-capture-btn").addEventListener("click", beginCaptureFlow);

// Hooks for later phases to attach to, left unimplemented on purpose:
// - render queue / renderers (Phase 13)
// - status indicator (Phase 14)
// - session manager (Phase 15)
