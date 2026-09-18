// Step 15: session-filtered render queue. Guarantees stale (pre-seek)
// instructions never reach the screen, and that avatar/video renderers
// advance strictly sequentially, never overlapping.
//
// Session comparison uses String() on both sides: the backend sends
// sessionId as a string (Python str()), while sessionManager.js's
// getSessionId() returns a number - comparing them directly with !== would
// always mismatch due to the type difference alone.

import { getSessionId } from "../session/sessionManager.js";
import { playVideo, preloadNext } from "./videoRenderer.js";
import { playAvatarSign } from "./avatarRenderer.js";
import { showRenderType } from "./outputWindow.js";

const queue = [];
let playing = false;

export function enqueue(instruction) {
  if (String(instruction.sessionId) !== String(getSessionId())) {
    console.debug("renderQueue: dropped stale instruction", instruction);
    return;
  }
  queue.push(instruction);
  if (!playing) {
    dispatchNext();
  }
}

function dispatchNext() {
  if (queue.length === 0) {
    playing = false;
    return;
  }
  playing = true;

  const instruction = queue.shift();
  showRenderType(instruction.renderType);

  const next = queue[0];
  if (next && next.renderType !== "avatar") {
    preloadNext(next.assetRef);
  }

  if (instruction.renderType === "avatar") {
    playAvatarSign(instruction, dispatchNext);
  } else {
    playVideo(instruction, dispatchNext);
  }
}
