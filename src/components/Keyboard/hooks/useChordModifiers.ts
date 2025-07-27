import { useCallback } from 'react';
import { getChordModifierKeys } from '../../../constants/keyboardShortcuts';
import { useKeyboardShortcutsStore } from '../../../stores/keyboardShortcutsStore';
import type { KeyboardState, ScaleState, VirtualKeyboardState } from '../../../types/keyboard';

export const useChordModifiers = (
  keyboardState: KeyboardState,
  scaleState: ScaleState,
  virtualKeyboard: VirtualKeyboardState
) => {
  const shortcuts = useKeyboardShortcutsStore((state) => state.shortcuts);

  const handleChordModifierPress = useCallback((key: string) => {
    if (
      getChordModifierKeys(shortcuts).includes(key) &&
      keyboardState.mainMode === "simple" &&
      keyboardState.simpleMode === "chord"
    ) {
      virtualKeyboard.setChordModifiers((prev: Set<string>) =>
        new Set(prev).add(key)
      );
      return true;
    }
    return false;
  }, [keyboardState, virtualKeyboard, shortcuts]);

  const handleChordModifierRelease = useCallback((key: string) => {
    if (
      getChordModifierKeys(shortcuts).includes(key) &&
      keyboardState.mainMode === "simple" &&
      keyboardState.simpleMode === "chord"
    ) {
      virtualKeyboard.setChordModifiers((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });

      // Handle modifier release logic
      virtualKeyboard.activeTriadChords.forEach(
        (chord: string[], triadIndex: number) => {
          if (virtualKeyboard.pressedTriads.has(triadIndex)) {
            const newChord = virtualKeyboard.getChord(
              scaleState.rootNote,
              scaleState.scale,
              triadIndex,
              virtualKeyboard.chordVoicing,
              virtualKeyboard.chordModifiers
            );

            // Release notes that are no longer in the chord
            chord.forEach((note: string) => {
              if (!newChord.includes(note)) {
                keyboardState.releaseKeyHeldNote(note);
              }
            });

            // Play new notes simultaneously to avoid flam
            const newNotes = newChord.filter((note: string) => !chord.includes(note));
            if (newNotes.length > 0) {
              // Play all new notes simultaneously by calling playNote for each note without await
              // This ensures all notes are triggered at the same time without waiting for each one
              newNotes.forEach((note: string) => {
                keyboardState.playNote(note, keyboardState.velocity, true);
              });
            }

            virtualKeyboard.setActiveTriadChords(
              (prev: Map<number, string[]>) =>
                new Map(prev).set(triadIndex, newChord)
            );
          }
        }
      );
      return true;
    }
    return false;
  }, [keyboardState, virtualKeyboard, shortcuts, scaleState.rootNote, scaleState.scale]);

  return { handleChordModifierPress, handleChordModifierRelease };
}; 