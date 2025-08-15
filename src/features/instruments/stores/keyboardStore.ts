import type { KeyboardMode } from "../components/Keyboard/types/keyboard";
import {
  ARPEGGIO_TIMES,
  type ArpeggioTime,
} from "../constants/keyboardShortcuts";
import { 
  createInstrumentStore, 
  createModeToggle, 
  createEnumNavigation,
  type BaseInstrumentState 
} from "./createInstrumentStore";

// Keyboard-specific state interface
interface KeyboardSpecificState {
  mode: KeyboardMode;
  chordVoicing: number;
  arpeggioSpeed: ArpeggioTime;
}

// Keyboard-specific actions interface
interface KeyboardSpecificActions {
  setMode: (mode: KeyboardMode) => void;
  setChordVoicing: (voicing: number) => void;
  setArpeggioSpeed: (speed: ArpeggioTime) => void;
  toggleMode: () => void;
  incrementChordVoicing: () => void;
  decrementChordVoicing: () => void;
  incrementArpeggioSpeed: () => void;
  decrementArpeggioSpeed: () => void;
}

// Combined state type
export type KeyboardState = BaseInstrumentState & KeyboardSpecificState & KeyboardSpecificActions;

// Helper functions
const keyboardModeToggle = createModeToggle(["simple-melody", "simple-chord"] as const);
const arpeggioSpeedNav = createEnumNavigation(Object.values(ARPEGGIO_TIMES));

// Create the keyboard store using the factory
export const useKeyboardStore = createInstrumentStore<KeyboardSpecificState & KeyboardSpecificActions>({
  initialState: {
    // Override base defaults for keyboard
    velocity: 0.7,
    currentOctave: 2,
    
    // Keyboard-specific initial state
    mode: "simple-melody" as KeyboardMode,
    chordVoicing: 0,
    arpeggioSpeed: ARPEGGIO_TIMES.FAST,
    
    // Placeholder actions (will be overridden)
    setMode: () => {},
    setChordVoicing: () => {},
    setArpeggioSpeed: () => {},
    toggleMode: () => {},
    incrementChordVoicing: () => {},
    decrementChordVoicing: () => {},
    incrementArpeggioSpeed: () => {},
    decrementArpeggioSpeed: () => {},
  },
  
  actions: (set) => ({
    // Keyboard-specific setters
    setMode: (mode: KeyboardMode) => set({ mode } as any),
    setChordVoicing: (voicing: number) =>
      set({ chordVoicing: Math.max(-2, Math.min(2, voicing)) } as any),
    setArpeggioSpeed: (speed: ArpeggioTime) => set({ arpeggioSpeed: speed } as any),

    // Keyboard-specific toggle actions
    toggleMode: () =>
      set((state: any) => ({ mode: keyboardModeToggle(state.mode) })),

    // Keyboard-specific increment/decrement actions
    incrementChordVoicing: () =>
      set((state: any) => ({
        chordVoicing: Math.min(2, state.chordVoicing + 1),
      })),
    decrementChordVoicing: () =>
      set((state: any) => ({
        chordVoicing: Math.max(-2, state.chordVoicing - 1),
      })),
    incrementArpeggioSpeed: () =>
      set((state: any) => ({
        arpeggioSpeed: arpeggioSpeedNav.increment(state.arpeggioSpeed),
      })),
    decrementArpeggioSpeed: () =>
      set((state: any) => ({
        arpeggioSpeed: arpeggioSpeedNav.decrement(state.arpeggioSpeed),
      })),
  }),
  
  persistKey: "keyboard-state",
});
