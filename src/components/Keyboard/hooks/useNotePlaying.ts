import { useCallback } from 'react';
import {
  melodySimpleKeys,
  melodySimpleKeysUpper,
  melodyAdvancedKeys,
  chordRootKeys,
  chordTriadKeys,
} from "../../../constants/virtualKeyboardKeys";
import type { KeyboardState, ScaleState, VirtualKeyboardState } from "../../../types/keyboard";

export const useNotePlaying = (
  keyboardState: KeyboardState,
  scaleState: ScaleState,
  virtualKeyboard: VirtualKeyboardState
) => {
  const playMelodyNote = useCallback(async (keyIndex: number, octaveOffset: number = 0) => {
    const scaleNotes = scaleState.getScaleNotes(
      scaleState.rootNote,
      scaleState.scale,
      keyboardState.currentOctave + octaveOffset
    );
    
    if (keyIndex < scaleNotes.length) {
      await keyboardState.playNote(scaleNotes[keyIndex], keyboardState.velocity, true);
    } else {
      const nextOctaveNotes = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        keyboardState.currentOctave + octaveOffset + 1
      );
      if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
        await keyboardState.playNote(
          nextOctaveNotes[keyIndex - scaleNotes.length],
          keyboardState.velocity,
          true
        );
      }
    }
  }, [keyboardState, scaleState]);

  const playChordNote = useCallback(async (keyIndex: number) => {
    const scaleNotes = scaleState.getScaleNotes(
      scaleState.rootNote,
      scaleState.scale,
      keyboardState.currentOctave
    );
    if (keyIndex < scaleNotes.length) {
      await keyboardState.playNote(scaleNotes[keyIndex], keyboardState.velocity, true);
    }
  }, [keyboardState, scaleState]);

  const playTriadChord = useCallback(async (keyIndex: number) => {
    const chord = virtualKeyboard.getChord(
      scaleState.rootNote,
      scaleState.scale,
      keyIndex,
      virtualKeyboard.chordVoicing,
      virtualKeyboard.chordModifiers
    );

    virtualKeyboard.setActiveTriadChords(
      (prev: Map<number, string[]>) => new Map(prev).set(keyIndex, chord)
    );
    // Play all notes simultaneously to avoid flam
    await Promise.all(chord.map(note => keyboardState.playNote(note, keyboardState.velocity, true)));
    virtualKeyboard.setPressedTriads((prev: Set<number>) =>
      new Set(prev).add(keyIndex)
    );
  }, [keyboardState, scaleState, virtualKeyboard]);

  const playAdvancedNote = useCallback(async (keyIndex: number) => {
    const noteMapping = [
      "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
      "C", "C#", "D", "D#", "E", "F", "F#",
    ];
    const octaveOffset = keyIndex >= 12 ? 1 : 0;
    const note = `${noteMapping[keyIndex]}${keyboardState.currentOctave + octaveOffset}`;
    await keyboardState.playNote(note, keyboardState.velocity, true);
  }, [keyboardState]);

  const handleNotePlaying = useCallback(async (key: string) => {
    if (keyboardState.mainMode === "simple") {
      if (keyboardState.simpleMode === "melody") {
        // Lower row keys
        if (melodySimpleKeys.includes(key)) {
          const keyIndex = melodySimpleKeys.indexOf(key);
          await playMelodyNote(keyIndex);
        }
        // Upper row keys
        else if (melodySimpleKeysUpper.includes(key)) {
          const keyIndex = melodySimpleKeysUpper.indexOf(key);
          await playMelodyNote(keyIndex, 1);
        }
      } else if (keyboardState.simpleMode === "chord") {
        if (chordRootKeys.includes(key)) {
          const keyIndex = chordRootKeys.indexOf(key);
          await playChordNote(keyIndex);
        } else if (chordTriadKeys.includes(key)) {
          const keyIndex = chordTriadKeys.indexOf(key);
          await playTriadChord(keyIndex);
        }
      }
    } else if (keyboardState.mainMode === "advanced") {
      if (melodyAdvancedKeys.includes(key)) {
        const keyIndex = melodyAdvancedKeys.indexOf(key);
        await playAdvancedNote(keyIndex);
      }
    }
  }, [keyboardState, playMelodyNote, playChordNote, playTriadChord, playAdvancedNote]);

  return { handleNotePlaying };
}; 