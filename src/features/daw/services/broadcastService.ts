import { useBroadcastStore } from '../stores/broadcastStore';

export const BroadcastService = {
  setBroadcastStates: (states: Record<string, { username: string; trackId: string | null }>) => 
    useBroadcastStore.getState().setBroadcastStates(states),
};
