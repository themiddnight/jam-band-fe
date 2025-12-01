// Metronome Store - Personal Settings
// Only includes user's personal preferences (volume, mute)
// BPM is handled separately as it's synced across the room
import { METRONOME_CONFIG } from "../constants";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useUserStore } from "@/shared/stores/userStore";
import * as userPresetsAPI from "@/shared/api/userPresets";

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
    (set, get) => {
      // Helper to save to API if authenticated
      const saveToAPI = async (settings: { volume: number; isMuted: boolean }) => {
        const { isAuthenticated, userType } = useUserStore.getState();
        const isGuest = userType === "GUEST" || !isAuthenticated;
        
        if (!isGuest) {
          try {
            await userPresetsAPI.updateSettings({
              settingsType: "metronome",
              data: settings,
            });
          } catch (error) {
            console.error("Error saving metronome settings to API:", error);
          }
        }
      };

      return {
        // Initial state
        volume: METRONOME_CONFIG.DEFAULT_VOLUME,
        isMuted: true, // Default to muted

        // Basic setters with validation
        setVolume: (volume) => {
          const newVolume = Math.max(0, Math.min(1, volume));
          set({ volume: newVolume });
          // Save to API only for authenticated users
          const { isAuthenticated, userType } = useUserStore.getState();
          const isGuest = userType === "GUEST" || !isAuthenticated;
          if (!isGuest) {
            saveToAPI({ volume: newVolume, isMuted: get().isMuted });
          }
        },

        setIsMuted: (isMuted) => {
          set({ isMuted });
          const { isAuthenticated, userType } = useUserStore.getState();
          const isGuest = userType === "GUEST" || !isAuthenticated;
          if (!isGuest) {
            saveToAPI({ volume: get().volume, isMuted });
          }
        },

        // Toggle actions
        toggleMute: () => {
          const newMuted = !get().isMuted;
          set({ isMuted: newMuted });
          const { isAuthenticated, userType } = useUserStore.getState();
          const isGuest = userType === "GUEST" || !isAuthenticated;
          if (!isGuest) {
            saveToAPI({ volume: get().volume, isMuted: newMuted });
          }
        },

        // Utility actions
        incrementVolume: () => {
          const newVolume = Math.min(1, get().volume + 0.1);
          set({ volume: newVolume });
          const { isAuthenticated, userType } = useUserStore.getState();
          const isGuest = userType === "GUEST" || !isAuthenticated;
          if (!isGuest) {
            saveToAPI({ volume: newVolume, isMuted: get().isMuted });
          }
        },

        decrementVolume: () => {
          const newVolume = Math.max(0, get().volume - 0.1);
          set({ volume: newVolume });
          const { isAuthenticated, userType } = useUserStore.getState();
          const isGuest = userType === "GUEST" || !isAuthenticated;
          if (!isGuest) {
            saveToAPI({ volume: newVolume, isMuted: get().isMuted });
          }
        },
      };
    },
    {
      name: "metronome-settings", // localStorage key (still used for guests)
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
