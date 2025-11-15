import { computeWaveformPeaks, normalizeWaveform } from "../utils/waveformUtils";
import type { WaveformWorkerRequest, WaveformWorkerResponse } from "./waveformWorkerTypes.ts";

interface ComputeOptions {
  samples: number;
  normalize?: boolean;
}

const isWorkerSupported = typeof Worker !== "undefined";

const createCacheKey = (samples: number, normalize: boolean) => `${samples}::${normalize ? 1 : 0}`;

class WaveformWorkerClient {
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (value: ArrayBuffer) => void; reject: (reason?: unknown) => void }>();
  private idCounter = 0;
  private cache = new WeakMap<AudioBuffer, Map<string, Float32Array>>();

  constructor() {
    if (!isWorkerSupported) {
      return;
    }

    try {
      this.worker = new Worker(new URL("./waveformWorker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.addEventListener("message", this.handleWorkerMessage);
      this.worker.addEventListener("error", this.handleWorkerError);
    } catch (error) {
      console.warn("Failed to initialize waveform worker, falling back to main thread", error);
      this.worker = null;
    }
  }

  async computeFromAudioBuffer(audioBuffer: AudioBuffer, options: ComputeOptions): Promise<Float32Array> {
    const normalize = options.normalize ?? true;
    const cacheKey = createCacheKey(options.samples, normalize);

    const cached = this.cache.get(audioBuffer)?.get(cacheKey);
    if (cached) {
      return cached;
    }

    const channelData = new Float32Array(audioBuffer.length);
    audioBuffer.copyFromChannel(channelData, 0);

    const result = await this.compute(channelData, options);

    let bufferCache = this.cache.get(audioBuffer);
    if (!bufferCache) {
      bufferCache = new Map();
      this.cache.set(audioBuffer, bufferCache);
    }
    bufferCache.set(cacheKey, result);

    return result;
  }

  async compute(channelData: Float32Array, { samples, normalize = true }: ComputeOptions): Promise<Float32Array> {
    if (!this.worker) {
      return this.fallback(channelData, samples, normalize);
    }

    const requestId = `${Date.now()}-${this.idCounter++}`;

    const transferable = channelData.slice();
    const transferableBuffer = transferable.buffer;

    const request: WaveformWorkerRequest = {
      id: requestId,
      type: "COMPUTE_WAVEFORM",
      payload: {
        channelData: transferableBuffer,
        samples,
        normalize,
      },
    };

    const responseBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });

      try {
        this.worker!.postMessage(request, [transferableBuffer]);
      } catch (error) {
        this.pending.delete(requestId);
        reject(error);
        return;
      }

      setTimeout(() => {
        if (this.pending.has(requestId)) {
          const timeoutError = new Error("Waveform worker timeout");
          this.pending.get(requestId)?.reject(timeoutError);
          this.pending.delete(requestId);
        }
      }, 5000);
    });

    return new Float32Array(responseBuffer);
  }

  dispose(): void {
    if (this.worker) {
      this.worker.removeEventListener("message", this.handleWorkerMessage);
      this.worker.removeEventListener("error", this.handleWorkerError);
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
  }

  private fallback(channelData: Float32Array, samples: number, normalize: boolean): Float32Array {
    const peaks = computeWaveformPeaks(channelData, samples);
    return normalize ? normalizeWaveform(peaks) : peaks;
  }

  private handleWorkerMessage = (event: MessageEvent<WaveformWorkerResponse>) => {
    const { id, type } = event.data;
    if (!id) {
      return;
    }

    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }

    if (type === "RESULT") {
      pending.resolve(event.data.payload as ArrayBuffer);
    } else if (type === "ERROR") {
      pending.reject(new Error(event.data.error));
    }

    this.pending.delete(id);
  };

  private handleWorkerError = (error: ErrorEvent) => {
    console.error("Waveform worker error", error);
    this.pending.forEach(({ reject }, id) => {
      reject(error);
      this.pending.delete(id);
    });
    this.dispose();
  };
}

let clientInstance: WaveformWorkerClient | null = null;

export const getWaveformWorkerClient = (): WaveformWorkerClient => {
  if (!clientInstance) {
    clientInstance = new WaveformWorkerClient();
  }
  return clientInstance;
};
