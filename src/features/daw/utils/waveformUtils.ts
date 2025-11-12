export const generateWaveformData = (
  audioBuffer: AudioBuffer,
  samples: number = 200
): number[] => {
  const rawData = audioBuffer.getChannelData(0); // Use first channel
  const blockSize = Math.floor(rawData.length / samples);
  const waveformData: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = blockSize * i;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(rawData[start + j] || 0);
    }
    waveformData.push(sum / blockSize);
  }

  return waveformData;
};

export const normalizeWaveform = (data: number[]): number[] => {
  const max = Math.max(...data, 0.001); // Avoid division by zero
  return data.map((value) => value / max);
};

