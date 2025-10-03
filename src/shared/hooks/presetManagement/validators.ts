import type { PresetValidator, PresetValidationContext } from './types';
import type { SynthPreset } from '@/features/instruments/types/presets';
import type { EffectChainPreset } from '@/features/effects/types';
import type { SequencerPreset } from '@/features/sequencer/types';

// Synth Preset Validator
export interface SynthValidationContext extends PresetValidationContext {
  synthType: 'analog' | 'fm';
  polyphony: 'mono' | 'poly';
}

export const synthPresetValidator: PresetValidator<SynthPreset> = {
  validate: (preset: SynthPreset, context: PresetValidationContext) => {
    const ctx = context as SynthValidationContext;
    
    if (!ctx.synthType || !ctx.polyphony) {
      return {
        valid: false,
        message: 'Validation context missing synthType or polyphony',
      };
    }

    const isCompatible =
      preset.synthType === ctx.synthType && preset.polyphony === ctx.polyphony;

    if (!isCompatible) {
      return {
        valid: false,
        message: `Preset is for ${preset.synthType} ${preset.polyphony} synthesizer. Current synthesizer is ${ctx.synthType} ${ctx.polyphony}.`,
      };
    }

    return { valid: true };
  },
};

// Effect Chain Preset Validator
export interface EffectChainValidationContext extends PresetValidationContext {
  chainType: 'virtual_instrument' | 'audio_voice_input';
}

export const effectChainPresetValidator: PresetValidator<EffectChainPreset> = {
  validate: (preset: EffectChainPreset, context: PresetValidationContext) => {
    const ctx = context as EffectChainValidationContext;

    if (!ctx.chainType) {
      return {
        valid: false,
        message: 'Validation context missing chainType',
      };
    }

    const isCompatible = preset.chainType === ctx.chainType;

    if (!isCompatible) {
      return {
        valid: false,
        message: `Preset is for ${preset.chainType} effect chain. Current chain is ${ctx.chainType}.`,
      };
    }

    return { valid: true };
  },
};

// Sequencer Preset Validator
export interface SequencerValidationContext extends PresetValidationContext {
  instrumentCategory: string; // 'melodic' or 'percussion'
}

// We use 'any' here because SequencerPreset doesn't match BasePreset exactly
// It has createdAt as number instead of Date and is missing updatedAt
export const sequencerPresetValidator: PresetValidator<any> = {
  validate: (preset: SequencerPreset, context: PresetValidationContext) => {
    const ctx = context as SequencerValidationContext;

    if (!ctx.instrumentCategory) {
      return {
        valid: false,
        message: 'Validation context missing instrumentCategory',
      };
    }

    const isCompatible = preset.instrumentCategory === ctx.instrumentCategory;

    if (!isCompatible) {
      return {
        valid: false,
        message: `Preset is for ${preset.instrumentCategory} sequencer. Current sequencer is ${ctx.instrumentCategory}.`,
      };
    }

    return { valid: true };
  },
};
