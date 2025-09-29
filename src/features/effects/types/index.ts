// Effects Feature Types

export type EffectType = 
  | 'reverb'
  | 'delay'
  | 'filter'
  | 'compressor'
  | 'autofilter'
  | 'autopanner'
  | 'autowah'
  | 'bitcrusher'
  | 'chorus'
  | 'distortion'
  | 'phaser'
  | 'pingpongdelay'
  | 'stereowidener'
  | 'tremolo'
  | 'vibrato';

export type EffectChainType = 'virtual_instrument' | 'audio_voice_input';

export interface EffectParameter {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  type: 'knob' | 'slider';
  unit?: string;
  curve?: 'linear' | 'logarithmic';
}

export interface EffectInstance {
  id: string;
  type: EffectType;
  name: string;
  bypassed: boolean;
  parameters: EffectParameter[];
  order: number;
}

export interface EffectChain {
  type: EffectChainType;
  effects: EffectInstance[];
}

export interface EffectPreset {
  id: string;
  name: string;
  type: EffectType;
  parameters: Record<string, number>;
}

// Effect configuration for each effect type
export interface EffectConfig {
  type: EffectType;
  name: string;
  icon: string;
  parameters: Omit<EffectParameter, 'id'>[];
  defaultPreset?: EffectPreset;
}
