import { 
  createInstrumentStore, 
  createModeToggle, 
  type BaseInstrumentState 
} from "./createInstrumentStore";

// Bass-specific state interface
interface BassSpecificState {
  mode: "basic" | "melody";
  alwaysRoot: boolean;
}

// Bass-specific actions interface
interface BassSpecificActions {
  setMode: (mode: "basic" | "melody") => void;
  setAlwaysRoot: (alwaysRoot: boolean) => void;
  toggleMode: () => void;
  toggleAlwaysRoot: () => void;
}

// Combined state type
export type BassState = BaseInstrumentState & BassSpecificState & BassSpecificActions;

// Helper functions
const bassModeToggle = createModeToggle(["basic", "melody"] as const);

// Create the bass store using the factory
export const useBassStore = createInstrumentStore<BassSpecificState & BassSpecificActions>({
  initialState: {
    // Override base defaults for bass
    velocity: 0.6,
    currentOctave: 2,
    
    // Bass-specific initial state
    mode: "basic" as const,
    alwaysRoot: false,
    
    // Placeholder actions (will be overridden)
    setMode: () => {},
    setAlwaysRoot: () => {},
    toggleMode: () => {},
    toggleAlwaysRoot: () => {},
  },
  
  actions: (set) => ({
    // Bass-specific setters
    setMode: (mode: "basic" | "melody") => set({ mode } as any),
    setAlwaysRoot: (alwaysRoot: boolean) => set({ alwaysRoot } as any),

    // Bass-specific toggle actions
    toggleMode: () =>
      set((state: any) => ({ mode: bassModeToggle(state.mode) })),
    toggleAlwaysRoot: () =>
      set((state: any) => ({ alwaysRoot: !state.alwaysRoot })),
  }),
  
  bounds: {
    // Bass has lower octave range
    octave: { min: 0, max: 6 },
    velocity: { min: 0.1, max: 1, step: 0.1 },
  },
  
  persistKey: "bass-state",
});
