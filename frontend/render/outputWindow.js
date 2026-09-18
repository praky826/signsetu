// Step 17: toggles which renderer's output is visible. Both the avatar
// canvas and the video element exist in the DOM at all times (from Phase
// 10/index.html) - only visibility changes here, never re-initialization.

const avatarContainer = document.getElementById("avatar-container");
const videoElement = document.getElementById("video-renderer");

// "unknown" (Fallback A) is displayed through the video element's poster
// image, so it is treated the same as "video" here.
export function showRenderType(renderType) {
  const showAvatar = renderType === "avatar";

  avatarContainer.classList.toggle("render-visible", showAvatar);
  avatarContainer.classList.toggle("render-hidden", !showAvatar);
  videoElement.classList.toggle("render-visible", !showAvatar);
  videoElement.classList.toggle("render-hidden", showAvatar);
}
