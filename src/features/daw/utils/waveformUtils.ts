export const computeWaveformPeaks = (
  channelData: Float32Array,
  samples: number = 200,
): Float32Array => {
  if (samples <= 0) {
    return new Float32Array(0);
  }

  const sourceLength = channelData.length;
  if (sourceLength === 0) {
    return new Float32Array(samples);
  }

  const peaks = new Float32Array(samples);
  const blockSize = Math.max(1, Math.floor(sourceLength / samples));

  for (let i = 0; i < samples; i += 1) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, sourceLength);
    let max = 0;

    for (let j = start; j < end; j += 1) {
      const magnitude = Math.abs(channelData[j]);
      if (magnitude > max) {
        max = magnitude;
      }
    }

    peaks[i] = max;
  }

  return peaks;
};

export const normalizeWaveform = (data: Float32Array): Float32Array => {
  if (data.length === 0) {
    return new Float32Array(0);
  }

  let max = 0.001;
  for (let i = 0; i < data.length; i += 1) {
    const value = Math.abs(data[i]);
    if (value > max) {
      max = value;
    }
  }

  if (max <= 0) {
    return new Float32Array(data.length);
  }

  const normalized = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    normalized[i] = data[i] / max;
  }

  return normalized;
};

export const generateWaveformData = (
  audioBuffer: AudioBuffer,
  samples: number = 200,
): Float32Array => {
  const channelData = new Float32Array(audioBuffer.length);
  audioBuffer.copyFromChannel(channelData, 0);
  return computeWaveformPeaks(channelData, samples);
};

export const generateNormalizedWaveformData = (
  audioBuffer: AudioBuffer,
  samples: number = 200,
): Float32Array => normalizeWaveform(generateWaveformData(audioBuffer, samples));

