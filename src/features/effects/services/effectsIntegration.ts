/**
 * Effects Integration Service
 * 
 * This service bridges the UI effects store with the actual audio processing system.
 * It manages the lifecycle of audio effects and connects them to the virtual instrument
 * and audio voice input chains.
 */

import { getOrCreateGlobalMixer } from '../../audio/utils/effectsArchitecture';
import { type AudioEffect } from '../../audio/utils/effectsArchitecture';
import { useTrackStore } from '@/features/daw/stores/trackStore';
import { AudioContextManager } from '@/features/audio/constants/audioConfig';
import { audioInputEffectsManager } from '@/features/audio/services/audioInputEffectsManager';
import { EFFECT_TYPE_MAP, PARAMETER_MAP } from './effectMappings';
import type { EffectInstance, EffectChainType, EffectChain } from '../types';
import { useEffectsStore } from '../stores/effectsStore';

interface EffectMapping {
  uiEffectId: string;
  audioEffect: AudioEffect;
  chainType: EffectChainType;
  channelId: string;
}

type ChainStateMap = Record<EffectChainType, EffectChain>;
type PartialChainStateMap = Partial<Record<EffectChainType, EffectChain>>;

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

      // Ensure audio input effects manager is ready with the instrument context
      const instrumentContext = await AudioContextManager.getInstrumentContext();
      await audioInputEffectsManager.initialize(instrumentContext);

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
    this.handleEffectChanges(store.chains, {} as PartialChainStateMap);
  }

  /**
   * Handle changes in effects chains
   */
  private async handleEffectChanges(
    currentChains: ChainStateMap,
    previousChains: PartialChainStateMap,
  ): Promise<void> {
    if (!currentChains) return;

    const chainEntries = Object.entries(currentChains) as Array<[
      EffectChainType,
      EffectChain
    ]>;

    for (const [chainType, chainState] of chainEntries) {
      const currentEffects = chainState?.effects ?? [];
      const previousEffects = previousChains?.[chainType]?.effects ?? [];

      if (chainType === 'audio_voice_input') {
        audioInputEffectsManager.syncEffects(currentEffects);
        continue;
      }

      const channelId = await this.getChannelIdForChain(chainType);
      if (!channelId) {
        continue;
      }

      // Find added effects
      const addedEffects = currentEffects.filter(
        (effect) => !previousEffects.find((prev) => prev.id === effect.id),
      );

      // Find removed effects
      const removedEffects = previousEffects.filter(
        (effect) => !currentEffects.find((curr) => curr.id === effect.id),
      );

      // Find updated effects (parameters, bypass, or order changes)
      const updatedEffects = currentEffects.filter((effect) => {
        const prevEffect = previousEffects.find((prev) => prev.id === effect.id);
        return (
          prevEffect &&
          (
            JSON.stringify(effect.parameters) !== JSON.stringify(prevEffect.parameters) ||
            effect.bypassed !== prevEffect.bypassed ||
            effect.order !== prevEffect.order
          )
        );
      });

      for (const effect of addedEffects) {
        await this.addAudioEffect(effect, chainType, channelId);
      }

      for (const effect of removedEffects) {
        await this.removeAudioEffect(effect.id);
      }

      for (const effect of updatedEffects) {
        await this.updateAudioEffectParameters(effect);
      }
    }

    const previousEntries = Object.entries(previousChains ?? {}) as Array<[
      EffectChainType,
      EffectChain
    ]>;

    for (const [chainType, chainState] of previousEntries) {
      if (currentChains[chainType]) {
        continue;
      }

      if (chainType === 'audio_voice_input') {
        audioInputEffectsManager.syncEffects([]);
        continue;
      }

      for (const effect of chainState.effects) {
        await this.removeAudioEffect(effect.id);
      }
    }
  }

  /**
   * Add an audio effect to the processing chain
   */
  private async addAudioEffect(
    uiEffect: EffectInstance,
    chainType: EffectChainType,
    channelId: string
  ): Promise<void> {
    if (!channelId) return;

    try {
      const mixer = await getOrCreateGlobalMixer();
      const audioEffectType = EFFECT_TYPE_MAP[uiEffect.type];
      
      if (!audioEffectType) {
        console.warn(`Unknown effect type: ${uiEffect.type}`);
        return;
      }

      await this.ensureChannelExists(mixer, chainType, channelId);

      // Add effect to the channel
      const audioEffect = mixer.addEffectToChannel(channelId, audioEffectType);
      
      if (audioEffect) {
        // Store mapping
        this.effectMappings.set(uiEffect.id, {
          uiEffectId: uiEffect.id,
          audioEffect,
          chainType,
          channelId,
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
    if (!mapping) return;

    try {
      const mixer = await getOrCreateGlobalMixer();
      
      // Use the mixer's removeEffectFromChannel method
      const success = mixer.removeEffectFromChannel(mapping.channelId, mapping.audioEffect.id);
      
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
    try {
      const mixer = await getOrCreateGlobalMixer();
      
      // Remove all effects from the user's channel
      // This will also rebuild the chain automatically
      for (const mapping of this.effectMappings.values()) {
        mixer.removeEffectFromChannel(mapping.channelId, mapping.audioEffect.id);
      }

      this.effectMappings.clear();
      audioInputEffectsManager.reset();
      this.isInitialized = false;
      this.currentUserId = null;

      console.log('🎛️ Effects integration cleaned up');
    } catch (error) {
      console.error('Failed to cleanup effects integration:', error);
    }
  }

  private async getChannelIdForChain(chainType: EffectChainType): Promise<string | null> {
    if (chainType === 'virtual_instrument') {
      return this.currentUserId;
    }

    if (chainType.startsWith('track:')) {
      const [, trackId] = chainType.split(':');
      return trackId ?? null;
    }

    return null;
  }

  private async ensureChannelExists(
    mixer: Awaited<ReturnType<typeof getOrCreateGlobalMixer>>,
    chainType: EffectChainType,
    channelId: string,
  ): Promise<void> {
    if (mixer.getChannel(channelId)) {
      return;
    }

    let username = channelId;
    if (chainType.startsWith('track:')) {
      const track = useTrackStore.getState().tracks.find((t) => t.id === channelId);
      username = track?.name || username;
    } else if (chainType === 'virtual_instrument' && this.currentUserId) {
      username = 'Local User';
    }

    mixer.createUserChannel(channelId, username);
  }
}

// Export singleton instance
export const effectsIntegration = new EffectsIntegrationService();
