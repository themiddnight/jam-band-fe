import {
  getChordModifierKeys,
  DEFAULT_KEYBOARD_SHORTCUTS,
} from "../../../../../constants/keyboardShortcuts";
import type {
  KeyboardState,
  VirtualKeyboardState,
} from "../../../../../types/keyboard";
import { useCallback } from "react";

export const useChordModifiers = (
  keyboardState: KeyboardState,
  virtualKeyboard: VirtualKeyboardState,
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

        // Don't immediately update active chords - let the next triad press use the new modifiers
        // This prevents unwanted sounds when pressing modifiers while holding a triad

        return true;
      }
      return false;
    },
    [keyboardState, virtualKeyboard, chordModifierKeys],
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

        // Don't immediately update active chords - let the next triad press use the new modifiers
        // This prevents unwanted sounds when releasing modifiers while holding a triad

        return true;
      }
      return false;
    },
    [keyboardState, virtualKeyboard, chordModifierKeys],
  );

  return { handleChordModifierPress, handleChordModifierRelease };
};
