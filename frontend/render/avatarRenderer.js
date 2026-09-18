// Step 16B: animates the avatar for a word by dispatching its HamNoSys
// tokens to hamnosysMap.js's HAMNOSYS_ACTIONS engine-method calls (confirmed
// API, Phase 2) against the single SignEngine instance created in Phase 10.
// SignEngine.js has no playSign() and no completion event of any kind
// (confirmed, Phase 2), so completion is signaled after a fixed hold instead
// of a real event, followed by an explicit resetAll() since SignEngine does
// not return to neutral between signs on its own.

import { HAMNOSYS_ACTIONS } from "../vendor/hamnosysMap.js";

// Frontend-only tunable (no frontend config module exists, per
// docs/implementation.md section 3's documented exception): how long an
// avatar sign is held before resetting and advancing the queue, sized to
// SignEngine's rotate() interpolation speed.
const AVATAR_SIGN_HOLD_MS = 700;

let signEngineRef = null;
let pendingResetTimeout = null;

export function setSignEngine(engine) {
  signEngineRef = engine;
}

export function playAvatarSign(instruction, onComplete) {
  if (!signEngineRef) {
    console.error("avatarRenderer: SignEngine not set yet");
    onComplete();
    return;
  }

  const tokens = instruction.assetRef.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const action = HAMNOSYS_ACTIONS[token];
    if (action) {
      action(signEngineRef);
    } else {
      console.warn(`avatarRenderer: unrecognized HamNoSys token "${token}"`);
    }
  }

  pendingResetTimeout = setTimeout(() => {
    pendingResetTimeout = null;
    signEngineRef.resetAll();
    onComplete();
  }, AVATAR_SIGN_HOLD_MS);
}

// Immediately halts whatever sign is currently playing, without waiting for
// its own hold timeout to fire (which would otherwise still call the old
// onComplete against an already-cleared queue) - used when a confirmed seek
// invalidates the whole render queue (renderQueue.js's clearQueue()).
export function stopAvatarSign() {
  if (pendingResetTimeout) {
    clearTimeout(pendingResetTimeout);
    pendingResetTimeout = null;
  }
  if (signEngineRef) signEngineRef.resetAll();
}
