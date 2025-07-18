import React from 'react';
import type { ReactNode } from 'react';
import type { KeyboardState, ScaleState, VirtualKeyboardState } from '../../../types/keyboard';
import { KeyboardContext } from '../../../context/KeyboardContext';

interface KeyboardProviderProps {
  children: ReactNode;
  keyboardState: KeyboardState;
  scaleState: ScaleState;
  virtualKeyboard: VirtualKeyboardState;
}

export const KeyboardProvider: React.FC<KeyboardProviderProps> = ({
  children,
  keyboardState,
  scaleState,
  virtualKeyboard,
}) => {
  const value = {
    keyboardState,
    scaleState,
    virtualKeyboard,
  };

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}; 