import { useRef, useCallback, useEffect } from 'react';
import { dawSyncService } from '../services/dawSyncService';
import { useTrackStore } from '../stores/trackStore';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import type { EffectChainState } from '@/shared/types';
import { createThrottledEmitter } from '@/shared/utils/performanceUtils';
import { COLLAB_THROTTLE_INTERVALS } from '@/features/daw/config/collaborationThrottles';

export const useDAWEffectSync = (enabled: boolean = true) => {
  const effectChainSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEffectChainsRef = useRef<Record<string, string>>({});

  const effectChainQueueRef = useRef<Map<string, { trackId: string; chainType: string; chain: EffectChainState }>>(new Map());
  const effectChainEmitterRef = useRef(
    createThrottledEmitter<void>(() => {
      const queue = effectChainQueueRef.current;
      if (queue.size === 0) {
        return;
      }

      queue.forEach(({ trackId, chainType, chain }) => {
        dawSyncService.syncEffectChainUpdate(trackId, chainType, chain);
      });

      queue.clear();
    }, COLLAB_THROTTLE_INTERVALS.effectChainMs)
  );

  // Cleanup
  useEffect(() => {
    const emitter = effectChainEmitterRef.current;
    const queue = effectChainQueueRef.current;
    return () => {
      emitter.cancel();
      queue.clear();
      if (effectChainSyncTimeoutRef.current) {
        clearTimeout(effectChainSyncTimeoutRef.current);
      }
    };
  }, []);

  const handleEffectChainUpdate = useCallback(
    (trackId: string, chainType: string, effectChain: any) => {
      const key = `${trackId}:${chainType}`;
      effectChainQueueRef.current.set(key, {
        trackId,
        chainType,
        chain: effectChain,
      });
      effectChainEmitterRef.current.push(undefined);
    },
    []
  );

  // Subscribe to effect store changes
  useEffect(() => {
    if (!enabled) return;

    let isInitialLoad = true;

    const unsubscribe = useEffectsStore.subscribe((state) => {
      if (isInitialLoad) {
        Object.keys(state.chains).forEach((chainType) => {
          const chain = state.chains[chainType as any];
          if (chain) {
            prevEffectChainsRef.current[chainType] = JSON.stringify(chain);
          }
        });
        isInitialLoad = false;
        return;
      }

      const tracks = useTrackStore.getState().tracks;
      tracks.forEach((track) => {
        const chainType = `track:${track.id}` as any;
        const chain = state.chains[chainType];
        if (!chain) {
          delete prevEffectChainsRef.current[chainType];
          return;
        }

        const chainJson = JSON.stringify(chain);
        const prevChainJson = prevEffectChainsRef.current[chainType];

        if (chainJson !== prevChainJson) {
          if (effectChainSyncTimeoutRef.current) {
            clearTimeout(effectChainSyncTimeoutRef.current);
          }
          
          effectChainSyncTimeoutRef.current = setTimeout(() => {
            const currentState = useEffectsStore.getState();
            const currentChain = currentState.chains[chainType];
            if (currentChain && JSON.stringify(currentChain) !== prevChainJson) {
              const sharedChain: EffectChainState = {
                type: chainType as any,
                effects: currentChain.effects.map((effect) => ({
                  id: effect.id,
                  type: effect.type,
                  bypassed: effect.bypassed,
                  order: effect.order,
                  parameters: effect.parameters.map((param) => ({
                    name: param.name,
                    value: param.value,
                  })),
                })),
              };
              handleEffectChainUpdate(track.id, chainType, sharedChain);
            }
          }, 100);
          
          prevEffectChainsRef.current[chainType] = chainJson;
        }
      });
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, handleEffectChainUpdate]);

  return {
    handleEffectChainUpdate,
  };
};
