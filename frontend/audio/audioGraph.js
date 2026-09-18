// Step 7 (frontend half): persistent low-level tap into decoded audio samples,
// accumulated and handed off continuously to wsClient.js. Chunk-cutting and
// VAD live entirely backend-side (chunker.py, Phase 4) - this file's only
// job is capture and continuous transport, per Step 9's frontend half.

import { sendAudio } from "../network/wsClient.js";

const SAMPLE_RATE = 16000; // must match backend/config.py's SAMPLE_RATE
// Frontend-only tunable (no frontend config module exists, per the
// AVATAR_SIGN_HOLD_MS precedent, docs/implementation.md section 3):
// how often the accumulated PCM buffer is flushed to the WebSocket.
const SEND_INTERVAL_MS = 100;

let audioContext = null;
let flushTimer = null;
let accumulated = [];

function flush() {
  if (accumulated.length === 0) return;
  const totalLength = accumulated.reduce((sum, block) => sum + block.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const block of accumulated) {
    merged.set(block, offset);
    offset += block.length;
  }
  accumulated = [];
  sendAudio(merged);
}

// Kept alive for the life of the capture session; tear down only on stream
// loss (Fallback C, Phase 15) or explicit stop via stopAudioGraph().
export async function startAudioGraph(stream) {
  // Reconnect (Fallback C) re-runs the whole validate -> connect -> audio
  // graph chain on a new stream - tear down the previous graph first so
  // reconnecting doesn't leak one live AudioContext/worklet per reconnect
  // and doesn't keep flushing audio from the old, now-invalid track
  // (Phase 16 end-to-end trace).
  stopAudioGraph();
  audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
  if (audioContext.sampleRate !== SAMPLE_RATE) {
    console.warn(
      `audioGraph: AudioContext sample rate is ${audioContext.sampleRate}, not ${SAMPLE_RATE} - ` +
      "Chrome did not honor the requested rate for this track. Backend chunker.py must " +
      "resample instead (the documented Step 7 fallback)."
    );
  }

  await audioContext.audioWorklet.addModule("./audio/pcm-worklet-processor.js");
  const source = audioContext.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(audioContext, "pcm-worklet-processor");

  workletNode.port.onmessage = (event) => {
    accumulated.push(event.data);
  };

  // Deliberately not connected to audioContext.destination - this is a tap
  // for processing, not local playback (the source tab already plays itself).
  source.connect(workletNode);

  flushTimer = setInterval(flush, SEND_INTERVAL_MS);
}

export function stopAudioGraph() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
  accumulated = [];
  if (audioContext) audioContext.close();
  audioContext = null;
}
