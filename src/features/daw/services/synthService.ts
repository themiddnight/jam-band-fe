import { useSynthStore } from '../stores/synthStore';
import type { SynthState } from '@/features/instruments';

export const SynthService = {
  getSynthStates: () => useSynthStore.getState().synthStates,
  getSynthState: (trackId: string) => useSynthStore.getState().synthStates[trackId],
  
  setAllSynthStates: (states: Record<string, SynthState>) => 
    useSynthStore.getState().setAllSynthStates(states),
  updateSynthState: (trackId: string, params: Partial<SynthState>) => 
    useSynthStore.getState().updateSynthState(trackId, params),
  setSynthState: (trackId: string, state: SynthState) => 
    useSynthStore.getState().setSynthState(trackId, state),
  clearSynthStates: () => useSynthStore.getState().clearSynthStates(),
};
