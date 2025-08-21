/**
 * Effects and Mixer Architecture for Jam Band
 *
 * This file provides the architectural foundation for implementing audio effects
 * and per-user mixing capabilities while maintaining ultra-low latency for WebRTC.
 *
 * Key Design Principles:
 * 1. Separate effects processing from WebRTC voice (voice stays direct for lowest latency)
 * 2. Per-user effect chains with individual bypass controls
 * 3. Master bus routing with send/return capabilities
 * 4. Efficient CPU usage through effect pooling and dynamic loading
 * 5. Real-time parameter automation support
 */
import { AudioContextManager } from "../constants/audioConfig";

// Effect Types
export enum EffectType {
  REVERB = "reverb",
  DELAY = "delay",
  CHORUS = "chorus",
  COMPRESSOR = "compressor",
  FILTER = "filter",
  DISTORTION = "distortion",
  EQUALIZER = "equalizer",
  LIMITER = "limiter",
}

// Effect Parameter Interface
export interface EffectParameter {
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  curve?: "linear" | "exponential" | "logarithmic";
}

// Base Effect Interface
export interface AudioEffect {
  id: string;
  type: EffectType;
  name: string;
  enabled: boolean;
  parameters: Map<string, EffectParameter>;
  inputNode: GainNode;
  outputNode: GainNode;
  wetGainNode: GainNode;
  dryGainNode: GainNode;
  bypass: boolean;

  // Methods
  process(inputNode: AudioNode): AudioNode;
  setParameter(name: string, value: number): void;
  getParameter(name: string): number | undefined;
  enable(): void;
  disable(): void;
  cleanup(): void;
}

// User Channel Interface
export interface UserChannel {
  userId: string;
  username: string;
  inputGain: GainNode;
  effectChain: AudioEffect[];
  outputGain: GainNode;
  soloMute: {
    solo: boolean;
    mute: boolean;
  };
  sends: Map<string, GainNode>; // Send to aux buses
  panNode?: StereoPannerNode;
}

// Aux Bus Interface
export interface AuxBus {
  id: string;
  name: string;
  inputGain: GainNode;
  effectChain: AudioEffect[];
  outputGain: GainNode;
  returnLevel: number;
}

// Master Section Interface
export interface MasterSection {
  inputGain: GainNode;
  effectChain: AudioEffect[];
  outputGain: GainNode;
  limiter?: AudioEffect;
  analyser: AnalyserNode;
}

/**
 * Effects Factory - Creates and manages effect instances
 */
export class EffectsFactory {
  private static effectPool = new Map<EffectType, AudioEffect[]>();
  private static context: AudioContext | null = null;

  static initialize(audioContext: AudioContext): void {
    this.context = audioContext;
  }

  /**
   * Create a new effect instance
   */
  static createEffect(type: EffectType, id?: string): AudioEffect | null {
    if (!this.context) return null;

    // Try to get from pool first
    const pool = this.effectPool.get(type) || [];
    if (pool.length > 0) {
      const effect = pool.pop()!;
      effect.id = id || `${type}_${Date.now()}`;
      return effect;
    }

    // Create new effect
    switch (type) {
      case EffectType.REVERB:
        return this.createReverbEffect(id);
      case EffectType.DELAY:
        return this.createDelayEffect(id);
      case EffectType.COMPRESSOR:
        return this.createCompressorEffect(id);
      case EffectType.FILTER:
        return this.createFilterEffect(id);
      default:
        console.warn(`Effect type ${type} not implemented yet`);
        return null;
    }
  }

  /**
   * Return effect to pool for reuse
   */
  static releaseEffect(effect: AudioEffect): void {
    effect.cleanup();
    effect.enabled = false;

    const pool = this.effectPool.get(effect.type) || [];
    if (pool.length < 5) {
      // Limit pool size
      pool.push(effect);
      this.effectPool.set(effect.type, pool);
    }
  }

  private static createReverbEffect(id?: string): AudioEffect {
    const context = this.context!;
    const nodePool = AudioContextManager.getNodePool();

    // Create convolution reverb
    const convolver = context.createConvolver();
    const inputGain = nodePool?.getGainNode() || context.createGain();
    const outputGain = nodePool?.getGainNode() || context.createGain();
    const wetGain = nodePool?.getGainNode() || context.createGain();
    const dryGain = nodePool?.getGainNode() || context.createGain();

    // Create impulse response (simple room simulation)
    const impulseLength = context.sampleRate * 2; // 2 seconds
    const impulse = context.createBuffer(2, impulseLength, context.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < impulseLength; i++) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
      }
    }
    convolver.buffer = impulse;

    // Wire up the effect
    inputGain.connect(dryGain);
    inputGain.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(outputGain);
    wetGain.connect(outputGain);

    const parameters = new Map<string, EffectParameter>();
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.3,
      min: 0,
      max: 1,
      unit: "%",
    });
    parameters.set("dryLevel", {
      name: "Dry Level",
      value: 0.7,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `reverb_${Date.now()}`,
      type: EffectType.REVERB,
      name: "Reverb",
      enabled: true,
      parameters,
      inputNode: inputGain,
      outputNode: outputGain,
      wetGainNode: wetGain,
      dryGainNode: dryGain,
      bypass: false,

      process(input: AudioNode): AudioNode {
        input.connect(this.inputNode);
        return this.outputNode;
      },

      setParameter(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (!param) return;

        param.value = Math.max(param.min, Math.min(param.max, value));

        switch (name) {
          case "wetLevel":
            this.wetGainNode.gain.setValueAtTime(value, context.currentTime);
            break;
          case "dryLevel":
            this.dryGainNode.gain.setValueAtTime(value, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        this.outputNode.gain.setValueAtTime(1, context.currentTime);
      },

      disable(): void {
        this.enabled = false;
        this.outputNode.gain.setValueAtTime(0, context.currentTime);
      },

      cleanup(): void {
        this.inputNode.disconnect();
        this.outputNode.disconnect();
        this.wetGainNode.disconnect();
        this.dryGainNode.disconnect();
        convolver.disconnect();
      },
    };
  }

  private static createDelayEffect(id?: string): AudioEffect {
    const context = this.context!;
    const nodePool = AudioContextManager.getNodePool();

    const delay = context.createDelay(1.0); // Max 1 second delay
    const feedback = nodePool?.getGainNode() || context.createGain();
    const inputGain = nodePool?.getGainNode() || context.createGain();
    const outputGain = nodePool?.getGainNode() || context.createGain();
    const wetGain = nodePool?.getGainNode() || context.createGain();
    const dryGain = nodePool?.getGainNode() || context.createGain();

    // Wire up delay with feedback
    inputGain.connect(dryGain);
    inputGain.connect(delay);
    delay.connect(feedback);
    delay.connect(wetGain);
    feedback.connect(delay);
    dryGain.connect(outputGain);
    wetGain.connect(outputGain);

    // Set initial values
    delay.delayTime.value = 0.25; // 250ms
    feedback.gain.value = 0.3;
    wetGain.gain.value = 0.3;
    dryGain.gain.value = 0.7;

    const parameters = new Map<string, EffectParameter>();
    parameters.set("delayTime", {
      name: "Delay Time",
      value: 0.25,
      min: 0.01,
      max: 1.0,
      unit: "s",
    });
    parameters.set("feedback", {
      name: "Feedback",
      value: 0.3,
      min: 0,
      max: 0.9,
      unit: "%",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.3,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `delay_${Date.now()}`,
      type: EffectType.DELAY,
      name: "Delay",
      enabled: true,
      parameters,
      inputNode: inputGain,
      outputNode: outputGain,
      wetGainNode: wetGain,
      dryGainNode: dryGain,
      bypass: false,

      process(input: AudioNode): AudioNode {
        input.connect(this.inputNode);
        return this.outputNode;
      },

      setParameter(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (!param) return;

        param.value = Math.max(param.min, Math.min(param.max, value));

        switch (name) {
          case "delayTime":
            delay.delayTime.setValueAtTime(value, context.currentTime);
            break;
          case "feedback":
            feedback.gain.setValueAtTime(value, context.currentTime);
            break;
          case "wetLevel":
            this.wetGainNode.gain.setValueAtTime(value, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        this.outputNode.gain.setValueAtTime(1, context.currentTime);
      },

      disable(): void {
        this.enabled = false;
        this.outputNode.gain.setValueAtTime(0, context.currentTime);
      },

      cleanup(): void {
        this.inputNode.disconnect();
        this.outputNode.disconnect();
        this.wetGainNode.disconnect();
        this.dryGainNode.disconnect();
        delay.disconnect();
        feedback.disconnect();
      },
    };
  }

  private static createCompressorEffect(id?: string): AudioEffect {
    const context = this.context!;
    const nodePool = AudioContextManager.getNodePool();

    const compressor = context.createDynamicsCompressor();
    const inputGain = nodePool?.getGainNode() || context.createGain();
    const outputGain = nodePool?.getGainNode() || context.createGain();

    inputGain.connect(compressor);
    compressor.connect(outputGain);

    // Set initial compressor values
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const parameters = new Map<string, EffectParameter>();
    parameters.set("threshold", {
      name: "Threshold",
      value: -24,
      min: -100,
      max: 0,
      unit: "dB",
    });
    parameters.set("ratio", {
      name: "Ratio",
      value: 4,
      min: 1,
      max: 20,
      unit: ":1",
    });
    parameters.set("attack", {
      name: "Attack",
      value: 0.003,
      min: 0,
      max: 1,
      unit: "s",
    });
    parameters.set("release", {
      name: "Release",
      value: 0.25,
      min: 0,
      max: 1,
      unit: "s",
    });

    return {
      id: id || `compressor_${Date.now()}`,
      type: EffectType.COMPRESSOR,
      name: "Compressor",
      enabled: true,
      parameters,
      inputNode: inputGain,
      outputNode: outputGain,
      wetGainNode: outputGain, // Compressor doesn't have wet/dry
      dryGainNode: inputGain,
      bypass: false,

      process(input: AudioNode): AudioNode {
        input.connect(this.inputNode);
        return this.outputNode;
      },

      setParameter(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (!param) return;

        param.value = Math.max(param.min, Math.min(param.max, value));

        switch (name) {
          case "threshold":
            compressor.threshold.setValueAtTime(value, context.currentTime);
            break;
          case "ratio":
            compressor.ratio.setValueAtTime(value, context.currentTime);
            break;
          case "attack":
            compressor.attack.setValueAtTime(value, context.currentTime);
            break;
          case "release":
            compressor.release.setValueAtTime(value, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        this.outputNode.gain.setValueAtTime(1, context.currentTime);
      },

      disable(): void {
        this.enabled = false;
        this.outputNode.gain.setValueAtTime(0, context.currentTime);
      },

      cleanup(): void {
        this.inputNode.disconnect();
        this.outputNode.disconnect();
        compressor.disconnect();
      },
    };
  }

  private static createFilterEffect(id?: string): AudioEffect {
    const context = this.context!;
    const nodePool = AudioContextManager.getNodePool();

    const filter = context.createBiquadFilter();
    const inputGain = nodePool?.getGainNode() || context.createGain();
    const outputGain = nodePool?.getGainNode() || context.createGain();

    inputGain.connect(filter);
    filter.connect(outputGain);

    // Set initial filter values
    filter.type = "lowpass";
    filter.frequency.value = 1000;
    filter.Q.value = 1;

    const parameters = new Map<string, EffectParameter>();
    parameters.set("frequency", {
      name: "Frequency",
      value: 1000,
      min: 20,
      max: 20000,
      unit: "Hz",
      curve: "logarithmic",
    });
    parameters.set("Q", {
      name: "Resonance",
      value: 1,
      min: 0.1,
      max: 30,
      unit: "Q",
    });

    return {
      id: id || `filter_${Date.now()}`,
      type: EffectType.FILTER,
      name: "Filter",
      enabled: true,
      parameters,
      inputNode: inputGain,
      outputNode: outputGain,
      wetGainNode: outputGain,
      dryGainNode: inputGain,
      bypass: false,

      process(input: AudioNode): AudioNode {
        input.connect(this.inputNode);
        return this.outputNode;
      },

      setParameter(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (!param) return;

        param.value = Math.max(param.min, Math.min(param.max, value));

        switch (name) {
          case "frequency":
            filter.frequency.setValueAtTime(value, context.currentTime);
            break;
          case "Q":
            filter.Q.setValueAtTime(value, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        this.outputNode.gain.setValueAtTime(1, context.currentTime);
      },

      disable(): void {
        this.enabled = false;
        this.outputNode.gain.setValueAtTime(0, context.currentTime);
      },

      cleanup(): void {
        this.inputNode.disconnect();
        this.outputNode.disconnect();
        filter.disconnect();
      },
    };
  }
}

/**
 * Mixer Architecture - Manages user channels, aux buses, and master section
 */
export class MixerEngine {
  private userChannels = new Map<string, UserChannel>();
  private auxBuses = new Map<string, AuxBus>();
  private masterSection: MasterSection | null = null;
  private context: AudioContext;

  constructor(audioContext: AudioContext) {
    this.context = audioContext;
    this.initializeMasterSection();
    EffectsFactory.initialize(audioContext);
  }

  private initializeMasterSection(): void {
    const masterBus = AudioContextManager.getMasterBus();
    if (!masterBus) return;

    const nodePool = AudioContextManager.getNodePool();
    const inputGain = nodePool?.getGainNode() || this.context.createGain();
    const outputGain = nodePool?.getGainNode() || this.context.createGain();
    const analyser = this.context.createAnalyser();

    // Connect master section
    inputGain.connect(outputGain);
    outputGain.connect(analyser);
    analyser.connect(masterBus.getMasterGain());

    this.masterSection = {
      inputGain,
      effectChain: [],
      outputGain,
      analyser,
    };
  }

  /**
   * Create a user channel
   */
  createUserChannel(userId: string, username: string): UserChannel {
    const nodePool = AudioContextManager.getNodePool();

    const inputGain = nodePool?.getGainNode() || this.context.createGain();
    const outputGain = nodePool?.getGainNode() || this.context.createGain();
    const panNode = this.context.createStereoPanner();

    // Connect channel
    inputGain.connect(panNode);
    panNode.connect(outputGain);

    if (this.masterSection) {
      outputGain.connect(this.masterSection.inputGain);
    }

    const channel: UserChannel = {
      userId,
      username,
      inputGain,
      effectChain: [],
      outputGain,
      soloMute: { solo: false, mute: false },
      sends: new Map(),
      panNode,
    };

    this.userChannels.set(userId, channel);
    return channel;
  }

  /**
   * Add effect to user channel
   */
  addEffectToChannel(
    userId: string,
    effectType: EffectType,
  ): AudioEffect | null {
    const channel = this.userChannels.get(userId);
    if (!channel) return null;

    const effect = EffectsFactory.createEffect(effectType);
    if (!effect) return null;

    // Insert effect into chain
    const lastNode =
      channel.effectChain.length > 0
        ? channel.effectChain[channel.effectChain.length - 1].outputNode
        : channel.inputGain;

    lastNode.disconnect();
    lastNode.connect(effect.inputNode);
    effect.outputNode.connect(channel.outputGain);

    channel.effectChain.push(effect);
    return effect;
  }

  /**
   * Route instrument to user channel
   */
  routeInstrumentToChannel(instrumentOutput: AudioNode, userId: string): void {
    const channel = this.userChannels.get(userId);
    if (!channel) return;

    instrumentOutput.connect(channel.inputGain);
  }

  /**
   * Get channel for user
   */
  getChannel(userId: string): UserChannel | undefined {
    return this.userChannels.get(userId);
  }

  /**
   * Cleanup mixer resources
   */
  cleanup(): void {
    // Cleanup user channels
    this.userChannels.forEach((channel) => {
      channel.effectChain.forEach((effect) =>
        EffectsFactory.releaseEffect(effect),
      );
      channel.inputGain.disconnect();
      channel.outputGain.disconnect();
      channel.panNode?.disconnect();
    });

    // Cleanup aux buses
    this.auxBuses.forEach((bus) => {
      bus.effectChain.forEach((effect) => EffectsFactory.releaseEffect(effect));
      bus.inputGain.disconnect();
      bus.outputGain.disconnect();
    });

    // Cleanup master section
    if (this.masterSection) {
      this.masterSection.effectChain.forEach((effect) =>
        EffectsFactory.releaseEffect(effect),
      );
      this.masterSection.inputGain.disconnect();
      this.masterSection.outputGain.disconnect();
      this.masterSection.analyser.disconnect();
    }

    this.userChannels.clear();
    this.auxBuses.clear();
    this.masterSection = null;
  }
}

/**
 * Usage Example:
 *
 * // Initialize mixer
 * const audioContext = AudioContextManager.getInstrumentContext();
 * const mixer = new MixerEngine(audioContext);
 *
 * // Create user channels
 * const userChannel = mixer.createUserChannel('user1', 'Alice');
 *
 * // Add effects
 * const reverb = mixer.addEffectToChannel('user1', EffectType.REVERB);
 * reverb?.setParameter('wetLevel', 0.4);
 *
 * // Route instrument
 * mixer.routeInstrumentToChannel(toneJsSynth, 'user1');
 *
 * // The WebRTC voice remains separate and unprocessed for lowest latency
 */
