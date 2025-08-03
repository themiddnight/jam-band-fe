import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { KeyboardMode } from '../components/Keyboard/types/keyboard';

interface VirtualKeyboardState {
  // Main states
  mode: KeyboardMode;
  currentOctave: number;
  velocity: number;
  chordVoicing: number;
  
  // Actions
  setMode: (mode: KeyboardMode) => void;
  setCurrentOctave: (octave: number) => void;
  setVelocity: (velocity: number) => void;
  setChordVoicing: (voicing: number) => void;
  
  // Utility actions
  toggleMode: () => void;
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
      mode: 'simple-melody',
      currentOctave: 2,
      velocity: 0.7,
      chordVoicing: 0,
      
      // Basic setters
      setMode: (mode) => set({ mode }),
      setCurrentOctave: (octave) => set({ currentOctave: Math.max(0, Math.min(8, octave)) }),
      setVelocity: (velocity) => set({ velocity: Math.max(0, Math.min(1, velocity)) }),
      setChordVoicing: (voicing) => set({ chordVoicing: Math.max(-2, Math.min(2, voicing)) }),
      
      // Toggle actions
      toggleMode: () => set((state) => ({ 
        mode: state.mode === 'simple-melody' ? 'simple-chord' : 'simple-melody' 
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