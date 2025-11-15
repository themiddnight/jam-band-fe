export interface WaveformWorkerRequest {
  id: string;
  type: "COMPUTE_WAVEFORM";
  payload: {
    channelData: ArrayBufferLike;
    samples: number;
    normalize: boolean;
  };
}

interface WaveformResultMessage {
  id: string;
  type: "RESULT";
  payload: ArrayBufferLike;
}

interface WaveformErrorMessage {
  id: string;
  type: "ERROR";
  error: string;
}

export type WaveformWorkerResponse = WaveformResultMessage | WaveformErrorMessage;

export type WaveformWorkerMessage = WaveformWorkerRequest | WaveformWorkerResponse;
