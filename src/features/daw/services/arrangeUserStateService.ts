import { useArrangeUserStateStore } from '../stores/userStateStore';

export const ArrangeUserStateService = {
  setVoiceStates: (states: Record<string, { isMuted: boolean }>) => 
    useArrangeUserStateStore.getState().setVoiceStates(states),
  setVoiceState: (userId: string, isMuted: boolean) => 
    useArrangeUserStateStore.getState().setVoiceState(userId, isMuted),
};
