import { useState, useCallback } from 'react';

export interface InstrumentState {
  velocity: number;
  setVelocity: (velocity: number) => void;
  sustain: boolean;
  setSustain: (sustain: boolean) => void;
  pressedFrets: Set<string>;
  setPressedFrets: (fretKey: string, action: 'add' | 'delete') => void;
  handleVelocityChange: (newVelocity: number) => void;
  handleFretPress: (stringIndex: number, fret: number) => string;
  handleFretRelease: (stringIndex: number, fret: number) => void;
}

export const useInstrumentState = (): InstrumentState => {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [sustain, setSustain] = useState<boolean>(false);
  const [pressedFrets, setPressedFretsState] = useState<Set<string>>(new Set());

  const handleVelocityChange = useCallback((newVelocity: number) => {
    setVelocity(newVelocity);
  }, []);

  const setPressedFrets = useCallback((fretKey: string, action: 'add' | 'delete') => {
    setPressedFretsState(prev => {
      if (action === 'add') {
        return new Set(prev).add(fretKey);
      } else {
        const newSet = new Set(prev);
        newSet.delete(fretKey);
        return newSet;
      }
    });
  }, []);

  const handleFretPress = useCallback((stringIndex: number, fret: number): string => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(fretKey, 'add');
    return fretKey;
  }, [setPressedFrets]);

  const handleFretRelease = useCallback((stringIndex: number, fret: number) => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(fretKey, 'delete');
  }, [setPressedFrets]);

  return {
    velocity,
    setVelocity,
    sustain,
    setSustain,
    pressedFrets,
    setPressedFrets,
    handleVelocityChange,
    handleFretPress,
    handleFretRelease,
  };
}; 