import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";

export interface VoiceState {
  isMuted: boolean;
  gain: number;
  inputLevel: number;
  isSelfMonitoring: boolean;
  isConnected: boolean;
  hasSeenHeadphoneModal: boolean; // Track if user has seen the headphone recommendation modal
  cleanMode: boolean; // When enabled, disables all audio processing for lowest latency
  autoGain: boolean; // When enabled, uses browser's automatic gain control
}

interface VoiceStateStore extends VoiceState {
  // State update methods
  setMuted: (isMuted: boolean) => void;
  setGain: (gain: number) => void;
  setInputLevel: (inputLevel: number) => void;
  setSelfMonitoring: (isSelfMonitoring: boolean) => void;
  setConnected: (isConnected: boolean) => void;
  setHasSeenHeadphoneModal: (hasSeen: boolean) => void;
  setCleanMode: (cleanMode: boolean) => void;
  setAutoGain: (autoGain: boolean) => void;
  updateVoiceState: (updates: Partial<VoiceState>) => void;
}

// Create memory storage fallback for SSR or when localStorage is unavailable
const createMemoryStorage = (): StateStorage => {
  const storage = new Map<string, string>();
  return {
    getItem: (name) => storage.get(name) ?? null,
    setItem: (name, value) => {
      storage.set(name, value);
    },
    removeItem: (name) => {
      storage.delete(name);
    },
  };
};

// Resolve persistence storage with fallback
const resolvePersistenceStorage = (): StateStorage => {
  if (typeof window !== "undefined") {
    return window.localStorage;
  }
  return createMemoryStorage();
};

const persistenceStorage = resolvePersistenceStorage();

// Initial state
const initialState: VoiceState = {
  isMuted: false, // Start unmuted by default
  gain: 1,
  inputLevel: 0,
  isSelfMonitoring: false,
  isConnected: false,
  hasSeenHeadphoneModal: false, // Start as false for new sessions
  cleanMode: false, // Start with clean mode disabled (normal processing)
  autoGain: false, // Start with auto gain disabled
};

export const useVoiceStateStore = create<VoiceStateStore>()(
  persist(
    (set) => ({
      ...initialState,

      setMuted: (isMuted) => set({ isMuted }),
      setGain: (gain) => set({ gain }),
      setInputLevel: (inputLevel) => set({ inputLevel }),
      setSelfMonitoring: (isSelfMonitoring) => set({ isSelfMonitoring }),
      setConnected: (isConnected) => set({ isConnected }),
      setHasSeenHeadphoneModal: (hasSeen) => set({ hasSeenHeadphoneModal: hasSeen }),
      setCleanMode: (cleanMode) => set({ cleanMode }),
      setAutoGain: (autoGain) => set({ autoGain }),
      updateVoiceState: (updates) => set((state) => ({ ...state, ...updates })),
    }),
    {
      name: "voice-state-storage",
      storage: createJSONStorage(() => persistenceStorage),
      // Only persist certain fields, not runtime state like inputLevel or isConnected
      partialize: (state) => ({
        isMuted: state.isMuted,
        gain: state.gain,
        isSelfMonitoring: state.isSelfMonitoring,
        hasSeenHeadphoneModal: state.hasSeenHeadphoneModal,
        cleanMode: state.cleanMode,
        autoGain: state.autoGain,
        // Don't persist: inputLevel, isConnected (these are runtime state)
      }),
    }
  )
);
