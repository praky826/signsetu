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

const visibleVideo = document.getElementById("video-renderer");
let preloadVideo = null;

function getPreloadVideo() {
  if (!preloadVideo) {
    preloadVideo = document.createElement("video");
    preloadVideo.preload = "auto";
    preloadVideo.style.display = "none";
    document.body.appendChild(preloadVideo);
  }
  return preloadVideo;
}

export function preloadNext(assetRef) {
  if (!assetRef) return;
  getPreloadVideo().src = assetRef;
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
  visibleVideo.onended = onComplete;
  visibleVideo.play().catch((err) => {
    console.error("videoRenderer: playback failed", err);
    onComplete();
  });
}
