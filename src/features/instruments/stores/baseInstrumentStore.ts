import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface BaseInstrumentState {
  // Common states
  velocity: number;
  currentOctave: number;
  sustain: boolean;
  sustainToggle: boolean;

  // Common actions
  setVelocity: (velocity: number) => void;
  setCurrentOctave: (octave: number) => void;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (sustainToggle: boolean) => void;

  // Common utility actions
  incrementOctave: () => void;
  decrementOctave: () => void;
  incrementVelocity: () => void;
  decrementVelocity: () => void;
  toggleSustain: () => void;
  toggleSustainToggle: () => void;
}

export const useBaseInstrumentStore = create<BaseInstrumentState>()(
  persist(
    (set) => ({
      // Initial state
      velocity: 0.7,
      currentOctave: 3,
      sustain: false,
      sustainToggle: false,

      // Basic setters
      setVelocity: (velocity) =>
        set({ velocity: Math.max(0, Math.min(1, velocity)) }),
      setCurrentOctave: (octave) =>
        set({ currentOctave: Math.max(0, Math.min(8, octave)) }),
      setSustain: (sustain) => set({ sustain }),
      setSustainToggle: (sustainToggle) => set({ sustainToggle }),

      // Toggle actions
      toggleSustain: () => set((state) => ({ sustain: !state.sustain })),
      toggleSustainToggle: () =>
        set((state) => ({ sustainToggle: !state.sustainToggle })),

      // Increment/Decrement actions
      incrementOctave: () =>
        set((state) => ({
          currentOctave: Math.min(8, state.currentOctave + 1),
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
          velocity: Math.max(0, state.velocity - 0.1),
        })),
    }),
    {
      name: "base-instrument-state",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
