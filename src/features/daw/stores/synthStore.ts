import { create } from 'zustand';
import type { SynthState } from '@/features/instruments';

interface SynthStoreState {
  synthStates: Record<string, SynthState>;
  setSynthState: (trackId: string, state: SynthState) => void;
  updateSynthState: (trackId: string, params: Partial<SynthState>) => void;
  removeSynthState: (trackId: string) => void;
  setAllSynthStates: (states: Record<string, SynthState>) => void;
  clearSynthStates: () => void;
}

export const useSynthStore = create<SynthStoreState>((set) => ({
  synthStates: {},
  setSynthState: (trackId, state) =>
    set((current) => ({
      synthStates: {
        ...current.synthStates,
        [trackId]: state,
      },
    })),
  updateSynthState: (trackId, params) =>
    set((current) => {
      const currentState = current.synthStates[trackId];
      if (!currentState) {
        return current;
      }
      return {
        synthStates: {
          ...current.synthStates,
          [trackId]: { ...currentState, ...params },
        },
      };
    }),
  removeSynthState: (trackId) =>
    set((current) => {
      if (!(trackId in current.synthStates)) {
        return current;
      }
      const next = { ...current.synthStates };
      delete next[trackId];
      return { synthStates: next };
    }),
  setAllSynthStates: (states) => set({ synthStates: states ?? {} }),
  clearSynthStates: () => set({ synthStates: {} }),
}));

