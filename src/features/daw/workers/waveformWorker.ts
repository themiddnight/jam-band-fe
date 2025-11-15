import type { WaveformWorkerRequest, WaveformWorkerResponse } from "./waveformWorkerTypes.ts";
import { computeWaveformPeaks, normalizeWaveform } from "../utils/waveformUtils";

const postMessageSafely = (message: WaveformWorkerResponse, transfer?: Transferable[]) => {
  if (transfer) {
    self.postMessage(message, { transfer });
  } else {
    self.postMessage(message);
  }
};

self.onmessage = (event: MessageEvent<WaveformWorkerRequest>) => {
  const { id, type, payload } = event.data;

  if (type !== "COMPUTE_WAVEFORM") {
    postMessageSafely({ id, type: "ERROR", error: `Unknown message type: ${type}` });
    return;
  }

  try {
    const { channelData, samples, normalize } = payload;
    const floatData = new Float32Array(channelData);
    const peaks = computeWaveformPeaks(floatData, samples);
    const result = normalize ? normalizeWaveform(peaks) : peaks;

    postMessageSafely(
      { id, type: "RESULT", payload: result.buffer },
      [result.buffer]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    postMessageSafely({ id, type: "ERROR", error: message });
  }
};
