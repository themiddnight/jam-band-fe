import {
  BRUSHING_TIMES,
  type BrushingTime,
} from "../constants/guitarShortcuts";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface GuitarState {
  // Main states
  mode: "basic" | "melody" | "chord";
  velocity: number;
  currentOctave: number;
  chordVoicing: number;
  brushingSpeed: BrushingTime;
  sustain: boolean;
  sustainToggle: boolean;

  // Actions
  setMode: (mode: "basic" | "melody" | "chord") => void;
  setVelocity: (velocity: number) => void;
  setCurrentOctave: (octave: number) => void;
  setChordVoicing: (voicing: number) => void;
  setBrushingSpeed: (speed: BrushingTime) => void;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (sustainToggle: boolean) => void;

  // Utility actions
  toggleMode: () => void;
  incrementOctave: () => void;
  decrementOctave: () => void;
  incrementVelocity: () => void;
  decrementVelocity: () => void;
  incrementChordVoicing: () => void;
  decrementChordVoicing: () => void;
  incrementBrushingSpeed: () => void;
  decrementBrushingSpeed: () => void;
  toggleSustain: () => void;
  toggleSustainToggle: () => void;
}

export const useGuitarStore = create<GuitarState>()(
  persist(
    (set) => ({
      // Initial state
      mode: "basic",
      velocity: 0.5,
      currentOctave: 3,
      chordVoicing: 0,
      brushingSpeed: BRUSHING_TIMES.FAST,
      sustain: false,
      sustainToggle: false,

      // Basic setters
      setMode: (mode) => set({ mode }),
      setVelocity: (velocity) =>
        set({ velocity: Math.max(0, Math.min(1, velocity)) }),
      setCurrentOctave: (octave) =>
        set({ currentOctave: Math.max(0, Math.min(8, octave)) }),
      setChordVoicing: (voicing) =>
        set({ chordVoicing: Math.max(-2, Math.min(2, voicing)) }),
      setBrushingSpeed: (speed) => set({ brushingSpeed: speed }),
      setSustain: (sustain) => set({ sustain }),
      setSustainToggle: (sustainToggle) => set({ sustainToggle }),

      // Toggle actions
      toggleMode: () =>
        set((state) => {
          const modes: ("basic" | "melody" | "chord")[] = [
            "basic",
            "melody",
            "chord",
          ];
          const currentIndex = modes.indexOf(state.mode);
          const nextIndex = (currentIndex + 1) % modes.length;
          return { mode: modes[nextIndex] };
        }),
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
      incrementChordVoicing: () =>
        set((state) => ({
          chordVoicing: Math.min(2, state.chordVoicing + 1),
        })),
      decrementChordVoicing: () =>
        set((state) => ({
          chordVoicing: Math.max(-2, state.chordVoicing - 1),
        })),
      incrementBrushingSpeed: () =>
        set((state) => {
          const speeds = Object.values(BRUSHING_TIMES);
          const currentIndex = speeds.indexOf(state.brushingSpeed);
          const nextIndex = Math.min(speeds.length - 1, currentIndex + 1);
          return { brushingSpeed: speeds[nextIndex] };
        }),
      decrementBrushingSpeed: () =>
        set((state) => {
          const speeds = Object.values(BRUSHING_TIMES);
          const currentIndex = speeds.indexOf(state.brushingSpeed);
          const prevIndex = Math.max(0, currentIndex - 1);
          return { brushingSpeed: speeds[prevIndex] };
        }),
    }),
    {
      name: "guitar-state",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
