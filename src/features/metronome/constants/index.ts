// Metronome Constants

export const METRONOME_CONFIG = {
  MIN_BPM: 1,
  MAX_BPM: 1000,
  DEFAULT_BPM: 90,
  DEFAULT_VOLUME: 0.5,
  TICK_FREQUENCY: 800, // Hz for oscillator fallback
  TICK_DURATION: 0.1, // seconds
} as const;

export const METRONOME_STORAGE_KEYS = {
  VOLUME: "metronome_volume",
  IS_MUTED: "metronome_is_muted",
} as const;

// Sound file path - user should place tick sound here
export const METRONOME_SOUND_PATH = "/sounds/metronome-tick.wav";
