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
    sampleRate: 48000, // Match WebRTC sample rate to avoid conversion overhead
    latencyHint: "interactive" as AudioContextLatencyCategory, // Optimized for low latency
  },

  // Web Audio API context settings for WebRTC
  WEBRTC_AUDIO_CONTEXT: {
    sampleRate: 48000, // WebRTC preferred sample rate
    latencyHint: "interactive" as AudioContextLatencyCategory, // Changed to interactive for better real-time performance
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
    maxPolyphonyWithWebRTC: 12, // Significantly reduced polyphony during voice calls
    // Additional WebRTC optimizations
    webrtcPriorityMode: {
      maxPolyphony: 8, // Ultra-low polyphony for priority voice
      reducedProcessing: true, // Enable simplified processing
      fasterUpdates: true, // Reduce update intervals
    },
  },
};

// Helper function to get optimal settings based on device capability
export const getOptimalAudioConfig = () => {
  // Check if device supports low latency
  const supportsLowLatency =
    "AudioContext" in window && typeof AudioContext !== "undefined";

  // Check if device supports 48kHz sample rate (most modern devices do)
  const supports48kHz = (() => {
    try {
      const testContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const supports = testContext.sampleRate >= 48000;
      testContext.close();
      return supports;
    } catch {
      return false;
    }
  })();

  if (!supportsLowLatency) {
    return {
      ...AUDIO_CONFIG,
      TONE_CONTEXT: {
        lookAhead: 0.05, // Higher latency for compatibility
        updateInterval: 0.025,
      },
      INSTRUMENT_AUDIO_CONTEXT: {
        sampleRate: supports48kHz ? 48000 : 44100, // Fallback to 44.1kHz if needed
        latencyHint: "balanced" as AudioContextLatencyCategory,
      },
      WEBRTC_AUDIO_CONTEXT: {
        sampleRate: supports48kHz ? 48000 : 44100, // Keep both contexts in sync
        latencyHint: "balanced" as AudioContextLatencyCategory,
      },
      SYNTHESIZER: {
        noteRetriggerDelay: 5,
        envelopeAttackMin: 0.01,
      },
    };
  }

  return {
    ...AUDIO_CONFIG,
    INSTRUMENT_AUDIO_CONTEXT: {
      ...AUDIO_CONFIG.INSTRUMENT_AUDIO_CONTEXT,
      sampleRate: supports48kHz ? 48000 : 44100, // Ensure consistency
    },
    WEBRTC_AUDIO_CONTEXT: {
      ...AUDIO_CONFIG.WEBRTC_AUDIO_CONTEXT,
      sampleRate: supports48kHz ? 48000 : 44100, // Ensure consistency
    },
  };
};

// Audio Context Management for separated contexts
export class AudioContextManager {
  private static instrumentContext: AudioContext | null = null;
  private static webrtcContext: AudioContext | null = null;
  private static webrtcActive: boolean = false;
  private static webrtcPriorityMode: boolean = false; // Ultra-low latency mode for voice priority

  // Get or create instrument audio context
  static getInstrumentContext(): AudioContext {
    if (!this.instrumentContext) {
      const config = getOptimalAudioConfig();
      this.instrumentContext = new AudioContext(config.INSTRUMENT_AUDIO_CONTEXT);
      
      console.log(`🎵 Instrument AudioContext created: ${this.instrumentContext.sampleRate}Hz`);
      
      // Add performance monitoring
      this.setupPerformanceMonitoring();
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
      this.webrtcActive = true;
      
      console.log(`🎤 WebRTC AudioContext created: ${this.webrtcContext.sampleRate}Hz`);
      
      // Warn if sample rates don't match
      if (this.instrumentContext && this.instrumentContext.sampleRate !== this.webrtcContext.sampleRate) {
        console.warn(`⚠️ Sample rate mismatch! Instrument: ${this.instrumentContext.sampleRate}Hz, WebRTC: ${this.webrtcContext.sampleRate}Hz`);
      }
      
      // Adjust instrument performance when WebRTC becomes active
      this.notifyWebRTCStateChange();
    }
    
    if (this.webrtcContext.state === "suspended") {
      this.webrtcContext.resume().catch(console.warn);
    }
    
    return this.webrtcContext;
  }

  // Check if WebRTC is active to adjust instrument performance
  static isWebRTCActive(): boolean {
    return this.webrtcActive && this.webrtcContext !== null && this.webrtcContext.state === "running";
  }

  // Get adjusted polyphony based on WebRTC state
  static getMaxPolyphony(): number {
    const config = getOptimalAudioConfig();
    
    if (this.webrtcPriorityMode) {
      return config.PERFORMANCE.webrtcPriorityMode.maxPolyphony;
    } else if (this.isWebRTCActive()) {
      return config.PERFORMANCE.maxPolyphonyWithWebRTC;
    }
    
    return config.PERFORMANCE.maxPolyphony;
  }

  // Enable priority mode for WebRTC (ultra-low latency)
  static enableWebRTCPriorityMode() {
    this.webrtcPriorityMode = true;
    console.log("🚨 WebRTC Priority Mode ENABLED - Ultra-low latency for voice");
    this.notifyWebRTCStateChange();
  }

  // Disable priority mode
  static disableWebRTCPriorityMode() {
    this.webrtcPriorityMode = false;
    console.log("✅ WebRTC Priority Mode DISABLED - Normal performance restored");
    this.notifyWebRTCStateChange();
  }

  // Check if in priority mode
  static isWebRTCPriorityMode(): boolean {
    return this.webrtcPriorityMode;
  }

  // Notify when WebRTC state changes to adjust instrument performance
  static notifyWebRTCStateChange() {
    // Dispatch custom event to notify instruments of WebRTC state change
    const event = new CustomEvent('webrtc-state-change', {
      detail: { 
        isActive: this.isWebRTCActive(),
        isPriorityMode: this.webrtcPriorityMode,
        maxPolyphony: this.getMaxPolyphony()
      }
    });
    window.dispatchEvent(event);
  }

  // Set WebRTC active state
  static setWebRTCActive(active: boolean) {
    this.webrtcActive = active;
    this.notifyWebRTCStateChange();
  }

  // Setup performance monitoring for audio contexts
  private static setupPerformanceMonitoring() {
    if (this.instrumentContext) {
      // Monitor CPU usage and adjust buffer size if needed
      setInterval(() => {
        if (this.instrumentContext && this.instrumentContext.state === "running" && this.webrtcContext) {
          const baseLatency = this.instrumentContext.baseLatency;
          const outputLatency = this.instrumentContext.outputLatency;
          const totalLatency = baseLatency + outputLatency;
          
          // If latency is getting high and WebRTC is active, warn and potentially optimize
          if (this.isWebRTCActive() && totalLatency > 0.05) { // 50ms
            console.warn(`🚨 High audio latency detected: ${(totalLatency * 1000).toFixed(1)}ms - WebRTC may experience dropouts`);
            
            // If latency is very high, suggest reducing instrument quality
            if (totalLatency > 0.1) { // 100ms
              console.warn("⚡ Consider reducing instrument polyphony or quality to improve WebRTC performance");
              this.notifyWebRTCStateChange();
            }
          }
          
          // Monitor WebRTC context specifically
          if (this.webrtcContext && this.webrtcContext.state === "running") {
            const webrtcLatency = this.webrtcContext.baseLatency + this.webrtcContext.outputLatency;
            if (webrtcLatency > 0.03) { // 30ms
              console.warn(`🎤 WebRTC high latency: ${(webrtcLatency * 1000).toFixed(1)}ms`);
            }
          }
        }
      }, 5000); // Check every 5 seconds
    }
  }

  // Cleanup contexts
  static async cleanup() {
    this.webrtcActive = false;
    
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

  // Cleanup WebRTC context specifically
  static async cleanupWebRTC() {
    this.webrtcActive = false;
    this.notifyWebRTCStateChange();
    
    if (this.webrtcContext) {
      await this.webrtcContext.close();
      this.webrtcContext = null;
    }
  }
}
