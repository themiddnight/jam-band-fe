import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { EffectChain, EffectInstance, EffectType, EffectChainType } from '../types';
import { EFFECT_CONFIGS } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import type {
  EffectChainState as SharedEffectChainState,
  EffectInstanceState as SharedEffectInstanceState,
  EffectParameterState as SharedEffectParameterState,
} from '@/shared/types';

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
  setChainsFromState: (
    chainStates: Partial<Record<EffectChainType, SharedEffectChainState>>,
  ) => void;
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

const parameterIdFromName = (
  effectType: EffectType,
  name: string,
  index: number,
): string =>
  `${effectType}_${name.toLowerCase().replace(/\s+/g, '_')}_${index}`;

const convertParameterState = (
  effectType: EffectType,
  parameterState: SharedEffectParameterState,
  index: number,
): EffectInstance['parameters'][number] => {
  const config = EFFECT_CONFIGS[effectType];
  const referenceParam =
    config?.parameters.find((param) => param.name === parameterState.name) ??
    config?.parameters[index];

  return {
    id: parameterState.id ?? parameterIdFromName(effectType, parameterState.name, index),
    name: parameterState.name,
    value: parameterState.value,
    min: parameterState.min ?? referenceParam?.min ?? 0,
    max: parameterState.max ?? referenceParam?.max ?? 1,
    step: parameterState.step ?? referenceParam?.step ?? 0.01,
    type: referenceParam?.type ?? 'knob',
    unit: parameterState.unit ?? referenceParam?.unit,
    curve: parameterState.curve ?? referenceParam?.curve,
  };
};

const convertEffectInstanceState = (
  effectState: SharedEffectInstanceState,
  fallbackOrder: number,
): EffectInstance => {
  const effectType = effectState.type as EffectType;
  const config = EFFECT_CONFIGS[effectType];
  const sortedParams = effectState.parameters || [];

  return {
    id: effectState.id,
    type: effectType,
    name: effectState.name ?? config?.name ?? effectState.type,
    bypassed: effectState.bypassed,
    order: effectState.order ?? fallbackOrder,
    parameters: sortedParams.map((param, index) =>
      convertParameterState(effectType, param, index),
    ),
  };
};

const convertChainState = (
  chainType: EffectChainType,
  chainState?: SharedEffectChainState,
): EffectChain => {
  if (!chainState) {
    return createDefaultChain(chainType);
  }

  const sortedEffects = [...(chainState.effects || [])].sort(
    (a, b) => a.order - b.order,
  );

  return {
    type: chainType,
    effects: sortedEffects.map((effectState, index) =>
      convertEffectInstanceState(effectState, index),
    ),
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

      setChainsFromState: (chainStates) => set(
        (state) => {
          const updatedChains: Record<EffectChainType, EffectChain> = {
            ...state.chains,
          };

          if (chainStates.virtual_instrument) {
            updatedChains.virtual_instrument = convertChainState(
              'virtual_instrument',
              chainStates.virtual_instrument,
            );
          }

          if (chainStates.audio_voice_input) {
            updatedChains.audio_voice_input = convertChainState(
              'audio_voice_input',
              chainStates.audio_voice_input,
            );
          }

          return {
            chains: updatedChains,
          };
        },
        false,
        'effects/setChainsFromState',
      ),
    }),
    {
      name: 'effects-store',
    }
  )
);
