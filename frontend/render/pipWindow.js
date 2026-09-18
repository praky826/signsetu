// Step 17's own documented optional path (SignSetu.docx: "optionally
// documentPictureInPicture if output must float above other tabs/apps"):
// moves the existing, always-live #output-window node into a real
// always-on-top OS window, so the sign output can sit over the tab that is
// actually playing the source audio instead of only being visible inside
// this app's own tab.
//
// The avatar canvas and video element are re-parented (moved, not cloned)
// into the popup's document - moving a live canvas/video node between
// documents in the same page preserves its WebGL context/playback state,
// so nothing needs to be re-initialized on open or close.

const outputWindowEl = document.getElementById("output-window");
const originalParent = outputWindowEl.parentElement;
const originalNextSibling = outputWindowEl.nextSibling;

let pipWindow = null;

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
  // Inside the popup, the output element IS the whole window rather than a
  // fixed-position box floating over other page content - undo style.css's
  // main-page positioning/sizing so it fills the popup instead.
  const override = document.createElement("style");
  override.textContent = `
    body { margin: 0; background: #000; }
    #output-window { position: static; width: 100%; height: 100%; }
  `;
  pipDocument.head.appendChild(override);
}

function returnToMainDocument() {
  if (originalNextSibling) {
    originalParent.insertBefore(outputWindowEl, originalNextSibling);
  } else {
    originalParent.appendChild(outputWindowEl);
  }
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
  pipWindow.document.body.append(outputWindowEl);

  // avatar.js's own resize handler (a reused, unmodified file) listens on
  // the main window, not this new one - re-dispatch its event here so the
  // Three.js renderer picks up the popup's actual size instead of staying
  // frozen at whatever size the container had at move time.
  pipWindow.addEventListener("resize", () => {
    window.dispatchEvent(new Event("resize"));
  });

  pipWindow.addEventListener("pagehide", returnToMainDocument, { once: true });
}
