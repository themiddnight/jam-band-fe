import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PerformanceSettings {
  waveformQuality: "low" | "medium" | "high";
  viewportCulling: boolean;
  audioLookahead: number;
}

interface PerformanceStore {
  settings: PerformanceSettings;
  updateSettings: (settings: Partial<PerformanceSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: PerformanceSettings = {
  waveformQuality: "medium",
  viewportCulling: true,
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
