import { useCallback } from "react";
import { getChordModifierKeys, DEFAULT_KEYBOARD_SHORTCUTS } from "../../../constants/keyboardShortcuts";
import type { KeyboardState, ScaleState, VirtualKeyboardState } from "../../../types/keyboard";

export const useChordModifiers = (
  keyboardState: KeyboardState,
  scaleState: ScaleState,
  virtualKeyboard: VirtualKeyboardState
) => {
  const chordModifierKeys = getChordModifierKeys(DEFAULT_KEYBOARD_SHORTCUTS);

  const handleChordModifierPress = useCallback(
    (key: string): boolean => {
      if (
        keyboardState.mode === "simple-chord" &&
        chordModifierKeys.includes(key)
      ) {
        // Add the modifier to the chord modifiers set
        virtualKeyboard.setChordModifiers((prev: Set<string>) => {
          if (prev.has(key)) return prev;
          return new Set(prev).add(key);
        });
        
        // Update all active triad chords with the new modifier
        virtualKeyboard.activeTriadChords.forEach((chord, triadIndex) => {
          if (virtualKeyboard.pressedTriads.has(triadIndex)) {
            const newChord = virtualKeyboard.getChord(
              scaleState.rootNote,
              scaleState.scale,
              triadIndex,
              virtualKeyboard.chordVoicing,
              virtualKeyboard.chordModifiers
            );
            
            // Release old chord notes
            chord.forEach((note: string) => {
              keyboardState.releaseKeyHeldNote(note);
            });
            
            // Play new chord notes
            newChord.forEach((note: string) => {
              keyboardState.playNote(note, keyboardState.velocity, true);
            });
            
            // Update the active chord
            virtualKeyboard.setActiveTriadChords((prev: Map<number, string[]>) => 
              new Map(prev).set(triadIndex, newChord)
            );
          }
        });
        
        return true;
      }
      return false;
    },
    [keyboardState, scaleState, virtualKeyboard, chordModifierKeys]
  );

  const handleChordModifierRelease = useCallback(
    (key: string): boolean => {
      if (
        keyboardState.mode === "simple-chord" &&
        chordModifierKeys.includes(key)
      ) {
        // Remove the modifier from the chord modifiers set
        virtualKeyboard.setChordModifiers((prev: Set<string>) => {
          if (!prev.has(key)) return prev;
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
        
        // Update all active triad chords with the removed modifier
        virtualKeyboard.activeTriadChords.forEach((chord, triadIndex) => {
          if (virtualKeyboard.pressedTriads.has(triadIndex)) {
            const newChord = virtualKeyboard.getChord(
              scaleState.rootNote,
              scaleState.scale,
              triadIndex,
              virtualKeyboard.chordVoicing,
              virtualKeyboard.chordModifiers
            );
            
            // Release old chord notes
            chord.forEach((note: string) => {
              keyboardState.releaseKeyHeldNote(note);
            });
            
            // Play new chord notes
            newChord.forEach((note: string) => {
              keyboardState.playNote(note, keyboardState.velocity, true);
            });
            
            // Update the active chord
            virtualKeyboard.setActiveTriadChords((prev: Map<number, string[]>) => 
              new Map(prev).set(triadIndex, newChord)
            );
          }
        });
        
        return true;
      }
      return false;
    },
    [keyboardState, scaleState, virtualKeyboard, chordModifierKeys]
  );

  return { handleChordModifierPress, handleChordModifierRelease };
}; 