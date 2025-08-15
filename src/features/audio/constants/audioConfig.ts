// Audio configuration for latency optimization with separate contexts
export const AUDIO_CONFIG = {
  // Tone.js context settings for instruments
  TONE_CONTEXT: {
    // Lower values = lower latency but higher CPU usage
    lookAhead: 0.01, // 10ms (default: 0.1s)
    updateInterval: 0.01, // 10ms (default: 25ms)
  },

  // Web Audio API context settings for instruments
  INSTRUMENT_AUDIO_CONTEXT: {
    sampleRate: 44100, // Standard sample rate
    latencyHint: "interactive" as AudioContextLatencyCategory, // Optimized for low latency
  },

  // Web Audio API context settings for WebRTC
  WEBRTC_AUDIO_CONTEXT: {
    sampleRate: 48000, // WebRTC preferred sample rate
    latencyHint: "balanced" as AudioContextLatencyCategory, // Balanced for voice quality
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
    // Reduce polyphony when WebRTC is active
    maxPolyphonyWithWebRTC: 16, // Reduced polyphony during voice calls
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

// Audio Context Management for separated contexts
export class AudioContextManager {
  private static instrumentContext: AudioContext | null = null;
  private static webrtcContext: AudioContext | null = null;

  // Get or create instrument audio context
  static getInstrumentContext(): AudioContext {
    if (!this.instrumentContext) {
      const config = getOptimalAudioConfig();
      this.instrumentContext = new AudioContext(config.INSTRUMENT_AUDIO_CONTEXT);
    }
    
    if (this.instrumentContext.state === "suspended") {
      this.instrumentContext.resume().catch(console.warn);
    }
    
    return this.instrumentContext;
  }

  // Get or create WebRTC audio context
  static getWebRTCContext(): AudioContext {
    if (!this.webrtcContext) {
      const config = getOptimalAudioConfig();
      this.webrtcContext = new AudioContext(config.WEBRTC_AUDIO_CONTEXT);
    }
    
    if (this.webrtcContext.state === "suspended") {
      this.webrtcContext.resume().catch(console.warn);
    }
    
    return this.webrtcContext;
  }

  // Check if WebRTC is active to adjust instrument performance
  static isWebRTCActive(): boolean {
    return this.webrtcContext !== null && this.webrtcContext.state === "running";
  }

  // Get adjusted polyphony based on WebRTC state
  static getMaxPolyphony(): number {
    const config = getOptimalAudioConfig();
    return this.isWebRTCActive() 
      ? config.PERFORMANCE.maxPolyphonyWithWebRTC 
      : config.PERFORMANCE.maxPolyphony;
  }

  // Cleanup contexts
  static async cleanup() {
    if (this.instrumentContext) {
      await this.instrumentContext.close();
      this.instrumentContext = null;
    }
    if (this.webrtcContext) {
      await this.webrtcContext.close();
      this.webrtcContext = null;
    }
  }

  // Suspend instrument context to reduce CPU when not needed
  static async suspendInstrumentContext() {
    if (this.instrumentContext && this.instrumentContext.state === "running") {
      await this.instrumentContext.suspend();
    }
  }

  // Resume instrument context
  static async resumeInstrumentContext() {
    if (this.instrumentContext && this.instrumentContext.state === "suspended") {
      await this.instrumentContext.resume();
    }
  }
}
