import { useCallback } from 'react';
import {
  melodySimpleKeys,
  melodySimpleKeysUpper,
  melodyAdvancedKeys,
  chordRootKeys,
  chordTriadKeys,
} from "../../../constants/virtualKeyboardKeys";
import type { KeyboardState, ScaleState, VirtualKeyboardState } from "../../../types/keyboard";

export const useNoteStopping = (
  keyboardState: KeyboardState,
  scaleState: ScaleState,
  virtualKeyboard: VirtualKeyboardState
) => {
  const stopMelodyNote = useCallback((keyIndex: number, octaveOffset: number = 0) => {
    const scaleNotes = scaleState.getScaleNotes(
      scaleState.rootNote,
      scaleState.scale,
      keyboardState.currentOctave + octaveOffset
    );
    if (keyIndex < scaleNotes.length) {
      keyboardState.releaseKeyHeldNote(scaleNotes[keyIndex]);
    } else {
      const nextOctaveNotes = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        keyboardState.currentOctave + octaveOffset + 1
      );
      if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
        keyboardState.releaseKeyHeldNote(
          nextOctaveNotes[keyIndex - scaleNotes.length]
        );
      }
    }
  }, [keyboardState, scaleState]);

  const stopChordNote = useCallback((keyIndex: number) => {
    const scaleNotes = scaleState.getScaleNotes(
      scaleState.rootNote,
      scaleState.scale,
      keyboardState.currentOctave
    );
    if (keyIndex < scaleNotes.length) {
      keyboardState.releaseKeyHeldNote(scaleNotes[keyIndex]);
    }
  }, [keyboardState, scaleState]);

  const stopTriadChord = useCallback((keyIndex: number) => {
    const chord = virtualKeyboard.activeTriadChords.get(keyIndex);
    if (chord) {
      chord.forEach((note: string) =>
        keyboardState.releaseKeyHeldNote(note)
      );
      virtualKeyboard.setActiveTriadChords(
        (prev: Map<number, string[]>) => {
          const newMap = new Map(prev);
          newMap.delete(keyIndex);
          return newMap;
        }
      );
    }
    virtualKeyboard.setPressedTriads((prev: Set<number>) => {
      const newSet = new Set(prev);
      newSet.delete(keyIndex);
      return newSet;
    });
  }, [keyboardState, virtualKeyboard]);

  const stopAdvancedNote = useCallback((keyIndex: number) => {
    const noteMapping = [
      "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
      "C", "C#", "D", "D#", "E", "F", "F#",
    ];
    const octaveOffset = keyIndex >= 12 ? 1 : 0;
    const note = `${noteMapping[keyIndex]}${keyboardState.currentOctave + octaveOffset}`;
    keyboardState.releaseKeyHeldNote(note);
  }, [keyboardState]);

  const handleNoteStopping = useCallback((key: string) => {
    if (keyboardState.mainMode === "simple") {
      if (keyboardState.simpleMode === "melody") {
        // Lower row keys
        if (melodySimpleKeys.includes(key)) {
          const keyIndex = melodySimpleKeys.indexOf(key);
          stopMelodyNote(keyIndex);
        }
        // Upper row keys
        else if (melodySimpleKeysUpper.includes(key)) {
          const keyIndex = melodySimpleKeysUpper.indexOf(key);
          stopMelodyNote(keyIndex, 1);
        }
      } else if (keyboardState.simpleMode === "chord") {
        if (chordRootKeys.includes(key)) {
          const keyIndex = chordRootKeys.indexOf(key);
          stopChordNote(keyIndex);
        } else if (chordTriadKeys.includes(key)) {
          const keyIndex = chordTriadKeys.indexOf(key);
          stopTriadChord(keyIndex);
        }
      }
    } else if (keyboardState.mainMode === "advanced") {
      if (melodyAdvancedKeys.includes(key)) {
        const keyIndex = melodyAdvancedKeys.indexOf(key);
        stopAdvancedNote(keyIndex);
      }
    }
  }, [keyboardState, stopMelodyNote, stopChordNote, stopTriadChord, stopAdvancedNote]);

  return { handleNoteStopping };
}; 