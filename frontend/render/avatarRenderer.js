// Step 16B: animates the avatar for a word by dispatching its HamNoSys
// tokens to hamnosysMap.js's HAMNOSYS_ACTIONS engine-method calls (confirmed
// API, Phase 2) against the single SignEngine instance created in Phase 10.
// SignEngine.js has no playSign() and no completion event of any kind
// (confirmed, Phase 2), so completion is signaled after a fixed hold instead
// of a real event, followed by an explicit resetAll() since SignEngine does
// not return to neutral between signs on its own.
//
// Two supplementary animations added here (found via a real capture
// session showing the avatar barely moving - explained in full to you
// before implementing): SignEngine.js's armTo()/palm()/hand() are hardcoded
// to the right side only, and hand("flat")'s curl amount is exactly zero,
// making it a mathematical no-op against the model's own rest pose - it
// rotates every finger to precisely where it already is. Neither is edited
// here (SignEngine.js/hamnosysMap.js stay reused-unmodified); instead this
// file calls SignEngine's own public, low-level rotate() method directly,
// alongside the existing mapped action, to mirror arm position onto the
// left side and give the "flat" hand shape a real, visible target.

import { HAMNOSYS_ACTIONS } from "../vendor/hamnosysMap.js";

// Frontend-only tunable (no frontend config module exists, per
// docs/implementation.md section 3's documented exception): how long an
// avatar sign is held before resetting and advancing the queue, sized to
// SignEngine's rotate() interpolation speed.
const AVATAR_SIGN_HOLD_MS = 700;

// Read directly from SignEngine.js's own armTo() switch statement (not
// modified there) so the mirrored left arm matches the real right-arm
// target for the same location.
const ARM_LOCATIONS = {
  chest: { arm: [-0.6, 0, 0.8], foreArm: [0, -2.0, 0] },
  chin: { arm: [-0.9, 0, 0.4], foreArm: [0, -2.3, 0] },
  head: { arm: [-1.1, 0, 0.1], foreArm: [0, -2.5, 0] },
  stomach: { arm: [-0.3, 0, 1.3], foreArm: [0, -1.3, 0] },
  forward: { arm: [-1.4, 0, 0.6], foreArm: [0, -0.3, 0] },
};

// hamnosysMap.js's own token -> location mapping (see that file), duplicated
// only to know which location a given token implies, so the mirrored
// left-arm rotation can be applied alongside the existing right-arm-only
// action rather than by editing the reused mapping itself.
const TOKEN_TO_LOCATION = {
  hamchest: "chest",
  hamchin: "chin",
  hamhead: "head",
  hamstomach: "stomach",
  hammoveforward: "forward",
  hammoveback: "chest",
  hammoveup: "chin",
  hammovedown: "stomach",
};

// Best-effort standard mirroring convention for a symmetric humanoid rig:
// forward/back bend (x) keeps its sign for both arms, side-to-side spread
// (z) flips sign for the opposite arm. Not visually verified against this
// specific model without a live browser - may need tuning after testing.
function mirrorLeftArm(engine, location) {
  const target = ARM_LOCATIONS[location];
  if (!target) return;
  const [x, y, z] = target.arm;
  engine.rotate("LeftArm", x, y, -z, 0.2);
  const [fx, fy, fz] = target.foreArm;
  engine.rotate("LeftForeArm", fx, fy, fz, 0.2);
}

// Read directly from SignEngine.js's own palm() switch statement. Mirroring
// mirrorLeftArm()'s convention: up/down (x) is a global direction, same
// sign for either hand; left/right (z) flips sign for the opposite wrist.
// This was missed in the first pass - mirrorLeftArm() only ever reaches
// LeftArm/LeftForeArm (shoulder/elbow), never LeftHand (wrist), which is
// why the left wrist itself still wasn't moving.
const PALM_ROTATIONS = {
  down: [1.6, 0, 0],
  up: [-1.6, 0, 0],
  left: [0, 0, -1.6],
  right: [0, 0, 1.6],
};

const TOKEN_TO_PALM = {
  hampalmd: "down",
  hampalmu: "up",
  hampalml: "left",
  hampalmr: "right",
  hampalmf: "forward",
};

function mirrorLeftPalm(engine, orientation) {
  if (orientation === "forward") {
    engine.reset("LeftHand");
    return;
  }
  const rotation = PALM_ROTATIONS[orientation];
  if (!rotation) return;
  const [x, y, z] = rotation;
  engine.rotate("LeftHand", x, y, -z, 0.2);
}

const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
// Negative = extend beyond rest pose. SignEngine.js's own hand("flat") curls
// every finger by exactly 0, which is indistinguishable from doing nothing;
// this gives "flat" (the dictionary's single most common hand shape) an
// actual, visible target instead.
const FLAT_EXTEND_AMOUNT = -0.4;

function openRightHandFlat(engine) {
  for (const finger of FINGERS) {
    const multiplier = finger === "Thumb" ? 1.0 : 1.8;
    const curlAngle = FLAT_EXTEND_AMOUNT * multiplier;
    for (const joint of [1, 2, 3]) {
      engine.rotate(`RightHand${finger}${joint}`, -curlAngle, 0, 0, 0.2);
    }
  }
}

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
    if (!action) {
      console.warn(`avatarRenderer: unrecognized HamNoSys token "${token}"`);
      continue;
    }
    action(signEngineRef);
    if (token === "hamflathand") {
      openRightHandFlat(signEngineRef);
    }
    const location = TOKEN_TO_LOCATION[token];
    if (location) {
      mirrorLeftArm(signEngineRef, location);
    }
    const palmOrientation = TOKEN_TO_PALM[token];
    if (palmOrientation) {
      mirrorLeftPalm(signEngineRef, palmOrientation);
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
