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

  const setSustainWithCallback = useCallback((newSustain: boolean) => {
    setSustain(newSustain);
    props.onSustainChange(newSustain);
  }, [props.onSustainChange]);

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
  }, [props.onSustainChange, props.onStopSustainedNotes]);

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
  }, [props.onPlayNotes, updatePressedKeys]);

  const stopNote = useCallback((note: string) => {
    props.onStopNotes([note]);
    updatePressedKeys(note, 'delete');
  }, [props.onStopNotes, updatePressedKeys]);

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
      }, 0);
    }
  }, [props.onReleaseKeyHeldNote, updatePressedKeys]);

  const stopSustainedNotes = useCallback(() => {
    props.onStopSustainedNotes();
    setSustain(false);
    setHasSustainedNotes(false);
    // Don't turn off toggle mode when stopping sustained notes
  }, [props.onStopSustainedNotes]);

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
  ]);
}; 