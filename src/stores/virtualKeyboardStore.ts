import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MainMode, SimpleMode } from '../components/Keyboard/types/keyboard';

interface VirtualKeyboardState {
  // Main states
  mainMode: MainMode;
  simpleMode: SimpleMode;
  currentOctave: number;
  velocity: number;
  chordVoicing: number;
  
  // Actions
  setMainMode: (mode: MainMode) => void;
  setSimpleMode: (mode: SimpleMode) => void;
  setCurrentOctave: (octave: number) => void;
  setVelocity: (velocity: number) => void;
  setChordVoicing: (voicing: number) => void;
  
  // Utility actions
  toggleMainMode: () => void;
  toggleSimpleMode: () => void;
  incrementOctave: () => void;
  decrementOctave: () => void;
  incrementVelocity: () => void;
  decrementVelocity: () => void;
  incrementChordVoicing: () => void;
  decrementChordVoicing: () => void;
}

export const useVirtualKeyboardStore = create<VirtualKeyboardState>()(
  persist(
    (set) => ({
      // Initial state
      mainMode: 'simple',
      simpleMode: 'melody',
      currentOctave: 2,
      velocity: 0.7,
      chordVoicing: 0,
      
      // Basic setters
      setMainMode: (mode) => set({ mainMode: mode }),
      setSimpleMode: (mode) => set({ simpleMode: mode }),
      setCurrentOctave: (octave) => set({ currentOctave: Math.max(0, Math.min(8, octave)) }),
      setVelocity: (velocity) => set({ velocity: Math.max(0, Math.min(1, velocity)) }),
      setChordVoicing: (voicing) => set({ chordVoicing: Math.max(-2, Math.min(2, voicing)) }),
      
      // Toggle actions
      toggleMainMode: () => set((state) => ({ 
        mainMode: state.mainMode === 'simple' ? 'advanced' : 'simple' 
      })),
      toggleSimpleMode: () => set((state) => ({ 
        simpleMode: state.simpleMode === 'melody' ? 'chord' : 'melody' 
      })),
      
      // Increment/Decrement actions
      incrementOctave: () => set((state) => ({ 
        currentOctave: Math.min(8, state.currentOctave + 1) 
      })),
      decrementOctave: () => set((state) => ({ 
        currentOctave: Math.max(0, state.currentOctave - 1) 
      })),
      incrementVelocity: () => set((state) => ({ 
        velocity: Math.min(1, state.velocity + 0.1) 
      })),
      decrementVelocity: () => set((state) => ({ 
        velocity: Math.max(0, state.velocity - 0.1) 
      })),
      incrementChordVoicing: () => set((state) => ({ 
        chordVoicing: Math.min(2, state.chordVoicing + 1) 
      })),
      decrementChordVoicing: () => set((state) => ({ 
        chordVoicing: Math.max(-2, state.chordVoicing - 1) 
      })),
    }),
    {
      name: 'virtual-keyboard-state',
      storage: createJSONStorage(() => localStorage),
    }
  )
); 