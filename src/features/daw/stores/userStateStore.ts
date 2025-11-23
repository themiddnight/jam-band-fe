import { create } from "zustand";

interface VoiceStateRecord {
  [userId: string]: boolean;
}

interface ArrangeUserStateStore {
  voiceStates: VoiceStateRecord;
  setVoiceStates: (states: Record<string, { isMuted: boolean }>) => void;
  setVoiceState: (userId: string, isMuted: boolean) => void;
  removeVoiceState: (userId: string) => void;
  clearVoiceStates: () => void;
}

export const useArrangeUserStateStore = create<ArrangeUserStateStore>((set) => ({
  voiceStates: {},
  setVoiceStates: (states) =>
    set(() => {
      const mapped: VoiceStateRecord = {};
      Object.entries(states).forEach(([userId, value]) => {
        mapped[userId] = Boolean(value?.isMuted);
      });
      return { voiceStates: mapped };
    }),
  setVoiceState: (userId, isMuted) =>
    set((prev) => ({
      voiceStates: {
        ...prev.voiceStates,
        [userId]: isMuted,
      },
    })),
  removeVoiceState: (userId) =>
    set((prev) => {
      if (!(userId in prev.voiceStates)) {
        return prev;
      }
      const updated = { ...prev.voiceStates };
      delete updated[userId];
      return { voiceStates: updated };
    }),
  clearVoiceStates: () => set({ voiceStates: {} }),
}));
