import { useCallback } from "react";
import {
  melodySimpleKeys,
  melodySimpleKeysUpper,
  melodyAdvancedKeys,
  chordRootKeys,
  chordTriadKeys,
} from "../../../constants/virtualKeyboardKeys";
import { useControlKeys } from "./useControlKeys";
import { useChordModifiers } from "./useChordModifiers";
import { useNotePlaying } from "./useNotePlaying";
import { useNoteStopping } from "./useNoteStopping";
import { useKeyboardShortcutsStore } from "../../../stores/keyboardShortcutsStore";
import type {
  KeyboardState,
  ScaleState,
  VirtualKeyboardState,
} from "../../../types/keyboard";

export const useKeyboardKeysController = (
  keyboardState: KeyboardState,
  scaleState: ScaleState,
  virtualKeyboard: VirtualKeyboardState
) => {
  const { handleAllControlKeys } = useControlKeys(keyboardState, virtualKeyboard);
  const { handleChordModifierPress, handleChordModifierRelease } = useChordModifiers(keyboardState, scaleState, virtualKeyboard);
  const { handleNotePlaying } = useNotePlaying(keyboardState, scaleState, virtualKeyboard);
  const { handleNoteStopping } = useNoteStopping(keyboardState, scaleState, virtualKeyboard);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Handle control keys (sustain, velocity, octave, etc.)
      if (handleAllControlKeys(key)) {
        return;
      }

      // Don't process if key is already held
      if (keyboardState.heldKeys.has(key)) {
        return;
      }

      keyboardState.setHeldKeys((prev: Set<string>) => new Set(prev).add(key));

      // Handle chord modifier keys
      if (handleChordModifierPress(key)) {
        return;
      }

      // Prevent default for note keys
      if (
        [
          ...melodySimpleKeys,
          ...melodySimpleKeysUpper,
          ...melodyAdvancedKeys,
          ...chordRootKeys,
          ...chordTriadKeys,
        ].includes(key)
      ) {
        event.preventDefault();
      }

      // Handle note playing
      handleNotePlaying(key).catch(console.error);
    },
    [keyboardState, handleAllControlKeys, handleChordModifierPress, handleNotePlaying]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      keyboardState.setHeldKeys((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });

      // Handle chord modifier release
      if (handleChordModifierRelease(key)) {
        return;
      }

      // Handle sustain release
      const shortcuts = useKeyboardShortcutsStore.getState().shortcuts;
      if (key === shortcuts.sustain.key) {
        if (!keyboardState.sustainToggle) {
          // Only stop sustain on spacebar release if not in toggle mode
          keyboardState.setSustain(false);
          keyboardState.stopSustainedNotes();
        }
        // If in toggle mode, do nothing on spacebar release - keep toggle active
        return;
      }

      // Don't handle key up for control keys
      const controlKeys = [
        shortcuts.octaveDown.key,
        shortcuts.octaveUp.key,
        shortcuts.voicingDown.key,
        shortcuts.voicingUp.key,
        shortcuts.toggleMelodyChord.key
      ];
      
      if (
        controlKeys.includes(key) ||
        (key >= "1" && key <= "9")
      ) {
        return;
      }

      // Handle note stopping
      handleNoteStopping(key);
    },
    [keyboardState, handleChordModifierRelease, handleNoteStopping]
  );

  return { handleKeyDown, handleKeyUp };
};
