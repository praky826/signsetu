// Step 16B: animates the avatar for a word by dispatching its HamNoSys
// tokens to hamnosysMap.js's HAMNOSYS_ACTIONS engine-method calls (confirmed
// API, Phase 2) against the single SignEngine instance created in Phase 10.
// SignEngine.js has no playSign() and no completion event of any kind
// (confirmed, Phase 2), so completion is signaled after a fixed hold instead
// of a real event, followed by an explicit resetAll() since SignEngine does
// not return to neutral between signs on its own.
//
// Two supplementary animations added to the generic (non-overridden) path
// (found via a real capture session showing the avatar barely moving -
// explained in full to you before implementing): SignEngine.js's
// armTo()/palm()/hand() are hardcoded to the right side only, and
// hand("flat")'s curl amount is exactly zero, making it a mathematical
// no-op against the model's own rest pose. Neither is edited here
// (SignEngine.js/hamnosysMap.js stay reused-unmodified); instead this file
// calls SignEngine's own public, low-level rotate() method directly,
// alongside the existing mapped action, to mirror arm/wrist onto the left
// side and give "flat" a real, visible target.
//
// signOverrides.js additionally provides a curated per-word override table
// (a 50-word pilot batch, chosen by watching each word's real CISLR
// reference clip) - checked first, before falling back to the generic
// hamnosys-token path above for every other word. Explicitly an
// approximation, not claimed to be accurate ISL - isl_dictionary.json
// itself is untouched.

import { HAMNOSYS_ACTIONS } from "../vendor/hamnosysMap.js";
import { SIGN_OVERRIDES } from "./signOverrides.js";

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
function mirrorArmTo(engine, location) {
  const target = ARM_LOCATIONS[location];
  if (!target) return;
  const [x, y, z] = target.arm;
  engine.rotate("LeftArm", x, y, -z, 0.2);
  const [fx, fy, fz] = target.foreArm;
  engine.rotate("LeftForeArm", fx, fy, fz, 0.2);
}

// Read directly from SignEngine.js's own palm() switch statement. Mirroring
// mirrorArmTo()'s convention: up/down (x) is a global direction, same sign
// for either hand; left/right (z) flips sign for the opposite wrist.
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

function mirrorPalm(engine, orientation) {
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

// Reimplements SignEngine.js's own hand()/curl() logic (read from that file,
// not modified there), parameterized by side so it can drive either hand -
// hand() itself is hardcoded to "Right" only. Used for both the generic
// "hamflathand" no-op fix and signOverrides.js's curated hand shapes.
function curlHandSide(engine, side, shape) {
  const curl = (finger, amount) => {
    const curlAngle = amount * (finger === "Thumb" ? 1.0 : 1.8);
    [1, 2, 3].forEach((joint) => {
      engine.rotate(`${side}Hand${finger}${joint}`, -curlAngle, 0, 0, 0.2);
    });
  };
  switch (shape) {
    case "flat":
      FINGERS.forEach((f) => curl(f, FLAT_EXTEND_AMOUNT));
      break;
    case "fist":
      FINGERS.forEach((f) => curl(f, 1));
      break;
    case "index":
      curl("Index", 0);
      ["Middle", "Ring", "Pinky", "Thumb"].forEach((f) => curl(f, 1));
      break;
    case "vee":
      curl("Index", 0);
      curl("Middle", 0);
      ["Ring", "Pinky", "Thumb"].forEach((f) => curl(f, 1));
      break;
    case "pinch":
      curl("Index", 0.5);
      curl("Thumb", 0.5);
      ["Middle", "Ring", "Pinky"].forEach((f) => curl(f, 0.2));
      break;
    case "cee":
      ["Index", "Middle", "Ring", "Pinky"].forEach((f) => curl(f, 0.6));
      curl("Thumb", 0.4);
      break;
    case "thumbup":
      curl("Thumb", 0);
      ["Index", "Middle", "Ring", "Pinky"].forEach((f) => curl(f, 1));
      break;
  }
}

let signEngineRef = null;
let pendingResetTimeout = null;

export function setSignEngine(engine) {
  signEngineRef = engine;
}

function playOverride(engine, override) {
  engine.armTo(override.location);
  curlHandSide(engine, "Right", override.hand);
  if (override.palm) {
    engine.palm(override.palm);
  }
  if (override.bimanual) {
    mirrorArmTo(engine, override.location);
    curlHandSide(engine, "Left", override.hand);
    if (override.palm) {
      mirrorPalm(engine, override.palm);
    }
  }
}

function playGeneric(engine, tokens) {
  for (const token of tokens) {
    const action = HAMNOSYS_ACTIONS[token];
    if (!action) {
      console.warn(`avatarRenderer: unrecognized HamNoSys token "${token}"`);
      continue;
    }
    action(engine);
    if (token === "hamflathand") {
      curlHandSide(engine, "Right", "flat");
    }
    const location = TOKEN_TO_LOCATION[token];
    if (location) {
      mirrorArmTo(engine, location);
    }
    const palmOrientation = TOKEN_TO_PALM[token];
    if (palmOrientation) {
      mirrorPalm(engine, palmOrientation);
    }
  }
}

export function playAvatarSign(instruction, onComplete) {
  if (!signEngineRef) {
    console.error("avatarRenderer: SignEngine not set yet");
    onComplete();
    return;
  }

  const override = SIGN_OVERRIDES[instruction.word?.toUpperCase()];
  if (override) {
    playOverride(signEngineRef, override);
  } else {
    const tokens = instruction.assetRef.split(/\s+/).filter(Boolean);
    playGeneric(signEngineRef, tokens);
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
