import { useCallback, useMemo, useRef } from "react";
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

  // Memoize note keys array to avoid recreation on every render
  const noteKeys = useMemo(() => [
    ...melodySimpleKeys,
    ...melodySimpleKeysUpper,
    ...melodyAdvancedKeys,
    ...chordRootKeys,
    ...chordTriadKeys,
  ], []);

  // Use ref to track processing state and avoid duplicate key handling
  const processingKeys = useRef<Set<string>>(new Set());

  // Memoize control keys for faster lookup
  const controlKeys = useMemo(() => {
    const shortcuts = useKeyboardShortcutsStore.getState().shortcuts;
    return new Set([
      shortcuts.octaveDown.key,
      shortcuts.octaveUp.key,
      shortcuts.voicingDown.key,
      shortcuts.voicingUp.key,
      shortcuts.toggleMelodyChord.key,
      shortcuts.sustain.key,
      shortcuts.sustainToggle.key,
      ...Array.from({length: 9}, (_, i) => (i + 1).toString()),
    ]);
  }, []);

  // Optimized set operations using a more efficient approach
  const updateHeldKeys = useCallback((key: string, action: 'add' | 'delete') => {
    keyboardState.setHeldKeys((prev: Set<string>) => {
      if (action === 'add' && prev.has(key)) return prev;
      if (action === 'delete' && !prev.has(key)) return prev;
      
      const newSet = new Set(prev);
      if (action === 'add') {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return newSet;
    });
  }, [keyboardState]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Early exit if key is being processed
      if (processingKeys.current.has(key)) {
        return;
      }

      // Handle control keys (sustain, velocity, octave, etc.)
      if (handleAllControlKeys(key)) {
        return;
      }

      // Don't process if key is already held
      if (keyboardState.heldKeys.has(key)) {
        return;
      }

      // Mark key as being processed
      processingKeys.current.add(key);

      // Optimized held keys update
      updateHeldKeys(key, 'add');

      // Handle chord modifier keys
      if (handleChordModifierPress(key)) {
        processingKeys.current.delete(key);
        return;
      }

      // Prevent default for note keys (using memoized array)
      if (noteKeys.includes(key)) {
        event.preventDefault();
      }

      // Handle note playing
      handleNotePlaying(key).catch(console.error).finally(() => {
        processingKeys.current.delete(key);
      });
    },
    [
      keyboardState.heldKeys,
      handleAllControlKeys,
      handleChordModifierPress,
      handleNotePlaying,
      updateHeldKeys,
      noteKeys,
    ]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Optimized held keys update
      updateHeldKeys(key, 'delete');

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

      // Don't handle key up for control keys (using memoized set)
      if (controlKeys.has(key)) {
        return;
      }

      // Handle note stopping
      handleNoteStopping(key);
    },
    [
      keyboardState.sustainToggle,
      keyboardState.setSustain,
      keyboardState.stopSustainedNotes,
      handleChordModifierRelease,
      handleNoteStopping,
      updateHeldKeys,
      controlKeys,
    ]
  );

  return { handleKeyDown, handleKeyUp };
};
