import { useState, useCallback } from 'react';
import type { Props } from '../index';

export const useKeyboardState = (props: Props) => {
  const [sustain, setSustain] = useState<boolean>(false);
  const [sustainToggle, setSustainToggle] = useState<boolean>(false);
  const [hasSustainedNotes, setHasSustainedNotes] = useState<boolean>(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [heldKeys, setHeldKeys] = useState<Set<string>>(new Set());

  const setSustainWithCallback = useCallback((newSustain: boolean) => {
    setSustain(newSustain);
    props.onSustainChange(newSustain);
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

  const playNote = useCallback(async (note: string, vel: number, isKeyHeld: boolean = false) => {
    await props.onPlayNotes([note], vel, isKeyHeld);
    if (isKeyHeld) {
      setPressedKeys(new Set([...pressedKeys, note]));
    }
    // When toggle is active and we play a note, it will be sustained
    if (sustainToggle && !isKeyHeld) {
      setHasSustainedNotes(true);
    }
  }, [props, sustainToggle, pressedKeys]);

  const stopNote = useCallback((note: string) => {
    props.onStopNotes([note]);
    const newPressedKeys = new Set(pressedKeys);
    newPressedKeys.delete(note);
    setPressedKeys(newPressedKeys);
  }, [props, pressedKeys]);

  const releaseKeyHeldNote = useCallback((note: string) => {
    props.onReleaseKeyHeldNote(note);
    const newPressedKeys = new Set(pressedKeys);
    newPressedKeys.delete(note);
    setPressedKeys(newPressedKeys);
    // When toggle is active and we release a key, check if we should turn off sustained notes
    if (sustainToggle && newPressedKeys.size === 0) {
      setHasSustainedNotes(false);
    }
  }, [props, pressedKeys, sustainToggle]);

  const stopSustainedNotes = useCallback(() => {
    props.onStopSustainedNotes();
    setSustain(false);
    setHasSustainedNotes(false);
    // Don't turn off toggle mode when stopping sustained notes
  }, [props]);

  return {
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
  };
}; 