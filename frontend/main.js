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

// Hooks for later phases to attach to, left unimplemented on purpose:
// - capture button handler (Phase 11)
// - WebSocket client (Phase 12)
// - render queue / renderers (Phase 13)
// - status indicator (Phase 14)
// - session manager (Phase 15)
