import * as Tone from "tone";

export interface EffectState {
  reverbEnabled: boolean;
  reverbDecay: number;
  reverbWetness: number;
  
  delayEnabled: boolean;
  delayTime: number;
  delayFeedback: number;
  delayWetness: number;
  
  chorusEnabled: boolean;
  chorusFrequency: number;
  chorusDepth: number;
  chorusWetness: number;
  
  distortionEnabled: boolean;
  distortionAmount: number;
  
  filterEnabled: boolean;
  filterFrequency: number;
  filterResonance: number;
  filterType: "lowpass" | "highpass" | "bandpass";
}

export const defaultEffectState: EffectState = {
  reverbEnabled: false,
  reverbDecay: 1.5,
  reverbWetness: 0.3,
  
  delayEnabled: false,
  delayTime: 0.25,
  delayFeedback: 0.3,
  delayWetness: 0.3,
  
  chorusEnabled: false,
  chorusFrequency: 1.5,
  chorusDepth: 0.7,
  chorusWetness: 0.5,
  
  distortionEnabled: false,
  distortionAmount: 0.4,
  
  filterEnabled: false,
  filterFrequency: 1000,
  filterResonance: 1,
  filterType: "lowpass",
};

export class EffectsChain {
  private reverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private chorus: Tone.Chorus;
  private distortion: Tone.Distortion;
  private filter: Tone.Filter;
  private wetGain: Tone.Gain;
  private dryGain: Tone.Gain;
  private output: Tone.Gain;
  
  constructor() {
    // Initialize effects
    this.reverb = new Tone.Reverb({
      decay: defaultEffectState.reverbDecay,
      wet: 0,
    });
    
    this.delay = new Tone.FeedbackDelay({
      delayTime: defaultEffectState.delayTime,
      feedback: defaultEffectState.delayFeedback,
      wet: 0,
    });
    
    this.chorus = new Tone.Chorus({
      frequency: defaultEffectState.chorusFrequency,
      depth: defaultEffectState.chorusDepth,
      wet: 0,
    });
    
    this.distortion = new Tone.Distortion({
      distortion: defaultEffectState.distortionAmount,
      wet: 0,
    });
    
    this.filter = new Tone.Filter({
      frequency: defaultEffectState.filterFrequency,
      Q: defaultEffectState.filterResonance,
      type: defaultEffectState.filterType,
    });
    
    this.wetGain = new Tone.Gain(0);
    this.dryGain = new Tone.Gain(1);
    this.output = new Tone.Gain(1);
    
    // Connect effects chain
    this.connectEffects();
  }
  
  private connectEffects() {
    // Create parallel wet/dry signal paths
    this.filter.connect(this.distortion);
    this.distortion.connect(this.chorus);
    this.chorus.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
  }
  
  public connect(destination: Tone.InputNode) {
    this.output.connect(destination);
    return this;
  }
  
  public getInput() {
    // Split signal to wet and dry paths
    const splitter = new Tone.Gain(1);
    splitter.connect(this.filter);
    splitter.connect(this.dryGain);
    return splitter;
  }
  
  public updateEffects(effectState: Partial<EffectState>) {
    // Update reverb
    if (effectState.reverbEnabled !== undefined) {
      this.reverb.wet.value = effectState.reverbEnabled ? (effectState.reverbWetness || defaultEffectState.reverbWetness) : 0;
    }
    if (effectState.reverbDecay !== undefined) {
      this.reverb.decay = effectState.reverbDecay;
    }
    if (effectState.reverbWetness !== undefined && effectState.reverbEnabled) {
      this.reverb.wet.value = effectState.reverbWetness;
    }
    
    // Update delay
    if (effectState.delayEnabled !== undefined) {
      this.delay.wet.value = effectState.delayEnabled ? (effectState.delayWetness || defaultEffectState.delayWetness) : 0;
    }
    if (effectState.delayTime !== undefined) {
      this.delay.delayTime.value = effectState.delayTime;
    }
    if (effectState.delayFeedback !== undefined) {
      this.delay.feedback.value = effectState.delayFeedback;
    }
    if (effectState.delayWetness !== undefined && effectState.delayEnabled) {
      this.delay.wet.value = effectState.delayWetness;
    }
    
    // Update chorus
    if (effectState.chorusEnabled !== undefined) {
      this.chorus.wet.value = effectState.chorusEnabled ? (effectState.chorusWetness || defaultEffectState.chorusWetness) : 0;
    }
    if (effectState.chorusFrequency !== undefined) {
      this.chorus.frequency.value = effectState.chorusFrequency;
    }
    if (effectState.chorusDepth !== undefined) {
      this.chorus.depth = effectState.chorusDepth;
    }
    if (effectState.chorusWetness !== undefined && effectState.chorusEnabled) {
      this.chorus.wet.value = effectState.chorusWetness;
    }
    
    // Update distortion
    if (effectState.distortionEnabled !== undefined) {
      this.distortion.wet.value = effectState.distortionEnabled ? 1 : 0;
    }
    if (effectState.distortionAmount !== undefined) {
      this.distortion.distortion = effectState.distortionAmount;
    }
    
    // Update filter
    if (effectState.filterEnabled !== undefined) {
      // Filter is always in the chain, but we can bypass it
      this.filter.frequency.value = effectState.filterEnabled ? 
        (effectState.filterFrequency || defaultEffectState.filterFrequency) : 20000;
    }
    if (effectState.filterFrequency !== undefined && effectState.filterEnabled) {
      this.filter.frequency.value = effectState.filterFrequency;
    }
    if (effectState.filterResonance !== undefined) {
      this.filter.Q.value = effectState.filterResonance;
    }
    if (effectState.filterType !== undefined) {
      this.filter.type = effectState.filterType;
    }
  }
  
  public dispose() {
    this.reverb.dispose();
    this.delay.dispose();
    this.chorus.dispose();
    this.distortion.dispose();
    this.filter.dispose();
    this.wetGain.dispose();
    this.dryGain.dispose();
    this.output.dispose();
  }
} 