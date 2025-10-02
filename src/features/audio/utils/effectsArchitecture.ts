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
import type { EffectInstanceState } from "@/shared/types";
import * as Tone from "tone";

const EFFECT_PARAMETER_NAME_MAP: Record<string, Record<string, string>> = {
  reverb: {
    room_size: "roomSize",
    decay_time: "decayTime",
    pre_delay: "preDelay",
    dry_wet: "wetLevel",
    wet: "wetLevel",
  },
  delay: {
    time: "delayTime",
    delay_time: "delayTime",
    feedback: "feedback",
    dry_wet: "wetLevel",
    wet: "wetLevel",
  },
  chorus: {
    frequency: "frequency",
    delay_time: "delayTime",
    depth: "depth",
    spread: "spread",
    dry_wet: "wetLevel",
  },
  compressor: {
    threshold: "threshold",
    ratio: "ratio",
    attack: "attack",
    release: "release",
    dry_wet: "wetLevel",
  },
  filter: {
    frequency: "frequency",
    resonance: "Q",
    q: "Q",
    type: "type",
    dry_wet: "wetLevel",
  },
  distortion: {
    distortion: "distortion",
    oversample: "oversample",
    dry_wet: "wetLevel",
  },
  autofilter: {
    frequency: "frequency",
    base_frequency: "baseFrequency",
    octaves: "octaves",
    filter_type: "type",
    type: "type",
    dry_wet: "wetLevel",
  },
  autopanner: {
    frequency: "frequency",
    depth: "depth",
    dry_wet: "wetLevel",
  },
  autowah: {
    base_frequency: "baseFrequency",
    octaves: "octaves",
    sensitivity: "sensitivity",
    q: "Q",
    dry_wet: "wetLevel",
  },
  bitcrusher: {
    bits: "bits",
    dry_wet: "wetLevel",
  },
  phaser: {
    frequency: "frequency",
    octaves: "octaves",
    base_frequency: "baseFrequency",
    stages: "stages",
    q: "Q",
    dry_wet: "wetLevel",
  },
  pingpongdelay: {
    delay_time: "delayTime",
    feedback: "feedback",
    dry_wet: "wetLevel",
    wet: "wetLevel",
  },
  stereowidener: {
    width: "width",
    dry_wet: "wetLevel",
  },
  tremolo: {
    frequency: "frequency",
    depth: "depth",
    spread: "spread",
    dry_wet: "wetLevel",
  },
  vibrato: {
    frequency: "frequency",
    depth: "depth",
    dry_wet: "wetLevel",
  },
};

const normalizeParamName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

// Effect Types
export enum EffectType {
  REVERB = "reverb",
  DELAY = "delay",
  CHORUS = "chorus",
  COMPRESSOR = "compressor",
  FILTER = "filter",
  DISTORTION = "distortion",
  AUTOFILTER = "autofilter",
  AUTOPANNER = "autopanner",
  AUTOWAH = "autowah",
  BITCRUSHER = "bitcrusher",
  PHASER = "phaser",
  PINGPONGDELAY = "pingpongdelay",
  STEREOWIDENER = "stereowidener",
  TREMOLO = "tremolo",
  VIBRATO = "vibrato",
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
  // Bridge node for native AudioNode sources (smplr, Tone native nodes)
  inputGain: GainNode;
  // Tone-based per-user channel (pan/volume)
  toneChannel?: Tone.Channel;
  effectChain: AudioEffect[];
  soloMute: {
    solo: boolean;
    mute: boolean;
  };
  sends: Map<string, GainNode>; // Send to aux buses
  // Tone analyser for metering
  analyser?: Tone.Analyser;
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

  static async initialize(audioContext: AudioContext): Promise<void> {
    this.context = audioContext;
    // Ensure Tone uses the same AudioContext so nodes interconnect seamlessly
    try {
      console.log("[Effects] Setting Tone.js context to match effects context...");
      Tone.setContext(audioContext);
      
      // Wait a bit for context to be set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Start Tone.js to enable all Tone effects
      console.log("[Effects] Starting Tone.js...");
      await Tone.start();
      console.log("[Effects] Tone.js started successfully, context state:", Tone.getContext().state);
      console.log("[Effects] Tone context matches effects context:", Tone.getContext().rawContext === audioContext);
    } catch (error) {
      console.warn("[Effects] Failed to initialize Tone.js:", error);
    }
  }

  /**
   * Helper to connect Tone.js effects safely
   */
  private static connectToneEffect(
    inputGain: GainNode,
    toneEffect: any,
    wetGain: GainNode,
    dryGain: GainNode,
    outputGain: GainNode
  ): void {
    try {
      // Connect dry path
      inputGain.connect(dryGain);
      dryGain.connect(outputGain);
      
      // Connect wet path through Tone effect
      // Try different connection methods based on Tone.js version
      if (toneEffect.input?.input) {
        // Newer Tone.js structure
        inputGain.connect(toneEffect.input.input);
        toneEffect.output.output.connect(wetGain);
      } else if (toneEffect.input && toneEffect.output) {
        // Older structure or direct nodes
        inputGain.connect(toneEffect.input);
        toneEffect.output.connect(wetGain);
      } else {
        throw new Error("Cannot determine Tone.js input/output structure");
      }
      
      wetGain.connect(outputGain);
      console.log("[Effects] Tone effect connected successfully");
    } catch (error) {
      console.error("[Effects] Failed to connect Tone effect:", error);
      // Fallback: bypass Tone effect
      inputGain.connect(dryGain);
      dryGain.connect(outputGain);
    }
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
      case EffectType.AUTOFILTER:
        return this.createAutoFilterEffect(id);
      case EffectType.AUTOPANNER:
        return this.createAutoPannerEffect(id);
      case EffectType.AUTOWAH:
        return this.createAutoWahEffect(id);
      case EffectType.BITCRUSHER:
        return this.createBitCrusherEffect(id);
      case EffectType.CHORUS:
        return this.createChorusEffect(id);
      case EffectType.DISTORTION:
        return this.createDistortionEffect(id);
      case EffectType.PHASER:
        return this.createPhaserEffect(id);
      case EffectType.PINGPONGDELAY:
        return this.createPingPongDelayEffect(id);
      case EffectType.STEREOWIDENER:
        return this.createStereoWidenerEffect(id);
      case EffectType.TREMOLO:
        return this.createTremoloEffect(id);
      case EffectType.VIBRATO:
        return this.createVibratoEffect(id);
      default:
        console.warn(`Effect type ${type} not implemented yet`);
        return null;
    }
  }

  /**
   * Return effect to pool for reuse
   */
  static releaseEffect(effect: AudioEffect): void {
    try {
      effect.cleanup();
    } catch (error) {
      console.warn("[Effects] Error during effect cleanup", error);
    }

    effect.enabled = false;

    // Pooling is temporarily disabled to avoid reusing disposed Tone nodes
    // which caused silent chains after remote parameter updates.
  }

  private static createReverbEffect(id?: string): AudioEffect {
    const context = this.context!;
    // Create Tone Reverb with reasonable defaults
    const reverb = new Tone.Reverb({ 
      decay: 2,
      wet: 0.3
    });
    
    // Properly connect to Tone.js nodes
    // Tone.js effects have special .input and .output properties
    const inputNode = reverb.input as any;
    const outputNode = reverb.output as any;

    const parameters = new Map<string, EffectParameter>();
    parameters.set("roomSize", {
      name: "Room Size",
      value: 0.7,
      min: 0,
      max: 1,
      unit: "",
    });
    parameters.set("decayTime", {
      name: "Decay Time",
      value: 2,
      min: 0.1,
      max: 10,
      unit: "s",
    });
    parameters.set("preDelay", {
      name: "Pre-Delay",
      value: 0.01,
      min: 0,
      max: 0.1,
      unit: "s",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: reverb.wet.value,
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
      inputNode,
      outputNode,
      // Placeholders to satisfy interface; Tone handles wet internally
      wetGainNode: outputNode,
      dryGainNode: inputNode,
      bypass: false,

      process(input: AudioNode): AudioNode {
        input.connect(this.inputNode);
        return this.outputNode;
      },

      setParameter(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (!param) {
          console.warn(`[Reverb Effect] Parameter ${name} not found`);
          return;
        }
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "wetLevel":
            reverb.wet.setValueAtTime(v, context.currentTime);
            break;
          case "decayTime":
            // Update decay time - this affects room size perception
            reverb.decay = v;
            break;
          case "roomSize": {
            // Simulate room size by adjusting decay time
            const currentDecay = this.parameters.get("decayTime")?.value || 2;
            const roomDecay = currentDecay * (0.5 + v * 1.5); // Scale decay based on room size
            reverb.decay = roomDecay;
            break;
          }
          case "preDelay":
            // For pre-delay, we'll need to use a delay node before the reverb
            // For now, just store the value - could be implemented with additional delay node
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        // Restore wet level from parameters
        const wetLevel = this.parameters.get("wetLevel")?.value || 0.5;
        reverb.wet.setValueAtTime(wetLevel, context.currentTime);
      },

      disable(): void {
        this.enabled = false;
        reverb.wet.setValueAtTime(0, context.currentTime);
      },

      cleanup(): void {
        try {
          (reverb as any).dispose?.();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createDelayEffect(id?: string): AudioEffect {
    const context = this.context!;
    
    // Create native Web Audio nodes for delay effect
    const inputGain = context.createGain();
    const delayNode = context.createDelay(1.0);
    const feedbackGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();
    
    // Set initial values
    delayNode.delayTime.value = 0.25;
    feedbackGain.gain.value = 0.3;
    wetGain.gain.value = 0.3;
    dryGain.gain.value = 0.7;
    
    // Connect delay network
    inputGain.connect(delayNode);
    inputGain.connect(dryGain);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    delayNode.connect(wetGain);
    wetGain.connect(outputGain);
    dryGain.connect(outputGain);
    
    const inputNode = inputGain;
    const outputNode = outputGain;

    const parameters = new Map<string, EffectParameter>();
    parameters.set("delayTime", {
      name: "Delay Time",
      value: delayNode.delayTime.value,
      min: 0.01,
      max: 1.0,
      unit: "s",
    });
    parameters.set("feedback", {
      name: "Feedback",
      value: feedbackGain.gain.value,
      min: 0,
      max: 0.95,
      unit: "%",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: wetGain.gain.value,
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
      inputNode,
      outputNode,
      wetGainNode: wetGain,
      dryGainNode: dryGain,
      bypass: false,

      process(input: AudioNode): AudioNode {
        input.connect(this.inputNode);
        return this.outputNode;
      },

      setParameter(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (!param) {
          console.warn(`[Delay Effect] Parameter ${name} not found`);
          return;
        }
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "delayTime":
            delayNode.delayTime.setValueAtTime(v, context.currentTime);
            break;
          case "feedback":
            feedbackGain.gain.setValueAtTime(v, context.currentTime);
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        // Restore wet/dry levels from parameters
        const wetLevel = this.parameters.get("wetLevel")?.value || 0.5;
        const dryLevel = this.parameters.get("dryLevel")?.value || 0.5;
        wetGain.gain.setValueAtTime(wetLevel, context.currentTime);
        dryGain.gain.setValueAtTime(dryLevel, context.currentTime);
      },

      disable(): void {
        this.enabled = false;
        wetGain.gain.setValueAtTime(0, context.currentTime);
        dryGain.gain.setValueAtTime(1, context.currentTime);
      },

      cleanup(): void {
        try {
          inputGain.disconnect();
          delayNode.disconnect();
          feedbackGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createCompressorEffect(id?: string): AudioEffect {
    const context = this.context!;
    const compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    });
    
    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();
    
    // Set initial dry/wet balance (100% wet for compressor)
    wetGain.gain.value = 1;
    dryGain.gain.value = 0;
    
    // Connect the network
    inputGain.connect(compressor.input as any);
    inputGain.connect(dryGain);
    (compressor.output as any).connect(wetGain);
    wetGain.connect(outputGain);
    dryGain.connect(outputGain);
    
    const inputNode = inputGain;
    const outputNode = outputGain;

    const parameters = new Map<string, EffectParameter>();
    parameters.set("threshold", {
      name: "Threshold",
      value: compressor.threshold.value as number,
      min: -100,
      max: 0,
      unit: "dB",
    });
    parameters.set("ratio", {
      name: "Ratio",
      value: compressor.ratio.value as number,
      min: 1,
      max: 20,
      unit: ":1",
    });
    parameters.set("attack", {
      name: "Attack",
      value: compressor.attack.value as number,
      min: 0,
      max: 1,
      unit: "s",
    });
    parameters.set("release", {
      name: "Release",
      value: compressor.release.value as number,
      min: 0,
      max: 1,
      unit: "s",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 1, // Compressor is typically 100% wet
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `compressor_${Date.now()}`,
      type: EffectType.COMPRESSOR,
      name: "Compressor",
      enabled: true,
      parameters,
      inputNode,
      outputNode,
      wetGainNode: outputNode,
      dryGainNode: inputNode,
      bypass: false,

      process(input: AudioNode): AudioNode {
        input.connect(this.inputNode);
        return this.outputNode;
      },

      setParameter(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (!param) return;
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;

        switch (name) {
          case "threshold":
            compressor.threshold.setValueAtTime(v, context.currentTime);
            break;
          case "ratio":
            compressor.ratio.setValueAtTime(v, context.currentTime);
            break;
          case "attack":
            compressor.attack.setValueAtTime(v, context.currentTime);
            break;
          case "release":
            compressor.release.setValueAtTime(v, context.currentTime);
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
      },

      disable(): void {
        this.enabled = false;
      },

      cleanup(): void {
        try {
          (compressor as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createFilterEffect(id?: string): AudioEffect {
    const context = this.context!;
  const filter = new Tone.Filter({ type: "lowpass", frequency: 1000, Q: 1 });

  // Create dry/wet mixing nodes
  const inputGain = context.createGain();
  const wetGain = context.createGain();
  const dryGain = context.createGain();
  const outputGain = context.createGain();

  // Set initial dry/wet balance (100% wet for filter)
  wetGain.gain.value = 1;
  dryGain.gain.value = 0;

  // Connect the network using Tone-aware helper to avoid context mismatches
  this.connectToneEffect(inputGain, filter, wetGain, dryGain, outputGain);

  const inputNode = inputGain;
  const outputNode = outputGain;

    const parameters = new Map<string, EffectParameter>();
    parameters.set("frequency", {
      name: "Frequency",
      value: filter.frequency.value as number,
      min: 20,
      max: 20000,
      unit: "Hz",
      curve: "logarithmic",
    });
    parameters.set("Q", {
      name: "Resonance",  
      value: filter.Q.value as number,
      min: 0.1,
      max: 30,
      unit: "Q",
    });
    parameters.set("type", {
      name: "Type",
      value: 0, // 0=lowpass, 1=highpass, 2=bandpass
      min: 0,
      max: 2,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 1, // Filter is typically 100% wet
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `filter_${Date.now()}`,
      type: EffectType.FILTER,
      name: "Filter",
      enabled: true,
      parameters,
      inputNode,
      outputNode,
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "frequency":
            filter.frequency.setValueAtTime(v, context.currentTime);
            break;
          case "Q":
            filter.Q.setValueAtTime(v, context.currentTime);
            break;
          case "type": {
            const types = ["lowpass", "highpass", "bandpass"];
            const typeIndex = Math.round(v);
            if (typeIndex >= 0 && typeIndex < types.length) {
              filter.type = types[typeIndex] as any;
            }
            break;
          }
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        const wetLevel = this.parameters.get("wetLevel")?.value ?? 1;
        wetGain.gain.setValueAtTime(wetLevel, context.currentTime);
        dryGain.gain.setValueAtTime(1 - wetLevel, context.currentTime);
      },

      disable(): void {
        this.enabled = false;
        wetGain.gain.setValueAtTime(0, context.currentTime);
        dryGain.gain.setValueAtTime(1, context.currentTime);
      },

      cleanup(): void {
        try {
          (filter as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createAutoFilterEffect(id?: string): AudioEffect {
    const context = this.context!;
    console.log("[Effects] Creating AutoFilter effect...");
    const autoFilter = new Tone.AutoFilter(1, 400, 2.6);
    console.log("[Effects] AutoFilter created:", autoFilter, "Tone context state:", Tone.getContext().state);

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();

    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect the network using helper
    this.connectToneEffect(inputGain, autoFilter, wetGain, dryGain, outputGain);

    const parameters = new Map<string, EffectParameter>();
    parameters.set("frequency", {
      name: "Frequency",
      value: 1,
      min: 1,
      max: 20,
      unit: "Hz",
    });
    parameters.set("baseFrequency", {
      name: "Base Frequency",
      value: 400,
      min: 50,
      max: 2000,
      unit: "Hz",
    });
    parameters.set("octaves", {
      name: "Octaves",
      value: 2.6,
      min: 0.5,
      max: 8,
      unit: "",
    });
    parameters.set("type", {
      name: "Filter Type",
      value: 0,
      min: 0,
      max: 2,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `autofilter_${Date.now()}`,
      type: EffectType.AUTOFILTER,
      name: "AutoFilter",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "frequency":
            console.log("[Effects] Setting AutoFilter frequency:", v);
            autoFilter.frequency.setValueAtTime(v, context.currentTime);
            break;
          case "baseFrequency":
            console.log("[Effects] Setting AutoFilter baseFrequency:", v);
            autoFilter.baseFrequency = v;
            break;
          case "octaves":
            console.log("[Effects] Setting AutoFilter octaves:", v);
            autoFilter.octaves = v;
            break;
          case "type": {
            const types = ["lowpass", "highpass", "bandpass"];
            const typeIndex = Math.round(v);
            if (typeIndex >= 0 && typeIndex < types.length) {
              console.log("[Effects] Setting AutoFilter type:", types[typeIndex]);
              // AutoFilter uses filter.type, not the effect itself
              autoFilter.filter.type = types[typeIndex] as any;
            }
            break;
          }
          case "wetLevel":
            console.log("[Effects] Setting AutoFilter wetLevel:", v);
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        console.log("[Effects] Enabling AutoFilter, starting...");
        autoFilter.start();
        console.log("[Effects] AutoFilter started");
      },

      disable(): void {
        this.enabled = false;
        autoFilter.stop();
      },

      cleanup(): void {
        try {
          (autoFilter as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createAutoPannerEffect(id?: string): AudioEffect {
    const context = this.context!;
    const autoPanner = new Tone.AutoPanner({
      frequency: 1,
      depth: 1
    });

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();
    
    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect using helper (input is now stereo from channel converter)
    this.connectToneEffect(inputGain, autoPanner, wetGain, dryGain, outputGain);
    console.log("[Effects] AutoPanner connected - will pan stereo signal");

    const parameters = new Map<string, EffectParameter>();
    parameters.set("frequency", {
      name: "Frequency",
      value: 1,
      min: 0.1,
      max: 20,
      unit: "Hz",
    });
    parameters.set("depth", {
      name: "Depth",
      value: 1,
      min: 0,
      max: 1,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `autopanner_${Date.now()}`,
      type: EffectType.AUTOPANNER,
      name: "AutoPanner",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "frequency":
            autoPanner.frequency.setValueAtTime(v, context.currentTime);
            break;
          case "depth":
            autoPanner.depth.setValueAtTime(v, context.currentTime);
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        autoPanner.start();
      },

      disable(): void {
        this.enabled = false;
        autoPanner.stop();
      },

      cleanup(): void {
        try {
          (autoPanner as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createAutoWahEffect(id?: string): AudioEffect {
    const context = this.context!;
    const autoWah = new Tone.AutoWah({
      baseFrequency: 100,
      octaves: 6,
      sensitivity: 0,
      Q: 2
    });

    // AutoWah is an analysis-based effect that doesn't need explicit starting

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();

    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect the network using the helper
    this.connectToneEffect(inputGain, autoWah, wetGain, dryGain, outputGain);

    const parameters = new Map<string, EffectParameter>();
    parameters.set("baseFrequency", {
      name: "Base Frequency",
      value: 100,
      min: 50,
      max: 1000,
      unit: "Hz",
    });
    parameters.set("octaves", {
      name: "Octaves",
      value: 6,
      min: 1,
      max: 8,
      unit: "",
    });
    parameters.set("sensitivity", {
      name: "Sensitivity",
      value: 0,
      min: -40,
      max: 0,
      unit: "dB",
    });
    parameters.set("Q", {
      name: "Q",
      value: 2,
      min: 0.1,
      max: 30,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `autowah_${Date.now()}`,
      type: EffectType.AUTOWAH,
      name: "AutoWah",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "baseFrequency":
            autoWah.baseFrequency = v;
            break;
          case "octaves":
            autoWah.octaves = v;
            break;
          case "sensitivity":
            autoWah.sensitivity = v;
            break;
          case "Q":
            autoWah.Q.setValueAtTime(v, context.currentTime);
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
      },

      disable(): void {
        this.enabled = false;
      },

      cleanup(): void {
        try {
          (autoWah as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createBitCrusherEffect(id?: string): AudioEffect {
    const context = this.context!;
    let bitCrusher = new Tone.BitCrusher(8);

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();

    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect the network using the helper
    this.connectToneEffect(inputGain, bitCrusher, wetGain, dryGain, outputGain);

    const parameters = new Map<string, EffectParameter>();
    parameters.set("bits", {
      name: "Bits",
      value: 8,
      min: 1,
      max: 16,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `bitcrusher_${Date.now()}`,
      type: EffectType.BITCRUSHER,
      name: "BitCrusher",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "bits":
            // BitCrusher bits needs recreation - disconnect old, create new
            try {
              (bitCrusher.output as any).disconnect();
              inputGain.disconnect(bitCrusher.input as any);
              (bitCrusher as any).dispose?.();
              
              // Create new BitCrusher with new bits value
              bitCrusher = new Tone.BitCrusher(Math.round(v));
              
              // Reconnect using the helper
              EffectsFactory.connectToneEffect(inputGain, bitCrusher, wetGain, dryGain, outputGain);
            } catch (error) {
              console.warn('[BitCrusher] Failed to update bits parameter:', error);
            }
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
      },

      disable(): void {
        this.enabled = false;
      },

      cleanup(): void {
        try {
          (bitCrusher as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createChorusEffect(id?: string): AudioEffect {
    const context = this.context!;
    console.log("[Effects] Creating Chorus effect...");
    const chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      spread: 180
    });
    console.log("[Effects] Chorus created:", chorus, "Tone context state:", Tone.getContext().state);

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();
    
    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect using helper (input is now stereo from channel converter)
    this.connectToneEffect(inputGain, chorus, wetGain, dryGain, outputGain);
    console.log("[Effects] Chorus connected - stereo spread will work with stereo input");

    const parameters = new Map<string, EffectParameter>();
    parameters.set("frequency", {
      name: "Frequency",
      value: 1.5,
      min: 0.01,
      max: 20,
      unit: "Hz",
    });
    parameters.set("delayTime", {
      name: "Delay Time",
      value: 3.5,
      min: 1,
      max: 20,
      unit: "ms",
    });
    parameters.set("depth", {
      name: "Depth",
      value: 0.7,
      min: 0,
      max: 1,
      unit: "",
    });
    parameters.set("spread", {
      name: "Spread",
      value: 180,
      min: 0,
      max: 180,
      unit: "°",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `chorus_${Date.now()}`,
      type: EffectType.CHORUS,
      name: "Chorus",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "frequency":
            chorus.frequency.setValueAtTime(v, context.currentTime);
            break;
          case "delayTime":
            chorus.delayTime = v;
            break;
          case "depth":
            chorus.depth = v;
            break;
          case "spread":
            chorus.spread = v;
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        console.log("[Effects] Enabling Chorus, starting...");
        chorus.start();
        console.log("[Effects] Chorus started");
      },

      disable(): void {
        this.enabled = false;
        chorus.stop();
      },

      cleanup(): void {
        try {
          (chorus as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createDistortionEffect(id?: string): AudioEffect {
    const context = this.context!;
    const distortion = new Tone.Distortion({
      distortion: 0.4,
      oversample: "none"
    });

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();

    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect the network using the helper
    this.connectToneEffect(inputGain, distortion, wetGain, dryGain, outputGain);

    const parameters = new Map<string, EffectParameter>();
    parameters.set("distortion", {
      name: "Distortion",
      value: 0.4,
      min: 0,
      max: 1,
      unit: "",
    });
    parameters.set("oversample", {
      name: "Oversample",
      value: 0,
      min: 0,
      max: 2,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `distortion_${Date.now()}`,
      type: EffectType.DISTORTION,
      name: "Distortion",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "distortion":
            distortion.distortion = v;
            break;
          case "oversample": {
            const oversampleModes = ["none", "2x", "4x"];
            const modeIndex = Math.round(v);
            if (modeIndex >= 0 && modeIndex < oversampleModes.length) {
              distortion.oversample = oversampleModes[modeIndex] as any;
            }
            break;
          }
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
      },

      disable(): void {
        this.enabled = false;
      },

      cleanup(): void {
        try {
          (distortion as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createPhaserEffect(id?: string): AudioEffect {
    const context = this.context!;
    const phaser = new Tone.Phaser({
      frequency: 0.5,
      octaves: 3,
      baseFrequency: 350,
      stages: 4,
      Q: 10
    });

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();

    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect the network using the helper
    this.connectToneEffect(inputGain, phaser, wetGain, dryGain, outputGain);

    const parameters = new Map<string, EffectParameter>();
    parameters.set("frequency", {
      name: "Frequency",
      value: 0.5,
      min: 0.01,
      max: 10,
      unit: "Hz",
    });
    parameters.set("octaves", {
      name: "Octaves",
      value: 3,
      min: 0.5,
      max: 8,
      unit: "",
    });
    parameters.set("baseFrequency", {
      name: "Base Frequency",
      value: 350,
      min: 50,
      max: 2000,
      unit: "Hz",
    });
    parameters.set("stages", {
      name: "Stages",
      value: 4,
      min: 2,
      max: 8,
      unit: "",
    });
    parameters.set("Q", {
      name: "Q",
      value: 10,
      min: 0.1,
      max: 30,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `phaser_${Date.now()}`,
      type: EffectType.PHASER,
      name: "Phaser",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "frequency":
            phaser.frequency.setValueAtTime(v, context.currentTime);
            break;
          case "octaves":
            phaser.octaves = v;
            break;
          case "baseFrequency":
            phaser.baseFrequency = v;
            break;
          case "stages":
            // Phaser stages is read-only, store value for reference
            break;
          case "Q":
            phaser.Q.setValueAtTime(v, context.currentTime);
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        // Restore wet/dry balance
        const wetLevel = this.parameters.get("wetLevel")?.value || 0.5;
        wetGain.gain.setValueAtTime(wetLevel, context.currentTime);
        dryGain.gain.setValueAtTime(1 - wetLevel, context.currentTime);
      },

      disable(): void {
        this.enabled = false;
        // Bypass: full dry, no wet signal
        wetGain.gain.setValueAtTime(0, context.currentTime);
        dryGain.gain.setValueAtTime(1, context.currentTime);
      },

      cleanup(): void {
        try {
          (phaser as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createPingPongDelayEffect(id?: string): AudioEffect {
    const context = this.context!;
    const pingPongDelay = new Tone.PingPongDelay({
      delayTime: 0.25,
      feedback: 0.3
    });

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();
    
    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect using helper (input is now stereo from channel converter)
    this.connectToneEffect(inputGain, pingPongDelay, wetGain, dryGain, outputGain);
    console.log("[Effects] PingPongDelay connected - will ping-pong between stereo channels");

    const parameters = new Map<string, EffectParameter>();
    parameters.set("delayTime", {
      name: "Delay Time",
      value: 0.25,
      min: 0.01,
      max: 1,
      unit: "s",
    });
    parameters.set("feedback", {
      name: "Feedback",
      value: 0.3,
      min: 0,
      max: 0.95,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `pingpongdelay_${Date.now()}`,
      type: EffectType.PINGPONGDELAY,
      name: "Ping Pong Delay",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "delayTime":
            pingPongDelay.delayTime.setValueAtTime(v, context.currentTime);
            break;
          case "feedback":
            pingPongDelay.feedback.setValueAtTime(v, context.currentTime);
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
      },

      disable(): void {
        this.enabled = false;
      },

      cleanup(): void {
        try {
          (pingPongDelay as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createStereoWidenerEffect(id?: string): AudioEffect {
    const context = this.context!;
    const stereoWidener = new Tone.StereoWidener(0.5);

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();

    // Create stereo enhancement components for mono-to-stereo conversion
    const splitter = context.createChannelSplitter(2);
    const merger = context.createChannelMerger(2);
    const leftDelay = context.createDelay(0.1);
    const rightDelay = context.createDelay(0.1);
    
    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Set subtle delays for stereo width enhancement (Haas effect)
    leftDelay.delayTime.value = 0.001; // 1ms delay on left
    rightDelay.delayTime.value = 0.002; // 2ms delay on right

    // Enhanced stereo routing
    try {
      // Split mono input into stereo channels with slight delays
      inputGain.connect(splitter);
      splitter.connect(leftDelay, 0, 0);
      splitter.connect(rightDelay, 0, 0);
      
      // Merge delays back to stereo for widener processing
      leftDelay.connect(merger, 0, 0);
      rightDelay.connect(merger, 0, 1);
      
      // Process through stereo widener
      merger.connect(stereoWidener.input as any);
      (stereoWidener.output as any).connect(wetGain);
      
      // Dry path with stereo split
      inputGain.connect(dryGain);
      
      // Mix dry and wet to output
      dryGain.connect(outputGain);
      wetGain.connect(outputGain);
      
      console.log("[Effects] StereoWidener connected with mono-to-stereo enhancement");
    } catch (error) {
      console.error("[Effects] Failed to connect StereoWidener with enhancement:", error);
      // Fallback to helper method
      this.connectToneEffect(inputGain, stereoWidener, wetGain, dryGain, outputGain);
    }

    const parameters = new Map<string, EffectParameter>();
    parameters.set("width", {
      name: "Width",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `stereowidener_${Date.now()}`,
      type: EffectType.STEREOWIDENER,
      name: "Stereo Widener",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "width":
            stereoWidener.width.setValueAtTime(v, context.currentTime);
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
      },

      disable(): void {
        this.enabled = false;
      },

      cleanup(): void {
        try {
          (stereoWidener as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createTremoloEffect(id?: string): AudioEffect {
    const context = this.context!;
    const tremolo = new Tone.Tremolo({
      frequency: 10,
      depth: 0.5,
      spread: 40
    });

    // Start the tremolo LFO immediately
    tremolo.start();

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();

    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect the network using the helper
    this.connectToneEffect(inputGain, tremolo, wetGain, dryGain, outputGain);

    const parameters = new Map<string, EffectParameter>();
    parameters.set("frequency", {
      name: "Frequency",
      value: 10,
      min: 0.1,
      max: 20,
      unit: "Hz",
    });
    parameters.set("depth", {
      name: "Depth",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "",
    });
    parameters.set("spread", {
      name: "Spread",
      value: 40,
      min: 0,
      max: 180,
      unit: "°",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `tremolo_${Date.now()}`,
      type: EffectType.TREMOLO,
      name: "Tremolo",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "frequency":
            tremolo.frequency.setValueAtTime(v, context.currentTime);
            break;
          case "depth":
            tremolo.depth.setValueAtTime(v, context.currentTime);
            break;
          case "spread":
            tremolo.spread = v;
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        tremolo.start();
      },

      disable(): void {
        this.enabled = false;
        tremolo.stop();
      },

      cleanup(): void {
        try {
          (tremolo as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  private static createVibratoEffect(id?: string): AudioEffect {
    const context = this.context!;
    const vibrato = new Tone.Vibrato({
      frequency: 5,
      depth: 0.1
    });

    // Note: Vibrato is automatically active when created

    // Create dry/wet mixing nodes
    const inputGain = context.createGain();
    const wetGain = context.createGain();
    const dryGain = context.createGain();
    const outputGain = context.createGain();

    // Set initial dry/wet balance
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    // Connect the network using the helper
    this.connectToneEffect(inputGain, vibrato, wetGain, dryGain, outputGain);

    const parameters = new Map<string, EffectParameter>();
    parameters.set("frequency", {
      name: "Frequency",
      value: 5,
      min: 0.1,
      max: 20,
      unit: "Hz",
    });
    parameters.set("depth", {
      name: "Depth",
      value: 0.1,
      min: 0,
      max: 1,
      unit: "",
    });
    parameters.set("wetLevel", {
      name: "Wet Level",
      value: 0.5,
      min: 0,
      max: 1,
      unit: "%",
    });

    return {
      id: id || `vibrato_${Date.now()}`,
      type: EffectType.VIBRATO,
      name: "Vibrato",
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
        const v = Math.max(param.min, Math.min(param.max, value));
        param.value = v;
        switch (name) {
          case "frequency":
            vibrato.frequency.setValueAtTime(v, context.currentTime);
            break;
          case "depth":
            vibrato.depth.setValueAtTime(v, context.currentTime);
            break;
          case "wetLevel":
            wetGain.gain.setValueAtTime(v, context.currentTime);
            dryGain.gain.setValueAtTime(1 - v, context.currentTime);
            break;
        }
      },

      getParameter(name: string): number | undefined {
        return this.parameters.get(name)?.value;
      },

      enable(): void {
        this.enabled = true;
        // Vibrato doesn't have start/stop methods
      },

      disable(): void {
        this.enabled = false;
        // Vibrato doesn't have start/stop methods
      },

      cleanup(): void {
        try {
          (vibrato as any).dispose?.();
          inputGain.disconnect();
          wetGain.disconnect();
          dryGain.disconnect();
          outputGain.disconnect();
        } catch {
          // ignore
        }
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
    this.initializeAsync(audioContext);
  }

  private async initializeAsync(audioContext: AudioContext): Promise<void> {
    await EffectsFactory.initialize(audioContext);
    // Ensure Tone uses the same context
    try {
      if (Tone.getContext().rawContext !== audioContext) {
        Tone.setContext(audioContext);
      }
    } catch {
      // ignore
    }
  }

  // Expose the underlying AudioContext for sanity checks
  public getAudioContext(): AudioContext {
    return this.context;
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
   * Create a mono-to-stereo converter using Haas effect for natural stereo width
   * This converts mono instrument signals to true stereo for proper stereo effect processing
   */
  private createMonoToStereoConverter(): { input: GainNode; output: GainNode } {
    // Input gain node
    const inputGain = this.context.createGain();
    
    // Create stereo splitter and merger
    const splitter = this.context.createChannelSplitter(2);
    const merger = this.context.createChannelMerger(2);
    
    // Create subtle delays for Haas effect (psychoacoustic stereo widening)
    const leftDelay = this.context.createDelay(0.1);
    const rightDelay = this.context.createDelay(0.1);
    
    // Set subtle delays (1-2ms creates stereo width without noticeable delay)
    leftDelay.delayTime.value = 0.0005;  // 0.5ms on left
    rightDelay.delayTime.value = 0.0015; // 1.5ms on right
    
    // Create slight gain differences for additional width
    const leftGain = this.context.createGain();
    const rightGain = this.context.createGain();
    leftGain.gain.value = 1.0;   // Full volume left
    rightGain.gain.value = 0.95; // Slightly quieter right
    
    // Output gain node
    const outputGain = this.context.createGain();
    
    // Connect the chain:
    // Mono input -> split to two identical channels
    inputGain.connect(splitter);
    
    // Left channel path: split[0] -> leftDelay -> leftGain -> merger[0]
    splitter.connect(leftDelay, 0);
    leftDelay.connect(leftGain);
    leftGain.connect(merger, 0, 0);
    
    // Right channel path: split[0] -> rightDelay -> rightGain -> merger[1]
    splitter.connect(rightDelay, 0);
    rightDelay.connect(rightGain);
    rightGain.connect(merger, 0, 1);
    
    // Merge to stereo output
    merger.connect(outputGain);
    
    console.log('[MixerEngine] Created mono-to-stereo converter with Haas effect');
    
    return { input: inputGain, output: outputGain };
  }

  /**
   * Create a user channel
   */
  createUserChannel(userId: string, username: string): UserChannel {
    const nodePool = AudioContextManager.getNodePool();
    // Native preGain bridge for incoming sources
    const inputGain = nodePool?.getGainNode() || this.context.createGain();

    // Create mono-to-stereo converter for proper stereo effect processing
    // This ensures all instruments (which are mono) get converted to true stereo
    const monoToStereo = this.createMonoToStereoConverter();
    
    // Connect input to mono-to-stereo converter
    inputGain.connect(monoToStereo.input);

    // Create Tone channel with pan/volume
    const toneChannel = new Tone.Channel({ volume: 0, pan: 0 });
    // Route Tone channel to master bus destination
    const masterBus = AudioContextManager.getMasterBus();
    if (masterBus) {
      // Connect Tone node to native master gain
      toneChannel.connect(masterBus.getMasterGain());
    } else {
      toneChannel.toDestination();
    }

    // Connect mono-to-stereo output into Tone channel using Tone.connect for cross-type safety
    try {
      // Prefer Tone.connect to bridge AudioNode <-> ToneAudioNode
      (Tone as any).connect?.(monoToStereo.output as any, toneChannel as any);
    } catch {
      // Fallback: bridge via a Tone.Gain in correct direction
      const bridge = new Tone.Gain(1);
      try {
        // monoToStereo.output -> bridge.input -> bridge -> toneChannel
        monoToStereo.output.connect((bridge as any).input ?? (bridge as any));
      } catch {
        // Last resort: connect native to native if available
        try { monoToStereo.output.connect((toneChannel as any).input); } catch { /* ignore */ }
      }
      bridge.connect(toneChannel);
    }

    // Tone analyser for metering (post-channel)
    const analyser = new Tone.Analyser({ type: "waveform", size: 256, smoothing: 0.85 });
    toneChannel.connect(analyser);

    const channel: UserChannel = {
      userId,
      username,
      inputGain,
      toneChannel,
      effectChain: [],
      soloMute: { solo: false, mute: false },
      sends: new Map(),
      analyser,
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

    // Add effect to chain
    channel.effectChain.push(effect);

    // Rebuild the entire audio chain
    this.rebuildChannelChain(channel);

    return effect;
  }

  private resolveEffectType(effectType: string): EffectType | null {
    const normalized = effectType.toLowerCase();
    const match = Object.values(EffectType).find(
      (value) => value.toLowerCase() === normalized,
    );
    return match ?? null;
  }

  applyEffectChainState(
    userId: string,
    effects: EffectInstanceState[],
    options?: { username?: string; createIfMissing?: boolean },
  ): void {
    let channel = this.userChannels.get(userId);
    if (!channel) {
      if (options?.createIfMissing === false) {
        return;
      }
      const username = options?.username || userId;
      channel = this.createUserChannel(userId, username);
    } else if (options?.username && channel.username !== options.username) {
      channel.username = options.username;
    }

    if (!channel) return;

    // Release existing effects to pool before rebuilding
    channel.effectChain.forEach((effect) => EffectsFactory.releaseEffect(effect));
    channel.effectChain = [];

    const sortedEffects = [...effects].sort((a, b) => a.order - b.order);

    for (const effectState of sortedEffects) {
      const effectType = this.resolveEffectType(effectState.type);
      if (!effectType) {
        console.warn(
          `[MixerEngine] Unknown effect type received for user ${userId}:`,
          effectState.type,
        );
        continue;
      }

      const effect = EffectsFactory.createEffect(effectType, effectState.id);
      if (!effect) {
        console.warn(
          `[MixerEngine] Failed to instantiate effect ${effectState.type} for user ${userId}`,
        );
        continue;
      }

      // Apply parameter state
      for (const parameter of effectState.parameters || []) {
        try {
          const normalizedName = normalizeParamName(parameter.name);
          const mappedName =
            EFFECT_PARAMETER_NAME_MAP[effectState.type]?.[normalizedName] ??
            parameter.name;
          effect.setParameter(mappedName, parameter.value);
        } catch (error) {
          console.warn(
            `[MixerEngine] Failed to set parameter ${parameter.name} on effect ${effectState.id}:`,
            error,
          );
        }
      }

      // Handle bypass status
      if (effectState.bypassed) {
        effect.disable();
      } else {
        effect.enable();
      }

      channel.effectChain.push(effect);
    }

    this.rebuildChannelChain(channel);
  }

  removeUserChannel(userId: string): void {
    const channel = this.userChannels.get(userId);
    if (!channel) return;

    channel.effectChain.forEach((effect) => EffectsFactory.releaseEffect(effect));

    try {
      channel.inputGain.disconnect();
    } catch {
      // ignore
    }

    try {
      (channel.toneChannel as any)?.disconnect?.();
      (channel.toneChannel as any)?.dispose?.();
    } catch {
      // ignore
    }

    try {
      (channel.analyser as any)?.dispose?.();
    } catch {
      // ignore
    }

    this.userChannels.delete(userId);
  }

  /**
   * Remove effect from user channel
   */
  removeEffectFromChannel(userId: string, effectId: string): boolean {
    const channel = this.userChannels.get(userId);
    if (!channel) return false;

    const effectIndex = channel.effectChain.findIndex(fx => fx.id === effectId);
    if (effectIndex === -1) return false;

    // Remove effect from chain
    const [removedEffect] = channel.effectChain.splice(effectIndex, 1);
    
    // Clean up the removed effect
    try {
      removedEffect.cleanup();
    } catch (error) {
      console.warn('Error cleaning up effect:', error);
    }

    // Rebuild the audio chain
    this.rebuildChannelChain(channel);

    return true;
  }

  /**
   * Rebuild the audio chain for a channel
   */
  private rebuildChannelChain(channel: UserChannel): void {
    try {
      // Disconnect all current connections
      channel.inputGain.disconnect();
      
      // If no effects, connect directly to toneChannel
      if (channel.effectChain.length === 0) {
        try {
          // Use Tone.connect for better compatibility
          (Tone as any).connect(channel.inputGain, channel.toneChannel);
        } catch (error) {
          console.warn('Failed to connect inputGain directly to toneChannel:', error);
        }
        return;
      }

      // Chain nodes: inputGain -> effect1 -> effect2 -> ... -> toneChannel
      let current: any = channel.inputGain;
      
      for (const effect of channel.effectChain) {
        try {
          // Use Tone.connect for Tone.js effects
          (Tone as any).connect(current, effect.inputNode);
          current = effect.outputNode;
        } catch (error) {
          console.warn('Failed to connect effect in chain:', error);
        }
      }
      
      // Connect the final output to the tone channel
      try {
        // Use Tone.connect for better compatibility with Tone.js nodes
        (Tone as any).connect(current, channel.toneChannel);
      } catch (error) {
        console.warn('Failed to connect final effect to toneChannel:', error);
      }
    } catch (error) {
      console.error('Error rebuilding channel chain:', error);
    }
  }

  /**
   * Route instrument to user channel
   */
  routeInstrumentToChannel(instrumentOutput: AudioNode, userId: string): void {
    const channel = this.userChannels.get(userId);
    if (!channel) return;
    // Route instrument output into preGain bridge
    try {
      // Use Tone.connect to handle ToneAudioNode -> AudioNode or vice versa
      (Tone as any).connect?.(instrumentOutput as any, channel.inputGain as any);
    } catch {
      try { (instrumentOutput as any).connect?.(channel.inputGain as any); } catch { /* ignore */ }
    }
  }

  /**
   * Get channel for user
   */
  getChannel(userId: string): UserChannel | undefined {
    return this.userChannels.get(userId);
  }

  /**
   * Set per-user output volume (0..~4 for +12dB boost)
   */
  setUserVolume(userId: string, volume: number): void {
    const channel = this.userChannels.get(userId);
    if (!channel) return;
    // Expected volume is linear (0..~4). Convert to dB for Tone.Channel
    const clamped = Math.max(0, Math.min(4, volume));
    const db = clamped === 0 ? -Infinity : 20 * Math.log10(clamped);
    try {
      channel.toneChannel?.volume.setValueAtTime(db, this.context.currentTime);
    } catch {
    // Fallback: adjust preGain as last resort
    channel.inputGain.gain.setValueAtTime(clamped, this.context.currentTime);
    }
  }

  /**
   * Get per-user output volume
   */
  getUserVolume(userId: string): number | null {
    const channel = this.userChannels.get(userId);
    if (!channel) return null;
    // Prefer Tone channel's dB volume converted back to linear gain
    if (channel.toneChannel) {
      const db = channel.toneChannel.volume.value as number;
      if (!isFinite(db)) return 0; // -Infinity dB => silence
      const lin = Math.pow(10, db / 20);
      return lin;
    }
  // Fallback to preGain (approximate)
  return channel.inputGain.gain.value;
  }

  /**
   * Get approximate output level (RMS) for user [0..1]
   */
  getUserOutputLevel(userId: string): number | null {
    const channel = this.userChannels.get(userId);
    if (!channel || !channel.analyser) return null;
    try {
      const values = channel.analyser.getValue() as Float32Array;
      if (!values || values.length === 0) return 0;
      let sum = 0;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        sum += v * v;
      }
      const rms = Math.sqrt(sum / values.length);
      return Math.max(0, Math.min(1, rms));
  } catch {
      return null;
    }
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
  try { channel.inputGain.disconnect(); } catch { /* ignore */ }
  try { (channel.toneChannel as any)?.dispose?.(); } catch { /* ignore */ }
  try { (channel.analyser as any)?.dispose?.(); } catch { /* ignore */ }
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

// Singleton accessors for app-wide mixer instance
let __globalMixer: MixerEngine | null = null;

export async function getOrCreateGlobalMixer(): Promise<MixerEngine> {
  const context = await AudioContextManager.getInstrumentContext();
  // If a mixer exists but its context differs (e.g., Safari recreated context), rebuild it
  if (__globalMixer) {
    try {
      if (__globalMixer.getAudioContext() !== context) {
        __globalMixer.cleanup();
        __globalMixer = new MixerEngine(context);
      }
    } catch {
      // If anything goes wrong, recreate
      __globalMixer = new MixerEngine(context);
    }
    return __globalMixer;
  }
  __globalMixer = new MixerEngine(context);
  return __globalMixer;
}

export function getGlobalMixer(): MixerEngine | null {
  return __globalMixer;
}

// Allow callers to force-recreate the mixer on next access
export function resetGlobalMixer(): void {
  if (__globalMixer) {
    try {
      __globalMixer.cleanup();
    } catch {
      // ignore cleanup errors during reset
    }
  }
  __globalMixer = null;
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
