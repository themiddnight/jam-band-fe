import { create } from 'zustand';

interface BroadcastUser {
  userId: string;
  username: string;
  trackId: string;
}

interface BroadcastStoreState {
  // Local user's broadcast state
  isBroadcasting: boolean;
  
  // Other users' broadcast states
  broadcastingUsers: Map<string, BroadcastUser>;
  
  // Actions
  setBroadcasting: (broadcasting: boolean) => void;
  addBroadcastingUser: (userId: string, username: string, trackId: string) => void;
  removeBroadcastingUser: (userId: string) => void;
  updateBroadcastingUserTrack: (userId: string, trackId: string) => void;
  clearBroadcastingUsers: () => void;
  setBroadcastStates: (states: Record<string, { username: string; trackId: string | null }>) => void;
}

export const useBroadcastStore = create<BroadcastStoreState>((set) => ({
  isBroadcasting: false,
  broadcastingUsers: new Map(),
  
  setBroadcasting: (broadcasting) => set({ isBroadcasting: broadcasting }),
  
  addBroadcastingUser: (userId, username, trackId) =>
    set((state) => {
      const newMap = new Map(state.broadcastingUsers);
      newMap.set(userId, { userId, username, trackId });
      return { broadcastingUsers: newMap };
    }),
  
  removeBroadcastingUser: (userId) =>
    set((state) => {
      const newMap = new Map(state.broadcastingUsers);
      newMap.delete(userId);
      return { broadcastingUsers: newMap };
    }),
  
  updateBroadcastingUserTrack: (userId, trackId) =>
    set((state) => {
      const newMap = new Map(state.broadcastingUsers);
      const user = newMap.get(userId);
      if (user) {
        newMap.set(userId, { ...user, trackId });
      }
      return { broadcastingUsers: newMap };
    }),
  
  clearBroadcastingUsers: () =>
    set({ broadcastingUsers: new Map() }),

  setBroadcastStates: (states) =>
    set(() => {
      const newMap = new Map<string, BroadcastUser>();
      if (states) {
        Object.entries(states).forEach(([userId, info]) => {
          if (info?.trackId) {
            newMap.set(userId, {
              userId,
              username: info.username,
              trackId: info.trackId,
            });
          }
        });
      }
      return { broadcastingUsers: newMap };
    }),
}));
