import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface BassState {
  // Main states
  mode: "basic" | "melody";
  velocity: number;
  currentOctave: number;
  sustain: boolean;
  sustainToggle: boolean;
  alwaysRoot: boolean;

  // Actions
  setMode: (mode: "basic" | "melody") => void;
  setVelocity: (velocity: number) => void;
  setCurrentOctave: (octave: number) => void;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (sustainToggle: boolean) => void;
  setAlwaysRoot: (alwaysRoot: boolean) => void;

  // Utility actions
  toggleMode: () => void;
  incrementOctave: () => void;
  decrementOctave: () => void;
  incrementVelocity: () => void;
  decrementVelocity: () => void;
  toggleSustain: () => void;
  toggleSustainToggle: () => void;
  toggleAlwaysRoot: () => void;
}

export const useBassStore = create<BassState>()(
  persist(
    (set) => ({
      // Initial state
      mode: "basic",
      velocity: 0.6,
      currentOctave: 2,
      sustain: false,
      sustainToggle: false,
      alwaysRoot: false,

      // Basic setters
      setMode: (mode) => set({ mode }),
      setVelocity: (velocity) =>
        set({ velocity: Math.max(0.1, Math.min(1, velocity)) }),
      setCurrentOctave: (octave) =>
        set({ currentOctave: Math.max(0, Math.min(6, octave)) }),
      setSustain: (sustain) => set({ sustain }),
      setSustainToggle: (sustainToggle) => set({ sustainToggle }),
      setAlwaysRoot: (alwaysRoot) => set({ alwaysRoot }),

      // Toggle actions
      toggleMode: () =>
        set((state) => ({ mode: state.mode === "basic" ? "melody" : "basic" })),
      toggleSustain: () => set((state) => ({ sustain: !state.sustain })),
      toggleSustainToggle: () =>
        set((state) => ({ sustainToggle: !state.sustainToggle })),
      toggleAlwaysRoot: () =>
        set((state) => ({ alwaysRoot: !state.alwaysRoot })),

      // Increment/Decrement actions
      incrementOctave: () =>
        set((state) => ({
          currentOctave: Math.min(6, state.currentOctave + 1),
        })),
      decrementOctave: () =>
        set((state) => ({
          currentOctave: Math.max(0, state.currentOctave - 1),
        })),
      incrementVelocity: () =>
        set((state) => ({
          velocity: Math.min(1, state.velocity + 0.1),
        })),
      decrementVelocity: () =>
        set((state) => ({
          velocity: Math.max(0.1, state.velocity - 0.1),
        })),
    }),
    {
      name: "bass-state",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
