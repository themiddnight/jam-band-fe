// Audio configuration for latency optimization
export const AUDIO_CONFIG = {
  // Tone.js context settings
  TONE_CONTEXT: {
    // Lower values = lower latency but higher CPU usage
    lookAhead: 0.01, // 10ms (default: 0.1s)
    updateInterval: 0.01, // 10ms (default: 25ms)
  },

  // Web Audio API context settings
  AUDIO_CONTEXT: {
    sampleRate: 44100, // Standard sample rate
    latencyHint: "interactive" as AudioContextLatencyCategory, // Options: 'interactive', 'balanced', 'playback'
  },

  // Synthesizer timing settings
  SYNTHESIZER: {
    noteRetriggerDelay: 2, // Delay in ms when retriggering the same note
    envelopeAttackMin: 0.001, // Minimum attack time for responsive feel
  },

  // Performance settings
  PERFORMANCE: {
    maxPolyphony: 32, // Maximum simultaneous notes
    cleanupInterval: 5000, // Cleanup stuck notes every 5 seconds
  },
};

// Helper function to get optimal settings based on device capability
export const getOptimalAudioConfig = () => {
  // Check if device supports low latency
  const supportsLowLatency =
    "AudioContext" in window && typeof AudioContext !== "undefined";

  if (!supportsLowLatency) {
    return {
      ...AUDIO_CONFIG,
      TONE_CONTEXT: {
        lookAhead: 0.05, // Higher latency for compatibility
        updateInterval: 0.025,
      },
      SYNTHESIZER: {
        noteRetriggerDelay: 5,
        envelopeAttackMin: 0.01,
      },
    };
  }

  return AUDIO_CONFIG;
};
