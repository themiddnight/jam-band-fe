import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PerformanceSettings {
  audioBufferSize: number;
  waveformQuality: "low" | "medium" | "high";
  latencyCompensation: boolean;
  viewportCulling: boolean;
  maxVisibleTracks: number;
  audioLookahead: number;
}

interface PerformanceStore {
  settings: PerformanceSettings;
  updateSettings: (settings: Partial<PerformanceSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: PerformanceSettings = {
  audioBufferSize: 256,
  waveformQuality: "medium",
  latencyCompensation: true,
  viewportCulling: true,
  maxVisibleTracks: 50,
  audioLookahead: 0.1,
};

export const usePerformanceStore = create<PerformanceStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "daw-performance-settings",
    }
  )
);
