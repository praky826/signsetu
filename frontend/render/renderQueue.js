// Step 15: session-filtered render queue. Guarantees stale (pre-seek)
// instructions never reach the screen, and that avatar/video renderers
// advance strictly sequentially, never overlapping.
//
// Session comparison uses String() on both sides: the backend sends
// sessionId as a string (Python str()), while sessionManager.js's
// getSessionId() returns a number - comparing them directly with !== would
// always mismatch due to the type difference alone.

import { getSessionId } from "../session/sessionManager.js";
import { playVideo, preloadNext, stopVideo } from "./videoRenderer.js";
import { playAvatarSign, stopAvatarSign } from "./avatarRenderer.js";
import { showRenderType } from "./outputWindow.js";

// Frontend-only tunable (no frontend config module exists, per
// docs/implementation.md section 3's documented exception): if production
// (backend validating several words per gloss cycle) outpaces consumption
// (each word taking a few seconds to play), the queue would otherwise grow
// without bound and playback would drift further and further behind the
// live video for the rest of the session (found via a real capture
// session). Capping it and dropping the oldest pending word once full
// keeps playback roughly in sync, at the cost of skipping some words during
// dense narration - the same trade-off already made for the backend's own
// MAX_STABLE_WORDS backlog cap.
const MAX_QUEUE_LENGTH = 4;

const queue = [];
let playing = false;

export function enqueue(instruction) {
  if (String(instruction.sessionId) !== String(getSessionId())) {
    console.debug("renderQueue: dropped stale instruction", instruction);
    return;
  }
  queue.push(instruction);
  if (queue.length > MAX_QUEUE_LENGTH) {
    const dropped = queue.shift();
    console.warn("renderQueue: dropped oldest queued word to stay in sync", dropped);
  }
  if (!playing) {
    dispatchNext();
  }
}

// Every consumer must check sessionId before acting, per the frozen
// convention - enqueue() only guarded the moment an instruction arrived,
// but an instruction already sitting in the queue was never re-checked
// before actually being dispatched, so a backlog built up before a seek
// kept playing to completion regardless (found via a real capture session:
// signs kept appearing well after the source video was paused/seeked).
// Called by sessionManager.js on every confirmed seek to purge that
// backlog immediately instead of waiting for it to drain on its own.
export function clearQueue() {
  queue.length = 0;
  playing = false;
  stopVideo();
  stopAvatarSign();
}

function dispatchNext() {
  if (queue.length === 0) {
    playing = false;
    return;
  }
  playing = true;

  const instruction = queue.shift();
  if (String(instruction.sessionId) !== String(getSessionId())) {
    console.debug("renderQueue: dropped stale instruction at dispatch time", instruction);
    dispatchNext();
    return;
  }
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
