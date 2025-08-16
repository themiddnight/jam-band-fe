// Metronome Store - Personal Settings
// Only includes user's personal preferences (volume, mute)
// BPM is handled separately as it's synced across the room

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { METRONOME_CONFIG } from '../constants';

interface MetronomeState {
  // Personal settings (persisted locally)
  volume: number;
  isMuted: boolean;

  // Actions
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  toggleMute: () => void;
  
  // Utility actions
  incrementVolume: () => void;
  decrementVolume: () => void;
}

export const useMetronomeStore = create<MetronomeState>()(
  persist(
    (set) => ({
      // Initial state
      volume: METRONOME_CONFIG.DEFAULT_VOLUME,
      isMuted: true, // Default to muted

      // Basic setters with validation
      setVolume: (volume) =>
        set({ volume: Math.max(0, Math.min(1, volume)) }),
      
      setIsMuted: (isMuted) => set({ isMuted }),

      // Toggle actions
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      // Utility actions
      incrementVolume: () =>
        set((state) => ({
          volume: Math.min(1, state.volume + 0.1),
        })),
      
      decrementVolume: () =>
        set((state) => ({
          volume: Math.max(0, state.volume - 0.1),
        })),
    }),
    {
      name: 'metronome-settings', // localStorage key
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
