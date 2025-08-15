import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Base interface that all instruments inherit from
export interface BaseInstrumentState {
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

// Configuration for creating instrument stores
export interface InstrumentStoreConfig<T> {
  // Initial state (will be merged with base state)
  initialState: Partial<BaseInstrumentState> & T;
  
  // Instrument-specific actions
  actions?: (set: any, get: any) => Record<string, any>;
  
  // Persistence key
  persistKey: string;
  
  // Custom bounds for common properties
  bounds?: {
    velocity?: { min: number; max: number; step: number };
    octave?: { min: number; max: number };
  };
}

// Default bounds
const DEFAULT_BOUNDS = {
  velocity: { min: 0, max: 1, step: 0.1 },
  octave: { min: 0, max: 8 },
};

/**
 * Factory function to create instrument stores with common functionality
 * Eliminates code duplication across instrument stores
 */
export function createInstrumentStore<T extends Record<string, any>>(
  config: InstrumentStoreConfig<T>
) {
  type FullState = BaseInstrumentState & T;
  
  const bounds = { ...DEFAULT_BOUNDS, ...config.bounds };

  return create<FullState>()(
    persist(
      (set, get) => ({
        // Default base state
        velocity: 0.7,
        currentOctave: 3,
        sustain: false,
        sustainToggle: false,
        
        // Merge with instrument-specific initial state
        ...config.initialState,

        // Common setters with bounds checking
        setVelocity: (velocity: number) =>
          set({ 
            velocity: Math.max(bounds.velocity.min, Math.min(bounds.velocity.max, velocity)) 
          } as Partial<FullState>),
        setCurrentOctave: (octave: number) =>
          set({ 
            currentOctave: Math.max(bounds.octave.min, Math.min(bounds.octave.max, octave)) 
          } as Partial<FullState>),
        setSustain: (sustain: boolean) => set({ sustain } as Partial<FullState>),
        setSustainToggle: (sustainToggle: boolean) => set({ sustainToggle } as Partial<FullState>),

        // Common toggle actions
        toggleSustain: () => set((state: FullState) => ({ sustain: !state.sustain } as Partial<FullState>)),
        toggleSustainToggle: () =>
          set((state: FullState) => ({ sustainToggle: !state.sustainToggle } as Partial<FullState>)),

        // Common increment/decrement actions
        incrementOctave: () =>
          set((state: FullState) => ({
            currentOctave: Math.min(bounds.octave.max, state.currentOctave + 1),
          } as Partial<FullState>)),
        decrementOctave: () =>
          set((state: FullState) => ({
            currentOctave: Math.max(bounds.octave.min, state.currentOctave - 1),
          } as Partial<FullState>)),
        incrementVelocity: () =>
          set((state: FullState) => ({
            velocity: Math.min(bounds.velocity.max, state.velocity + bounds.velocity.step),
          } as Partial<FullState>)),
        decrementVelocity: () =>
          set((state: FullState) => ({
            velocity: Math.max(bounds.velocity.min, state.velocity - bounds.velocity.step),
          } as Partial<FullState>)),

        // Add instrument-specific actions
        ...(config.actions ? config.actions(set, get) : {}),
      }) as FullState,
      {
        name: config.persistKey,
        storage: createJSONStorage(() => localStorage),
      }
    )
  );
}

// Helper for creating mode toggle functions
export const createModeToggle = <T extends string>(modes: T[]) => 
  (currentMode: T): T => {
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    return modes[nextIndex];
  };

// Helper for creating enum increment/decrement functions
export const createEnumNavigation = <T>(values: T[]) => ({
  increment: (current: T): T => {
    const currentIndex = values.indexOf(current);
    const nextIndex = Math.min(values.length - 1, currentIndex + 1);
    return values[nextIndex];
  },
  decrement: (current: T): T => {
    const currentIndex = values.indexOf(current);
    const prevIndex = Math.max(0, currentIndex - 1);
    return values[prevIndex];
  },
});
