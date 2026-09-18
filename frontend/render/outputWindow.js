// Step 17: toggles which renderer's output is visible. Both the avatar
// canvas and the video element exist in the DOM at all times (from Phase
// 10/index.html) - only visibility changes here, never re-initialization.

let avatarContainer = document.getElementById("avatar-container");
let videoElement = document.getElementById("video-renderer");

// Reassignable so pipWindow.js can retarget which pair of elements this
// toggles once the avatar canvas moves into the popup and a fresh video
// element is created there in place of the original (see videoRenderer.js's
// setVideoElement() for why the video element itself is swapped rather
// than moved).
export function setElements(avatarEl, videoEl) {
  avatarContainer = avatarEl;
  videoElement = videoEl;
}

// "unknown" (Fallback A) is displayed through the video element's poster
// image, so it is treated the same as "video" here.
export function showRenderType(renderType) {
  const showAvatar = renderType === "avatar";

  avatarContainer.classList.toggle("render-visible", showAvatar);
  avatarContainer.classList.toggle("render-hidden", !showAvatar);
  videoElement.classList.toggle("render-visible", !showAvatar);
  videoElement.classList.toggle("render-hidden", showAvatar);
}
