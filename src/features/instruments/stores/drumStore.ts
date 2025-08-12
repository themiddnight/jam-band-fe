import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface DrumState {
  // Main states
  mode: "basic" | "advanced" | "pattern";
  velocity: number;
  tempo: number;
  swing: number;
  sustain: boolean;
  sustainToggle: boolean;

  // Actions
  setMode: (mode: "basic" | "advanced" | "pattern") => void;
  setVelocity: (velocity: number) => void;
  setTempo: (tempo: number) => void;
  setSwing: (swing: number) => void;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (sustainToggle: boolean) => void;

  // Utility actions
  toggleMode: () => void;
  incrementVelocity: () => void;
  decrementVelocity: () => void;
  incrementTempo: () => void;
  decrementTempo: () => void;
  incrementSwing: () => void;
  decrementSwing: () => void;
  toggleSustain: () => void;
  toggleSustainToggle: () => void;
}

export const useDrumStore = create<DrumState>()(
  persist(
    (set) => ({
      // Initial state
      mode: "basic",
      velocity: 0.8,
      tempo: 120,
      swing: 0,
      sustain: false,
      sustainToggle: false,

      // Basic setters
      setMode: (mode) => set({ mode }),
      setVelocity: (velocity) =>
        set({ velocity: Math.max(0, Math.min(1, velocity)) }),
      setTempo: (tempo) => set({ tempo: Math.max(60, Math.min(200, tempo)) }),
      setSwing: (swing) => set({ swing: Math.max(0, Math.min(1, swing)) }),
      setSustain: (sustain) => set({ sustain }),
      setSustainToggle: (sustainToggle) => set({ sustainToggle }),

      // Toggle actions
      toggleMode: () =>
        set((state) => {
          const modes: ("basic" | "advanced" | "pattern")[] = [
            "basic",
            "advanced",
            "pattern",
          ];
          const currentIndex = modes.indexOf(state.mode);
          const nextIndex = (currentIndex + 1) % modes.length;
          return { mode: modes[nextIndex] };
        }),
      toggleSustain: () => set((state) => ({ sustain: !state.sustain })),
      toggleSustainToggle: () =>
        set((state) => ({ sustainToggle: !state.sustainToggle })),

      // Increment/Decrement actions
      incrementVelocity: () =>
        set((state) => ({
          velocity: Math.min(1, state.velocity + 0.1),
        })),
      decrementVelocity: () =>
        set((state) => ({
          velocity: Math.max(0, state.velocity - 0.1),
        })),
      incrementTempo: () =>
        set((state) => ({
          tempo: Math.min(200, state.tempo + 5),
        })),
      decrementTempo: () =>
        set((state) => ({
          tempo: Math.max(60, state.tempo - 5),
        })),
      incrementSwing: () =>
        set((state) => ({
          swing: Math.min(1, state.swing + 0.1),
        })),
      decrementSwing: () =>
        set((state) => ({
          swing: Math.max(0, state.swing - 0.1),
        })),
    }),
    {
      name: "drum-state",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
