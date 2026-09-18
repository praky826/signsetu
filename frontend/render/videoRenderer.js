// Step 16A: plays the resolved CISLR clip for a word, with the next clip
// preloaded on a hidden second element to avoid a visible load-stutter.
// Fallback A's "unknown" placeholder is a static image (assets/placeholder/
// unknown_word.png), not a video, so it is shown via the <video> element's
// poster attribute (no playback) rather than trying to "play" an image.

// Frontend-only tunable (no frontend config module exists, per the
// AVATAR_SIGN_HOLD_MS precedent, docs/implementation.md section 3): how long
// the unknown-word placeholder is held instead of relying on a video's
// natural end event, per Step 16A's own "~0.5s" wording.
const UNKNOWN_WORD_HOLD_MS = 500;
// Sign clips are short, deliberate demonstrations rather than natural
// narration - played back at their recorded speed they add noticeably to
// the already multi-second Whisper+Ollama round trip, worsening the
// backlog on top of it (found via a real capture session). 2x keeps the
// sign clearly readable while roughly halving each word's contribution to
// that backlog.
const VIDEO_PLAYBACK_RATE = 4.0;

// Reassignable rather than a fixed const: pipWindow.js rebinds this to a
// freshly-created <video> living directly in the popup's own document when
// floating, and back to the original element on close - swapping which
// element is targeted, rather than moving the actual playing element
// between documents, which was found (via a real capture session) to
// interrupt its decode pipeline for far longer than expected and let the
// backlog grow throughout the whole stall.
let visibleVideo = document.getElementById("video-renderer");
let preloadVideo = null;

export function setVideoElement(el) {
  visibleVideo = el;
  preloadVideo = null; // next preload is (re)created in the new element's document
}

function getPreloadVideo() {
  if (!preloadVideo) {
    const doc = visibleVideo.ownerDocument;
    preloadVideo = doc.createElement("video");
    preloadVideo.preload = "auto";
    preloadVideo.style.display = "none";
    doc.body.appendChild(preloadVideo);
  }
  return preloadVideo;
}

export function preloadNext(assetRef) {
  if (!assetRef) return;
  getPreloadVideo().src = assetRef;
}

// Immediately halts whatever is currently showing, without waiting for its
// natural end/timeout - used when a confirmed seek invalidates the whole
// render queue (renderQueue.js's clearQueue()) so stale playback doesn't
// keep running after the session it belonged to is gone.
export function stopVideo() {
  visibleVideo.onended = null;
  visibleVideo.pause();
}

export function playVideo(instruction, onComplete) {
  if (instruction.renderType === "unknown") {
    visibleVideo.onended = null;
    visibleVideo.removeAttribute("src");
    visibleVideo.load();
    visibleVideo.poster = instruction.assetRef;
    setTimeout(onComplete, UNKNOWN_WORD_HOLD_MS);
    return;
  }

  visibleVideo.poster = "";
  visibleVideo.src = instruction.assetRef;
  visibleVideo.playbackRate = VIDEO_PLAYBACK_RATE;
  visibleVideo.onended = onComplete;
  visibleVideo.play().catch((err) => {
    console.error("videoRenderer: playback failed", err);
    onComplete();
  });
}
