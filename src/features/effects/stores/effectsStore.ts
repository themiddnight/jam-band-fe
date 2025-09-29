import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { EffectChain, EffectInstance, EffectType, EffectChainType } from '../types';
import { EFFECT_CONFIGS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

interface EffectsState {
  // State
  chains: Record<EffectChainType, EffectChain>;
  
  // Actions
  addEffect: (chainType: EffectChainType, effectType: EffectType) => void;
  removeEffect: (chainType: EffectChainType, effectId: string) => void;
  updateEffectParameter: (chainType: EffectChainType, effectId: string, parameterId: string, value: number) => void;
  toggleEffectBypass: (chainType: EffectChainType, effectId: string) => void;
  reorderEffects: (chainType: EffectChainType, fromIndex: number, toIndex: number) => void;
  clearChain: (chainType: EffectChainType) => void;
  resetEffect: (chainType: EffectChainType, effectId: string) => void;
}

const createDefaultChain = (type: EffectChainType): EffectChain => ({
  type,
  effects: [],
});

const createEffectInstance = (type: EffectType, order: number = 0): EffectInstance => {
  const config = EFFECT_CONFIGS[type];
  
  return {
    id: uuidv4(),
    type,
    name: config.name,
    bypassed: false,
    order,
    parameters: config.parameters.map((param, index) => ({
      ...param,
      id: `${type}_${param.name.toLowerCase().replace(/\s+/g, '_')}_${index}`,
    })),
  };
};

export const useEffectsStore = create<EffectsState>()(
  devtools(
    (set) => ({
      // Initial state
      chains: {
        virtual_instrument: createDefaultChain('virtual_instrument'),
        audio_voice_input: createDefaultChain('audio_voice_input'),
      },

      // Actions
      addEffect: (chainType, effectType) => set(
        (state) => {
          const chain = state.chains[chainType];
          const newOrder = Math.max(0, ...chain.effects.map(e => e.order)) + 1;
          const newEffect = createEffectInstance(effectType, newOrder);
          
          return {
            chains: {
              ...state.chains,
              [chainType]: {
                ...chain,
                effects: [...chain.effects, newEffect],
              },
            },
          };
        },
        false,
        'effects/addEffect'
      ),

      removeEffect: (chainType, effectId) => set(
        (state) => {
          const chain = state.chains[chainType];
          
          return {
            chains: {
              ...state.chains,
              [chainType]: {
                ...chain,
                effects: chain.effects.filter(effect => effect.id !== effectId),
              },
            },
          };
        },
        false,
        'effects/removeEffect'
      ),

      updateEffectParameter: (chainType, effectId, parameterId, value) => set(
        (state) => {
          const chain = state.chains[chainType];
          
          return {
            chains: {
              ...state.chains,
              [chainType]: {
                ...chain,
                effects: chain.effects.map(effect => 
                  effect.id === effectId
                    ? {
                        ...effect,
                        parameters: effect.parameters.map(param =>
                          param.id === parameterId
                            ? { ...param, value }
                            : param
                        ),
                      }
                    : effect
                ),
              },
            },
          };
        },
        false,
        'effects/updateEffectParameter'
      ),

      toggleEffectBypass: (chainType, effectId) => set(
        (state) => {
          const chain = state.chains[chainType];
          
          return {
            chains: {
              ...state.chains,
              [chainType]: {
                ...chain,
                effects: chain.effects.map(effect =>
                  effect.id === effectId
                    ? { ...effect, bypassed: !effect.bypassed }
                    : effect
                ),
              },
            },
          };
        },
        false,
        'effects/toggleEffectBypass'
      ),

      reorderEffects: (chainType, fromIndex, toIndex) => set(
        (state) => {
          const chain = state.chains[chainType];
          const effects = [...chain.effects];
          const [reorderedItem] = effects.splice(fromIndex, 1);
          effects.splice(toIndex, 0, reorderedItem);
          
          // Update order values
          const reorderedEffects = effects.map((effect, index) => ({
            ...effect,
            order: index,
          }));
          
          return {
            chains: {
              ...state.chains,
              [chainType]: {
                ...chain,
                effects: reorderedEffects,
              },
            },
          };
        },
        false,
        'effects/reorderEffects'
      ),

      clearChain: (chainType) => set(
        (state) => ({
          chains: {
            ...state.chains,
            [chainType]: createDefaultChain(chainType),
          },
        }),
        false,
        'effects/clearChain'
      ),

      resetEffect: (chainType, effectId) => set(
        (state) => {
          const chain = state.chains[chainType];
          const effectToReset = chain.effects.find(e => e.id === effectId);
          
          if (!effectToReset) return state;
          
          const config = EFFECT_CONFIGS[effectToReset.type];
          const resetParameters = config.parameters.map((param, index) => ({
            ...param,
            id: `${effectToReset.type}_${param.name.toLowerCase().replace(/\s+/g, '_')}_${index}`,
          }));
          
          return {
            chains: {
              ...state.chains,
              [chainType]: {
                ...chain,
                effects: chain.effects.map(effect =>
                  effect.id === effectId
                    ? { ...effect, parameters: resetParameters }
                    : effect
                ),
              },
            },
          };
        },
        false,
        'effects/resetEffect'
      ),
    }),
    {
      name: 'effects-store',
    }
  )
);
