// Step 17's own documented optional path (SignSetu.docx: "optionally
// documentPictureInPicture if output must float above other tabs/apps"):
// floats the sign output in a real always-on-top OS window, so it can sit
// over the tab that is actually playing the source audio instead of only
// being visible inside this app's own tab.
//
// The avatar canvas (#avatar-container) is moved (not cloned) into the
// popup's document - a WebGL canvas has no decode pipeline, so reparenting
// it is instant and lossless. The video element is handled differently: a
// real capture session found that moving the actively-playing <video> into
// a different document interrupted its decode pipeline for far longer than
// the couple of seconds first assumed, and the backend kept validating and
// queuing new words the entire time, so the backlog kept growing throughout
// the stall. Instead, a brand-new <video> is created directly inside the
// popup's own document (born there, never reparented while playing) and
// videoRenderer.js/outputWindow.js are retargeted to it via their own
// setVideoElement()/setElements() - the original video element is simply
// left idle in the main document until the popup closes.

import { setVideoElement } from "./videoRenderer.js";
import { setElements } from "./outputWindow.js";

const outputWindowEl = document.getElementById("output-window");
const avatarContainer = document.getElementById("avatar-container");
const mainVideoElement = document.getElementById("video-renderer");
const avatarOriginalParent = avatarContainer.parentElement;
const avatarOriginalNextSibling = avatarContainer.nextSibling;

let pipWindow = null;
let pipVideoElement = null;

export function isPipSupported() {
  return "documentPictureInPicture" in window;
}

function copyStylesInto(pipDocument) {
  for (const styleSheet of document.styleSheets) {
    if (styleSheet.href) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = styleSheet.href;
      pipDocument.head.appendChild(link);
    }
  }
  // Inside the popup, these elements fill the whole window rather than
  // sitting in a fixed-position box floating over other page content -
  // undo style.css's main-page positioning/sizing so they fill it instead.
  const override = document.createElement("style");
  override.textContent = `
    html, body { width: 100%; height: 100%; margin: 0; background: #000; }
  `;
  pipDocument.head.appendChild(override);
}

function returnToMainDocument() {
  if (avatarOriginalNextSibling) {
    avatarOriginalParent.insertBefore(avatarContainer, avatarOriginalNextSibling);
  } else {
    avatarOriginalParent.appendChild(avatarContainer);
  }
  setVideoElement(mainVideoElement);
  setElements(avatarContainer, mainVideoElement);
  outputWindowEl.classList.remove("hidden");
  pipVideoElement = null;
  pipWindow = null;
}

export async function openPipWindow() {
  if (!isPipSupported()) {
    console.error("pipWindow: documentPictureInPicture is not supported in this browser");
    return;
  }
  if (pipWindow) return;

  try {
    pipWindow = await window.documentPictureInPicture.requestWindow({ width: 320, height: 220 });
  } catch (err) {
    console.error("pipWindow: failed to open floating window", err);
    return;
  }

  copyStylesInto(pipWindow.document);

  // Carry over whichever output is currently showing so the popup doesn't
  // open blank until the next word is dispatched.
  const showAvatar = avatarContainer.classList.contains("render-visible");

  pipVideoElement = pipWindow.document.createElement("video");
  pipVideoElement.id = "video-renderer";
  pipVideoElement.playsInline = true;
  // The popup is a separate top-level browsing context with no direct user
  // gesture of its own, so Chrome's autoplay policy silently blocks
  // programmatic play() here otherwise - each clip's play() call was
  // rejected and immediately falling through to the next word, which
  // looked like a slideshow of static first frames (found via a real
  // capture session). Muted playback is always allowed regardless of
  // gesture, and these clips' audio isn't meaningful to the sign anyway.
  pipVideoElement.muted = true;
  pipVideoElement.className = showAvatar ? "render-hidden" : "render-visible";
  pipWindow.document.body.append(pipVideoElement);

  pipWindow.document.body.append(avatarContainer);
  outputWindowEl.classList.add("hidden");

  setVideoElement(pipVideoElement);
  setElements(avatarContainer, pipVideoElement);

  // avatar.js's own resize handler (a reused, unmodified file) listens on
  // the main window, not this new one - re-dispatch its event here so the
  // Three.js renderer picks up the popup's actual size instead of staying
  // frozen at whatever size the container had at move time.
  pipWindow.addEventListener("resize", () => {
    window.dispatchEvent(new Event("resize"));
  });

  pipWindow.addEventListener("pagehide", returnToMainDocument, { once: true });
}
