/**
 * Effects Integration Service
 * 
 * This service bridges the UI effects store with the actual audio processing system.
 * It manages the lifecycle of audio effects and connects them to the virtual instrument
 * and audio voice input chains.
 */

import { getOrCreateGlobalMixer } from '../../audio/utils/effectsArchitecture';
import { EffectType as AudioEffectType, type AudioEffect } from '../../audio/utils/effectsArchitecture';
import type { EffectInstance, EffectChainType } from '../types';
import { useEffectsStore } from '../stores/effectsStore';

// Map UI effect types to audio effect types
const EFFECT_TYPE_MAP: Record<string, AudioEffectType> = {
  'reverb': AudioEffectType.REVERB,
  'delay': AudioEffectType.DELAY,
  'compressor': AudioEffectType.COMPRESSOR,
  'filter': AudioEffectType.FILTER,
  'distortion': AudioEffectType.DISTORTION,
  'chorus': AudioEffectType.CHORUS,
  'autofilter': AudioEffectType.AUTOFILTER,
  'autopanner': AudioEffectType.AUTOPANNER,
  'autowah': AudioEffectType.AUTOWAH,
  'bitcrusher': AudioEffectType.BITCRUSHER,
  'phaser': AudioEffectType.PHASER,
  'pingpongdelay': AudioEffectType.PINGPONGDELAY,
  'stereowidener': AudioEffectType.STEREOWIDENER,
  'tremolo': AudioEffectType.TREMOLO,
  'vibrato': AudioEffectType.VIBRATO,
};

// Map UI parameter names to audio parameter names
const PARAMETER_MAP: Record<string, Record<string, string>> = {
  'reverb': {
    'room_size': 'roomSize',
    'decay_time': 'decayTime', 
    'pre_delay': 'preDelay',
    'dry_wet': 'wetLevel',
  },
  'delay': {
    'time': 'delayTime',  // UI shows "Time" -> needs to map to "delayTime"
    'feedback': 'feedback',
    'dry_wet': 'wetLevel',
  },
  'compressor': {
    'threshold': 'threshold',
    'ratio': 'ratio',
    'attack': 'attack',
    'release': 'release',
    'dry_wet': 'wetLevel',
  },
  'filter': {
    'frequency': 'frequency',
    'resonance': 'Q',  // UI shows "Resonance" -> needs to map to "Q"
    'type': 'type',
    'dry_wet': 'wetLevel',
  },
  'autofilter': {
    'frequency': 'frequency',
    'base_frequency': 'baseFrequency',
    'octaves': 'octaves',
    'filter_type': 'type',
    'dry_wet': 'wetLevel',
  },
  'autopanner': {
    'frequency': 'frequency',
    'depth': 'depth',
    'dry_wet': 'wetLevel',
  },
  'autowah': {
    'base_frequency': 'baseFrequency',
    'octaves': 'octaves',
    'sensitivity': 'sensitivity',
    'q': 'Q',
    'dry_wet': 'wetLevel',
  },
  'bitcrusher': {
    'bits': 'bits',
    'dry_wet': 'wetLevel',
  },
  'chorus': {
    'frequency': 'frequency',
    'delay_time': 'delayTime',
    'depth': 'depth',
    'spread': 'spread',
    'dry_wet': 'wetLevel',
  },
  'distortion': {
    'distortion': 'distortion',
    'oversample': 'oversample',
    'dry_wet': 'wetLevel',
  },
  'phaser': {
    'frequency': 'frequency',
    'octaves': 'octaves',
    'base_frequency': 'baseFrequency',
    'stages': 'stages',
    'q': 'Q',
    'dry_wet': 'wetLevel',
  },
  'pingpongdelay': {
    'delay_time': 'delayTime',
    'feedback': 'feedback',
    'dry_wet': 'wetLevel',
  },
  'stereowidener': {
    'width': 'width',
    'dry_wet': 'wetLevel',
  },
  'tremolo': {
    'frequency': 'frequency',
    'depth': 'depth',
    'spread': 'spread',
    'dry_wet': 'wetLevel',
  },
  'vibrato': {
    'frequency': 'frequency',
    'depth': 'depth',
    'dry_wet': 'wetLevel',
  },
};

interface EffectMapping {
  uiEffectId: string;
  audioEffect: AudioEffect;
  chainType: EffectChainType;
}

class EffectsIntegrationService {
  private effectMappings = new Map<string, EffectMapping>();
  private isInitialized = false;
  private currentUserId: string | null = null;

  /**
   * Initialize the effects integration service
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId) return;

    this.currentUserId = userId;
    
    try {
      // Ensure mixer is available
      const mixer = await getOrCreateGlobalMixer();
      
      // Create user channel if it doesn't exist
      if (!mixer.getChannel(userId)) {
        mixer.createUserChannel(userId, 'Local User');
      }

      // Subscribe to effects store changes
      this.subscribeToEffectChanges();
      
      this.isInitialized = true;
      console.log('🎛️ Effects integration initialized for user:', userId);
    } catch (error) {
      console.error('Failed to initialize effects integration:', error);
      throw error;
    }
  }

  /**
   * Subscribe to effects store changes and sync with audio system
   */
  private subscribeToEffectChanges(): void {
    const store = useEffectsStore.getState();
    
    // Subscribe to store updates
    useEffectsStore.subscribe((state, prevState) => {
      // Check for added effects
      this.handleEffectChanges(state.chains, prevState.chains);
    });

    // Apply initial effects if any exist
    this.handleEffectChanges(store.chains, {
      virtual_instrument: { type: 'virtual_instrument', effects: [] },
      audio_voice_input: { type: 'audio_voice_input', effects: [] },
    });
  }

  /**
   * Handle changes in effects chains
   */
  private async handleEffectChanges(
    currentChains: any,
    previousChains: any
  ): Promise<void> {
    if (!this.currentUserId) return;

    for (const chainType of ['virtual_instrument', 'audio_voice_input'] as EffectChainType[]) {
      const currentEffects = currentChains[chainType].effects;
      const previousEffects = previousChains[chainType].effects;

      // Find added effects
      const addedEffects = currentEffects.filter((effect: EffectInstance) =>
        !previousEffects.find((prev: EffectInstance) => prev.id === effect.id)
      );

      // Find removed effects  
      const removedEffects = previousEffects.filter((effect: EffectInstance) =>
        !currentEffects.find((curr: EffectInstance) => curr.id === effect.id)
      );

      // Find updated effects (parameters or bypass state changed)
      const updatedEffects = currentEffects.filter((effect: EffectInstance) => {
        const prevEffect = previousEffects.find((prev: EffectInstance) => prev.id === effect.id);
        return prevEffect && (
          JSON.stringify(effect.parameters) !== JSON.stringify(prevEffect.parameters) ||
          effect.bypassed !== prevEffect.bypassed
        );
      });

      // Process changes
      for (const effect of addedEffects) {
        await this.addAudioEffect(effect, chainType);
      }

      for (const effect of removedEffects) {
        await this.removeAudioEffect(effect.id);
      }

      for (const effect of updatedEffects) {
        await this.updateAudioEffectParameters(effect);
      }
    }
  }

  /**
   * Add an audio effect to the processing chain
   */
  private async addAudioEffect(
    uiEffect: EffectInstance,
    chainType: EffectChainType
  ): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const mixer = await getOrCreateGlobalMixer();
      const audioEffectType = EFFECT_TYPE_MAP[uiEffect.type];
      
      if (!audioEffectType) {
        console.warn(`Unknown effect type: ${uiEffect.type}`);
        return;
      }

      // Add effect to the user's channel
      const audioEffect = mixer.addEffectToChannel(this.currentUserId, audioEffectType);
      
      if (audioEffect) {
        // Store mapping
        this.effectMappings.set(uiEffect.id, {
          uiEffectId: uiEffect.id,
          audioEffect,
          chainType,
        });

        // Apply initial parameters
        this.applyEffectParameters(uiEffect, audioEffect);

        // Apply bypass state
        if (uiEffect.bypassed) {
          audioEffect.disable();
        } else {
          audioEffect.enable();
        }

        console.log(`🎛️ Added ${uiEffect.type} effect to ${chainType} chain`);
      }
    } catch (error) {
      console.error(`Failed to add audio effect ${uiEffect.type}:`, error);
    }
  }

  /**
   * Remove an audio effect from the processing chain
   */
  private async removeAudioEffect(uiEffectId: string): Promise<void> {
    const mapping = this.effectMappings.get(uiEffectId);
    if (!mapping || !this.currentUserId) return;

    try {
      const mixer = await getOrCreateGlobalMixer();
      
      // Use the mixer's removeEffectFromChannel method
      const success = mixer.removeEffectFromChannel(this.currentUserId, mapping.audioEffect.id);
      
      if (success) {
        this.effectMappings.delete(uiEffectId);
        console.log(`🎛️ Removed effect from ${mapping.chainType} chain`);
      } else {
        console.warn('Failed to remove effect from mixer channel');
      }
    } catch (error) {
      console.error(`Failed to remove audio effect:`, error);
    }
  }

  /**
   * Update audio effect parameters
   */
  private async updateAudioEffectParameters(uiEffect: EffectInstance): Promise<void> {
    const mapping = this.effectMappings.get(uiEffect.id);
    if (!mapping) return;

    try {
      this.applyEffectParameters(uiEffect, mapping.audioEffect);

      // Handle bypass state
      if (uiEffect.bypassed) {
        mapping.audioEffect.disable();
      } else {
        mapping.audioEffect.enable();
      }
    } catch (error) {
      console.error(`Failed to update effect parameters:`, error);
    }
  }

  /**
   * Apply UI effect parameters to audio effect
   */
  private applyEffectParameters(uiEffect: EffectInstance, audioEffect: AudioEffect): void {
    const parameterMap = PARAMETER_MAP[uiEffect.type] || {};

    for (const uiParam of uiEffect.parameters) {
      // Convert UI parameter name to normalized format for mapping
      const normalizedParamName = uiParam.name.toLowerCase().replace(/[\s/]+/g, '_');
      const audioParamName = parameterMap[normalizedParamName] || uiParam.name;
      
      try {
        // Convert UI parameter value to audio parameter value
        let audioValue = uiParam.value;
        
        // Special handling for dry/wet parameters (UI uses 0-100, audio uses 0-1)
        if (audioParamName === 'wetLevel' && uiParam.max === 100) {
          audioValue = uiParam.value / 100;
        }

        audioEffect.setParameter(audioParamName, audioValue);
      } catch (error) {
        console.warn(`Failed to set parameter ${audioParamName}:`, error);
      }
    }
  }



  /**
   * Get the current audio effect for a UI effect
   */
  getAudioEffect(uiEffectId: string): AudioEffect | null {
    const mapping = this.effectMappings.get(uiEffectId);
    return mapping?.audioEffect || null;
  }

  /**
   * Clean up all effects and mappings
   */
  async cleanup(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const mixer = await getOrCreateGlobalMixer();
      
      // Remove all effects from the user's channel
      // This will also rebuild the chain automatically
      for (const mapping of this.effectMappings.values()) {
        mixer.removeEffectFromChannel(this.currentUserId, mapping.audioEffect.id);
      }

      this.effectMappings.clear();
      this.isInitialized = false;
      this.currentUserId = null;

      console.log('🎛️ Effects integration cleaned up');
    } catch (error) {
      console.error('Failed to cleanup effects integration:', error);
    }
  }
}

// Export singleton instance
export const effectsIntegration = new EffectsIntegrationService();
