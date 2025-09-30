import { EffectType as AudioEffectType } from '@/features/audio/utils/effectsArchitecture';

export const EFFECT_TYPE_MAP: Record<string, AudioEffectType> = {
  reverb: AudioEffectType.REVERB,
  delay: AudioEffectType.DELAY,
  compressor: AudioEffectType.COMPRESSOR,
  filter: AudioEffectType.FILTER,
  distortion: AudioEffectType.DISTORTION,
  chorus: AudioEffectType.CHORUS,
  autofilter: AudioEffectType.AUTOFILTER,
  autopanner: AudioEffectType.AUTOPANNER,
  autowah: AudioEffectType.AUTOWAH,
  bitcrusher: AudioEffectType.BITCRUSHER,
  phaser: AudioEffectType.PHASER,
  pingpongdelay: AudioEffectType.PINGPONGDELAY,
  stereowidener: AudioEffectType.STEREOWIDENER,
  tremolo: AudioEffectType.TREMOLO,
  vibrato: AudioEffectType.VIBRATO,
};

export const PARAMETER_MAP: Record<string, Record<string, string>> = {
  reverb: {
    room_size: 'roomSize',
    decay_time: 'decayTime',
    pre_delay: 'preDelay',
    dry_wet: 'wetLevel',
  },
  delay: {
    time: 'delayTime',
    feedback: 'feedback',
    dry_wet: 'wetLevel',
  },
  compressor: {
    threshold: 'threshold',
    ratio: 'ratio',
    attack: 'attack',
    release: 'release',
    dry_wet: 'wetLevel',
  },
  filter: {
    frequency: 'frequency',
    resonance: 'Q',
    type: 'type',
    dry_wet: 'wetLevel',
  },
  autofilter: {
    frequency: 'frequency',
    base_frequency: 'baseFrequency',
    octaves: 'octaves',
    filter_type: 'type',
    dry_wet: 'wetLevel',
  },
  autopanner: {
    frequency: 'frequency',
    depth: 'depth',
    dry_wet: 'wetLevel',
  },
  autowah: {
    base_frequency: 'baseFrequency',
    octaves: 'octaves',
    sensitivity: 'sensitivity',
    q: 'Q',
    dry_wet: 'wetLevel',
  },
  bitcrusher: {
    bits: 'bits',
    dry_wet: 'wetLevel',
  },
  chorus: {
    frequency: 'frequency',
    delay_time: 'delayTime',
    depth: 'depth',
    spread: 'spread',
    dry_wet: 'wetLevel',
  },
  distortion: {
    distortion: 'distortion',
    oversample: 'oversample',
    dry_wet: 'wetLevel',
  },
  phaser: {
    frequency: 'frequency',
    octaves: 'octaves',
    base_frequency: 'baseFrequency',
    stages: 'stages',
    q: 'Q',
    dry_wet: 'wetLevel',
  },
  pingpongdelay: {
    delay_time: 'delayTime',
    feedback: 'feedback',
    dry_wet: 'wetLevel',
  },
  stereowidener: {
    width: 'width',
    dry_wet: 'wetLevel',
  },
  tremolo: {
    frequency: 'frequency',
    depth: 'depth',
    spread: 'spread',
    dry_wet: 'wetLevel',
  },
  vibrato: {
    frequency: 'frequency',
    depth: 'depth',
    dry_wet: 'wetLevel',
  },
};
