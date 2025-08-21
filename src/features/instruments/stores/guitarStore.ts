import {
  BRUSHING_TIMES,
  type BrushingTime,
} from "../constants/guitarShortcuts";
import {
  createInstrumentStore,
  createModeToggle,
  createEnumNavigation,
  type BaseInstrumentState,
} from "./createInstrumentStore";

// Guitar-specific state interface
interface GuitarSpecificState {
  mode: "basic" | "melody" | "chord";
  chordVoicing: number;
  brushingSpeed: BrushingTime;
}

// Guitar-specific actions interface
interface GuitarSpecificActions {
  setMode: (mode: "basic" | "melody" | "chord") => void;
  setChordVoicing: (voicing: number) => void;
  setBrushingSpeed: (speed: BrushingTime) => void;
  toggleMode: () => void;
  incrementChordVoicing: () => void;
  decrementChordVoicing: () => void;
  incrementBrushingSpeed: () => void;
  decrementBrushingSpeed: () => void;
}

// Combined state type
export type GuitarState = BaseInstrumentState &
  GuitarSpecificState &
  GuitarSpecificActions;

// Helper functions
const guitarModeToggle = createModeToggle([
  "basic",
  "melody",
  "chord",
] as const);
const brushingSpeedNav = createEnumNavigation(Object.values(BRUSHING_TIMES));

// Create the guitar store using the factory
export const useGuitarStore = createInstrumentStore<
  GuitarSpecificState & GuitarSpecificActions
>({
  initialState: {
    // Override base defaults for guitar
    velocity: 0.5,
    currentOctave: 3,

    // Guitar-specific initial state
    mode: "basic" as const,
    chordVoicing: 0,
    brushingSpeed: BRUSHING_TIMES.FAST,

    // Placeholder actions (will be overridden)
    setMode: () => {},
    setChordVoicing: () => {},
    setBrushingSpeed: () => {},
    toggleMode: () => {},
    incrementChordVoicing: () => {},
    decrementChordVoicing: () => {},
    incrementBrushingSpeed: () => {},
    decrementBrushingSpeed: () => {},
  },

  actions: (set) => ({
    // Guitar-specific setters
    setMode: (mode: "basic" | "melody" | "chord") => set({ mode } as any),
    setChordVoicing: (voicing: number) =>
      set({ chordVoicing: Math.max(-2, Math.min(2, voicing)) } as any),
    setBrushingSpeed: (speed: BrushingTime) =>
      set({ brushingSpeed: speed } as any),

    // Guitar-specific toggle actions
    toggleMode: () =>
      set((state: any) => ({ mode: guitarModeToggle(state.mode) })),

    // Guitar-specific increment/decrement actions
    incrementChordVoicing: () =>
      set((state: any) => ({
        chordVoicing: Math.min(2, state.chordVoicing + 1),
      })),
    decrementChordVoicing: () =>
      set((state: any) => ({
        chordVoicing: Math.max(-2, state.chordVoicing - 1),
      })),
    incrementBrushingSpeed: () =>
      set((state: any) => ({
        brushingSpeed: brushingSpeedNav.increment(state.brushingSpeed),
      })),
    decrementBrushingSpeed: () =>
      set((state: any) => ({
        brushingSpeed: brushingSpeedNav.decrement(state.brushingSpeed),
      })),
  }),

  persistKey: "guitar-state",
});
