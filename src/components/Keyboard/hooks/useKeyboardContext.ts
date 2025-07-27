import { useContext } from 'react';
import { KeyboardContext } from '../../../context/KeyboardContext';

export const useKeyboardContext = () => {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboardContext must be used within a KeyboardProvider');
  }
  return context;
}; 