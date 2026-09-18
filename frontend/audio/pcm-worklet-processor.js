// AudioWorkletProcessor (Step 7): runs on the audio rendering thread, exposing
// raw float32 PCM frames (typically 128 samples per callback) as they arrive.

class PCMWorkletProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      // Copy the block: the underlying buffer is reused by the audio thread
      // on the next callback, so the reference itself is not safe to keep.
      this.port.postMessage(input[0].slice());
    }
    return true;
  }
}

registerProcessor("pcm-worklet-processor", PCMWorkletProcessor);
