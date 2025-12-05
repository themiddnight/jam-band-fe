import { useEffectsStore } from '../stores/effectsStore';
import type { EffectChainType } from '../types';
import type { EffectChainState } from '@/shared/types';

export const EffectsService = {
  syncUpdateEffectChain: (chainType: EffectChainType, effectChain: EffectChainState) => 
    useEffectsStore.getState().syncUpdateEffectChain(chainType, effectChain),
  setChainsFromState: (chainStates: Record<EffectChainType, EffectChainState>) =>
    useEffectsStore.getState().setChainsFromState(chainStates),
  subscribe: (listener: (state: any, prevState: any) => void) => useEffectsStore.subscribe(listener),
};
