import { useState, useCallback, useMemo, useRef } from 'react';
import type { Props } from '../index';

export const useKeyboardState = (props: Props) => {
  const [sustain, setSustain] = useState<boolean>(false);
  const [sustainToggle, setSustainToggle] = useState<boolean>(false);
  const [hasSustainedNotes, setHasSustainedNotes] = useState<boolean>(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [heldKeys, setHeldKeys] = useState<Set<string>>(new Set());

  // Use ref to track current state for stable callbacks
  const stateRef = useRef({ sustain, sustainToggle, pressedKeys });
  stateRef.current = { sustain, sustainToggle, pressedKeys };

  // Improved setSustain with better state consistency
  const setSustainWithCallback = useCallback((newSustain: boolean) => {
    setSustain(newSustain);
    props.onSustainChange(newSustain);
    
    // If turning off sustain and not in toggle mode, ensure sustained notes stop
    if (!newSustain && !stateRef.current.sustainToggle) {
      setHasSustainedNotes(false);
      props.onStopSustainedNotes();
    }
  }, [props]);

  const setSustainToggleWithCallback = useCallback((newSustainToggle: boolean) => {
    setSustainToggle(newSustainToggle);
    if (newSustainToggle) {
      setSustain(true);
      props.onSustainChange(true);
    } else {
      setSustain(false);
      props.onSustainChange(false);
      props.onStopSustainedNotes();
    }
  }, [props]);

  // Optimized set operations for pressed keys
  const updatePressedKeys = useCallback((note: string, action: 'add' | 'delete') => {
    setPressedKeys(prev => {
      const hasNote = prev.has(note);
      if (action === 'add' && hasNote) return prev;
      if (action === 'delete' && !hasNote) return prev;
      
      const newSet = new Set(prev);
      if (action === 'add') {
        newSet.add(note);
      } else {
        newSet.delete(note);
      }
      return newSet;
    });
  }, []);

  const playNote = useCallback(async (note: string, vel: number, isKeyHeld: boolean = false) => {
    await props.onPlayNotes([note], vel, isKeyHeld);
    
    if (isKeyHeld) {
      updatePressedKeys(note, 'add');
    }
    
    // When toggle is active and we play a note, it will be sustained
    if (stateRef.current.sustainToggle && !isKeyHeld) {
      setHasSustainedNotes(true);
    }
  }, [props, updatePressedKeys]);

  const stopNote = useCallback((note: string) => {
    props.onStopNotes([note]);
    updatePressedKeys(note, 'delete');
  }, [props, updatePressedKeys]);

  const releaseKeyHeldNote = useCallback((note: string) => {
    props.onReleaseKeyHeldNote(note);
    updatePressedKeys(note, 'delete');
    
    // When toggle is active and we release a key, check if we should turn off sustained notes
    if (stateRef.current.sustainToggle) {
      // Use setTimeout to ensure state is updated before checking
      setTimeout(() => {
        setPressedKeys(current => {
          if (current.size === 0) {
            setHasSustainedNotes(false);
          }
          return current;
        });
      }, 10); // Reduced timeout for better responsiveness
    }
  }, [props, updatePressedKeys]);

  const stopSustainedNotes = useCallback(() => {
    props.onStopSustainedNotes();
    setHasSustainedNotes(false);
    
    // Also ensure sustain state is properly reset if not in toggle mode
    if (!stateRef.current.sustainToggle) {
      setSustain(false);
      props.onSustainChange(false);
    }
  }, [props]);

  // Add force reset mechanism for stuck states
  const forceResetSustain = useCallback(() => {
    setSustain(false);
    setSustainToggle(false);
    setHasSustainedNotes(false);
    props.onSustainChange(false);
    props.onStopSustainedNotes();
  }, [props]);

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(() => ({
    sustain,
    sustainToggle,
    hasSustainedNotes,
    pressedKeys,
    heldKeys,
    setHeldKeys,
    setSustain: setSustainWithCallback,
    setSustainToggle: setSustainToggleWithCallback,
    setPressedKeys,
    playNote,
    stopNote,
    releaseKeyHeldNote,
    stopSustainedNotes,
    forceResetSustain,
  }), [
    sustain,
    sustainToggle,
    hasSustainedNotes,
    pressedKeys,
    heldKeys,
    setSustainWithCallback,
    setSustainToggleWithCallback,
    playNote,
    stopNote,
    releaseKeyHeldNote,
    stopSustainedNotes,
    forceResetSustain,
  ]);
}; 