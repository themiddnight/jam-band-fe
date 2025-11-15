import { useEffect, useMemo, useState } from "react";
import { getWaveformWorkerClient } from "../workers/waveformWorkerClient";

interface UseWaveformDataOptions {
  normalize?: boolean;
}

interface UseWaveformDataResult {
  data: Float32Array | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Computes waveform peak data for an AudioBuffer using a Web Worker when available.
 * Falls back to main-thread computation if workers are unsupported or fail.
 */
export const useWaveformData = (
  audioBuffer: AudioBuffer | null | undefined,
  samples: number,
  options: UseWaveformDataOptions = {},
): UseWaveformDataResult => {
  const normalize = options.normalize ?? false;
  const [data, setData] = useState<Float32Array | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const safeSamples = useMemo(() => (Number.isFinite(samples) && samples > 0 ? Math.floor(samples) : 0), [samples]);

  useEffect(() => {
    let isCancelled = false;

    if (!audioBuffer || safeSamples <= 0) {
      setData(null);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    const client = getWaveformWorkerClient();

    client
      .computeFromAudioBuffer(audioBuffer, { samples: safeSamples, normalize })
      .then((result) => {
        if (isCancelled) return;
        setData(result);
        setError(null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        const normalizedError = err instanceof Error ? err : new Error(String(err));
        setError(normalizedError);
        setData(null);
        setIsLoading(false);
        console.error("Failed to compute waveform data", normalizedError);
      });

    return () => {
      isCancelled = true;
    };
  }, [audioBuffer, safeSamples, normalize]);

  return { data, isLoading, error };
};
