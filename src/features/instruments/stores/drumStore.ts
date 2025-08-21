import {
  createInstrumentStore,
  createModeToggle,
  type BaseInstrumentState,
} from "./createInstrumentStore";

// Drum-specific state interface
interface DrumSpecificState {
  mode: "basic" | "advanced" | "pattern";
  tempo: number;
  swing: number;
}

// Drum-specific actions interface
interface DrumSpecificActions {
  setMode: (mode: "basic" | "advanced" | "pattern") => void;
  setTempo: (tempo: number) => void;
  setSwing: (swing: number) => void;
  toggleMode: () => void;
  incrementTempo: () => void;
  decrementTempo: () => void;
  incrementSwing: () => void;
  decrementSwing: () => void;
}

// Combined state type
export type DrumState = BaseInstrumentState &
  DrumSpecificState &
  DrumSpecificActions;

// Helper functions
const drumModeToggle = createModeToggle([
  "basic",
  "advanced",
  "pattern",
] as const);

// Create the drum store using the factory
export const useDrumStore = createInstrumentStore<
  DrumSpecificState & DrumSpecificActions
>({
  initialState: {
    // Override base defaults for drums
    velocity: 0.8,

    // Drum-specific initial state
    mode: "basic" as const,
    tempo: 120,
    swing: 0,

    // Placeholder actions (will be overridden)
    setMode: () => {},
    setTempo: () => {},
    setSwing: () => {},
    toggleMode: () => {},
    incrementTempo: () => {},
    decrementTempo: () => {},
    incrementSwing: () => {},
    decrementSwing: () => {},
  },

  actions: (set) => ({
    // Drum-specific setters
    setMode: (mode: "basic" | "advanced" | "pattern") => set({ mode } as any),
    setTempo: (tempo: number) =>
      set({ tempo: Math.max(60, Math.min(200, tempo)) } as any),
    setSwing: (swing: number) =>
      set({ swing: Math.max(0, Math.min(1, swing)) } as any),

    // Drum-specific toggle actions
    toggleMode: () =>
      set((state: any) => ({ mode: drumModeToggle(state.mode) })),

    // Drum-specific increment/decrement actions
    incrementTempo: () =>
      set((state: any) => ({
        tempo: Math.min(200, state.tempo + 5),
      })),
    decrementTempo: () =>
      set((state: any) => ({
        tempo: Math.max(60, state.tempo - 5),
      })),
    incrementSwing: () =>
      set((state: any) => ({
        swing: Math.min(1, state.swing + 0.1),
      })),
    decrementSwing: () =>
      set((state: any) => ({
        swing: Math.max(0, state.swing - 0.1),
      })),
  }),

  persistKey: "drum-state",
});
