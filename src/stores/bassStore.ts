import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface BassState {
  // Main states
  mode: "finger" | "pick" | "slap";
  velocity: number;
  currentOctave: number;
  sustain: boolean;
  sustainToggle: boolean;
  palmMute: boolean;

  // Actions
  setMode: (mode: "finger" | "pick" | "slap") => void;
  setVelocity: (velocity: number) => void;
  setCurrentOctave: (octave: number) => void;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (sustainToggle: boolean) => void;
  setPalmMute: (palmMute: boolean) => void;

  // Utility actions
  toggleMode: () => void;
  incrementOctave: () => void;
  decrementOctave: () => void;
  incrementVelocity: () => void;
  decrementVelocity: () => void;
  toggleSustain: () => void;
  toggleSustainToggle: () => void;
  togglePalmMute: () => void;
}

export const useBassStore = create<BassState>()(
  persist(
    (set) => ({
      // Initial state
      mode: "finger",
      velocity: 0.7,
      currentOctave: 2,
      sustain: false,
      sustainToggle: false,
      palmMute: false,

      // Basic setters
      setMode: (mode) => set({ mode }),
      setVelocity: (velocity) =>
        set({ velocity: Math.max(0, Math.min(1, velocity)) }),
      setCurrentOctave: (octave) =>
        set({ currentOctave: Math.max(0, Math.min(6, octave)) }),
      setSustain: (sustain) => set({ sustain }),
      setSustainToggle: (sustainToggle) => set({ sustainToggle }),
      setPalmMute: (palmMute) => set({ palmMute }),

      // Toggle actions
      toggleMode: () =>
        set((state) => {
          const modes: ("finger" | "pick" | "slap")[] = [
            "finger",
            "pick",
            "slap",
          ];
          const currentIndex = modes.indexOf(state.mode);
          const nextIndex = (currentIndex + 1) % modes.length;
          return { mode: modes[nextIndex] };
        }),
      toggleSustain: () => set((state) => ({ sustain: !state.sustain })),
      toggleSustainToggle: () =>
        set((state) => ({ sustainToggle: !state.sustainToggle })),
      togglePalmMute: () => set((state) => ({ palmMute: !state.palmMute })),

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
          velocity: Math.max(0, state.velocity - 0.1),
        })),
    }),
    {
      name: "bass-state",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
