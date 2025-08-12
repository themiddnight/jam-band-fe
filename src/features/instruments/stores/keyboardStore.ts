import type { KeyboardMode } from "../components/Keyboard/types/keyboard";
import {
  ARPEGGIO_TIMES,
  type ArpeggioTime,
} from "../../../constants/keyboardShortcuts";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface KeyboardState {
  // Main states
  mode: KeyboardMode;
  currentOctave: number;
  velocity: number;
  chordVoicing: number;
  sustain: boolean;
  sustainToggle: boolean;
  arpeggioSpeed: ArpeggioTime;

  // Actions
  setMode: (mode: KeyboardMode) => void;
  setCurrentOctave: (octave: number) => void;
  setVelocity: (velocity: number) => void;
  setChordVoicing: (voicing: number) => void;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (sustainToggle: boolean) => void;
  setArpeggioSpeed: (speed: ArpeggioTime) => void;

  // Utility actions
  toggleMode: () => void;
  incrementOctave: () => void;
  decrementOctave: () => void;
  incrementVelocity: () => void;
  decrementVelocity: () => void;
  incrementChordVoicing: () => void;
  decrementChordVoicing: () => void;
  toggleSustain: () => void;
  toggleSustainToggle: () => void;
  incrementArpeggioSpeed: () => void;
  decrementArpeggioSpeed: () => void;
}

export const useKeyboardStore = create<KeyboardState>()(
  persist(
    (set) => ({
      // Initial state
      mode: "simple-melody",
      currentOctave: 2,
      velocity: 0.7,
      chordVoicing: 0,
      sustain: false,
      sustainToggle: false,
      arpeggioSpeed: ARPEGGIO_TIMES.FAST,

      // Basic setters
      setMode: (mode) => set({ mode }),
      setCurrentOctave: (octave) =>
        set({ currentOctave: Math.max(0, Math.min(8, octave)) }),
      setVelocity: (velocity) =>
        set({ velocity: Math.max(0, Math.min(1, velocity)) }),
      setChordVoicing: (voicing) =>
        set({ chordVoicing: Math.max(-2, Math.min(2, voicing)) }),
      setSustain: (sustain) => set({ sustain }),
      setSustainToggle: (sustainToggle) => set({ sustainToggle }),
      setArpeggioSpeed: (speed) => set({ arpeggioSpeed: speed }),

      // Toggle actions
      toggleMode: () =>
        set((state) => ({
          mode:
            state.mode === "simple-melody" ? "simple-chord" : "simple-melody",
        })),
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
      incrementArpeggioSpeed: () =>
        set((state) => {
          const speeds = Object.values(ARPEGGIO_TIMES);
          const currentIndex = speeds.indexOf(state.arpeggioSpeed);
          const nextIndex = Math.min(speeds.length - 1, currentIndex + 1);
          return { arpeggioSpeed: speeds[nextIndex] as ArpeggioTime };
        }),
      decrementArpeggioSpeed: () =>
        set((state) => {
          const speeds = Object.values(ARPEGGIO_TIMES);
          const currentIndex = speeds.indexOf(state.arpeggioSpeed);
          const prevIndex = Math.max(0, currentIndex - 1);
          return { arpeggioSpeed: speeds[prevIndex] as ArpeggioTime };
        }),
    }),
    {
      name: "keyboard-state",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
