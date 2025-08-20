// Audio configuration for ultra-low latency optimization with separate contexts
export const AUDIO_CONFIG = {
  // Tone.js context settings for instruments
  TONE_CONTEXT: {
    // Ultra-low values for minimum latency
    lookAhead: 0.005, // 5ms (reduced from 10ms)
    updateInterval: 0.005, // 5ms (reduced from 10ms)
  },

  // Web Audio API context settings for instruments
  INSTRUMENT_AUDIO_CONTEXT: {
    sampleRate: 48000, // Match WebRTC sample rate to avoid conversion overhead
    latencyHint: "interactive" as AudioContextLatencyCategory, // Optimized for low latency
  },

  // Web Audio API context settings for WebRTC - Ultra-low latency mode
  WEBRTC_AUDIO_CONTEXT: {
    sampleRate: 48000, // WebRTC preferred sample rate
    latencyHint: "interactive" as AudioContextLatencyCategory, // Interactive for real-time performance
  },

  // Synthesizer timing settings - Ultra-responsive
  SYNTHESIZER: {
    noteRetriggerDelay: 1, // Reduced delay from 2ms to 1ms
    envelopeAttackMin: 0.0005, // Reduced from 0.001s for ultra-fast response
  },

  // Performance settings optimized for ultra-low latency WebRTC mesh
  PERFORMANCE: {
    maxPolyphony: 32, // Maximum simultaneous notes
    cleanupInterval: 4000, // More frequent cleanup (reduced from 5000ms)
    // Aggressive polyphony reduction when WebRTC is active
    maxPolyphonyWithWebRTC: 10, // Further reduced from 12
    // Ultra-low latency WebRTC priority mode
    webrtcPriorityMode: {
      maxPolyphony: 6, // Ultra-low polyphony for priority voice (reduced from 8)
      reducedProcessing: true, // Enable simplified processing
      fasterUpdates: true, // Reduce update intervals
      disableReverb: true, // Disable reverb for lower CPU usage
      disableDelay: true, // Disable delay effects
      prioritizeVoice: true, // Voice gets CPU priority over instruments
    },
  },

  // Enhanced audio node pooling configuration
  NODE_POOL: {
    maxGainNodes: 50,
    maxOscillatorNodes: 20,
    maxAnalyserNodes: 10,
    maxBufferSourceNodes: 30,
    cleanupInterval: 10000, // Clean unused nodes every 10s
  },

  // Master audio bus configuration for future effects/mixer
  MASTER_BUS: {
    enabled: true,
    masterGainLevel: 0.8,
    busRouting: {
      instruments: 'master',
      metronome: 'master', 
      voice: 'direct', // WebRTC bypasses master bus for lowest latency
    },
    effects: {
      // Future effects configuration
      reverb: { enabled: false, wetLevel: 0.3 },
      delay: { enabled: false, time: 0.25, feedback: 0.3 },
      compressor: { enabled: false, threshold: -24, ratio: 4 },
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

// Audio Node Pool for efficient node reuse
class AudioNodePool {
  private gainNodes: GainNode[] = [];
  private analyserNodes: AnalyserNode[] = [];
  private bufferSourceNodes: AudioBufferSourceNode[] = [];
  private context: AudioContext;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(context: AudioContext) {
    this.context = context;
    this.startCleanupTimer();
  }

  // Get a reusable gain node
  getGainNode(): GainNode {
    if (this.gainNodes.length > 0) {
      return this.gainNodes.pop()!;
    }
    return this.context.createGain();
  }

  // Return gain node to pool
  releaseGainNode(node: GainNode): void {
    if (this.gainNodes.length < AUDIO_CONFIG.NODE_POOL.maxGainNodes) {
      // Reset node properties
      node.gain.value = 1;
      node.disconnect();
      this.gainNodes.push(node);
    }
  }

  // Get a reusable oscillator (note: oscillators can only be used once)
  getOscillator(): OscillatorNode {
    return this.context.createOscillator();
  }

  // Get a reusable analyser node
  getAnalyserNode(): AnalyserNode {
    if (this.analyserNodes.length > 0) {
      return this.analyserNodes.pop()!;
    }
    return this.context.createAnalyser();
  }

  // Return analyser node to pool
  releaseAnalyserNode(node: AnalyserNode): void {
    if (this.analyserNodes.length < AUDIO_CONFIG.NODE_POOL.maxAnalyserNodes) {
      node.disconnect();
      this.analyserNodes.push(node);
    }
  }

  // Get a reusable buffer source node
  getBufferSourceNode(): AudioBufferSourceNode {
    if (this.bufferSourceNodes.length > 0) {
      return this.bufferSourceNodes.pop()!;
    }
    return this.context.createBufferSource();
  }

  // Return buffer source node to pool (note: buffer sources can only be used once)
  releaseBufferSourceNode(node: AudioBufferSourceNode): void {
    // Buffer sources cannot be reused, but we track them for cleanup
    node.disconnect();
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      // Keep pool sizes reasonable
      const config = AUDIO_CONFIG.NODE_POOL;
      if (this.gainNodes.length > config.maxGainNodes) {
        this.gainNodes.splice(config.maxGainNodes);
      }
      if (this.analyserNodes.length > config.maxAnalyserNodes) {
        this.analyserNodes.splice(config.maxAnalyserNodes);
      }
    }, AUDIO_CONFIG.NODE_POOL.cleanupInterval);
  }

  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // Disconnect all pooled nodes
    [...this.gainNodes, ...this.analyserNodes].forEach(node => node.disconnect());
    this.gainNodes = [];
    this.analyserNodes = [];
    this.bufferSourceNodes = [];
  }
}

// Master Audio Bus for routing and future effects
class MasterAudioBus {
  private masterGain: GainNode;
  private context: AudioContext;
  private effectsChain: GainNode[] = [];

  constructor(context: AudioContext) {
    this.context = context;
    this.masterGain = context.createGain();
    this.masterGain.gain.value = AUDIO_CONFIG.MASTER_BUS.masterGainLevel;
    this.masterGain.connect(context.destination);
    console.log('🎛️ Master Audio Bus initialized');
  }

  // Get the master gain node for routing
  getMasterGain(): GainNode {
    return this.masterGain;
  }

  // Route an audio node through the master bus
  routeToMaster(sourceNode: AudioNode): void {
    sourceNode.connect(this.masterGain);
  }

  // Set master volume
  setMasterVolume(volume: number): void {
    this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
  }

  // Future: Add effects to the chain
  addEffect(effectNode: AudioNode): void {
    // Implementation for future effects
    this.effectsChain.push(effectNode as GainNode);
  }

  cleanup(): void {
    this.masterGain.disconnect();
    this.effectsChain.forEach(effect => effect.disconnect());
  }
}

// Audio Context Management for separated contexts
export class AudioContextManager {
  private static instrumentContext: AudioContext | null = null;
  private static webrtcContext: AudioContext | null = null;
  private static webrtcActive: boolean = false;
  private static webrtcPriorityMode: boolean = false; // Ultra-low latency mode for voice priority
  private static instrumentNodePool: AudioNodePool | null = null;
  private static masterBus: MasterAudioBus | null = null;

  // Get or create instrument audio context
  static getInstrumentContext(): AudioContext {
    if (!this.instrumentContext || this.instrumentContext.state === "closed") {
      const config = getOptimalAudioConfig();
      this.instrumentContext = new AudioContext(config.INSTRUMENT_AUDIO_CONTEXT);
      
      // Initialize node pool and master bus
      this.instrumentNodePool = new AudioNodePool(this.instrumentContext);
      if (config.MASTER_BUS.enabled) {
        this.masterBus = new MasterAudioBus(this.instrumentContext);
      }
      
      console.log(`🎵 Instrument AudioContext created: ${this.instrumentContext.sampleRate}Hz`);
      
      // Add performance monitoring
      this.setupPerformanceMonitoring();
    }
    
    if (this.instrumentContext.state === "suspended") {
      this.instrumentContext.resume().catch(console.warn);
    }
    
    return this.instrumentContext;
  }

  // Get the audio node pool for efficient node reuse
  static getNodePool(): AudioNodePool | null {
    return this.instrumentNodePool;
  }

  // Get the master audio bus for routing
  static getMasterBus(): MasterAudioBus | null {
    return this.masterBus;
  }

  // Get or create WebRTC audio context
  static getWebRTCContext(): AudioContext {
    if (!this.webrtcContext || this.webrtcContext.state === "closed") {
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
    
    // Cleanup node pool and master bus
    if (this.instrumentNodePool) {
      this.instrumentNodePool.cleanup();
      this.instrumentNodePool = null;
    }
    if (this.masterBus) {
      this.masterBus.cleanup();
      this.masterBus = null;
    }
    
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
