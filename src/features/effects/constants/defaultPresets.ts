import type { EffectChainPreset } from '../types';

export const DEFAULT_EFFECT_CHAIN_PRESETS: EffectChainPreset[] = [
  {
    id: 'default-reverb-delay-vi',
    name: 'Reverb + Delay',
    chainType: 'virtual_instrument',
    effects: [
      {
        type: 'reverb',
        bypassed: false,
        parameters: {
          'Room Size': 0.5,
          'Decay Time': 5.0,
          'Pre-Delay': 0.03,
          'Dry/Wet': 0.5,
        },
      },
      {
        type: 'delay',
        bypassed: false,
        parameters: {
          'Time': 0.25,
          'Feedback': 0.3,
          'Dry/Wet': 0.3,
        },
      },
    ],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'default-reverb-delay-av',
    name: 'Reverb + Delay',
    chainType: 'audio_voice_input',
    effects: [
      {
        type: 'reverb',
        bypassed: false,
        parameters: {
          'Room Size': 0.5,
          'Decay Time': 5.0,
          'Pre-Delay': 0.03,
          'Dry/Wet': 0.5,
        },
      },
      {
        type: 'delay',
        bypassed: false,
        parameters: {
          'Time': 0.25,
          'Feedback': 0.3,
          'Dry/Wet': 0.3,
        },
      },
    ],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
];
