import { createContext } from 'react';
import type { KeyboardState, ScaleState, VirtualKeyboardState } from '../types/keyboard';

interface KeyboardContextValue {
  keyboardState: KeyboardState;
  scaleState: ScaleState;
  virtualKeyboard: VirtualKeyboardState;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null); 