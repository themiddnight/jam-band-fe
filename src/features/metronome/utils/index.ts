// Metronome Utilities
import { METRONOME_CONFIG } from "../constants";

// BPM calculation from tap intervals
export class TapTempoCalculator {
  private tapTimes: number[] = [];
  private readonly maxTaps = 8;

  tap(): number | null {
    const now = Date.now();
    this.tapTimes.push(now);

    // Keep only recent taps
    if (this.tapTimes.length > this.maxTaps) {
      this.tapTimes.shift();
    }

    // Need at least 2 taps to calculate tempo
    if (this.tapTimes.length < 2) {
      return null;
    }

    // Calculate average interval
    const intervals: number[] = [];
    for (let i = 1; i < this.tapTimes.length; i++) {
      intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
    }

    const averageInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const bpm = Math.round(60000 / averageInterval); // 60000ms = 1 minute

    // Clamp to valid BPM range
    return Math.max(
      METRONOME_CONFIG.MIN_BPM,
      Math.min(METRONOME_CONFIG.MAX_BPM, bpm),
    );
  }

  reset(): void {
    this.tapTimes = [];
  }

  get tapCount(): number {
    return this.tapTimes.length;
  }
}

// BPM validation
export const validateBpm = (bpm: number): number => {
  return Math.max(
    METRONOME_CONFIG.MIN_BPM,
    Math.min(METRONOME_CONFIG.MAX_BPM, Math.round(bpm)),
  );
};

// Format BPM for display
export const formatBpm = (bpm: number): string => {
  return `${bpm} BPM`;
};
