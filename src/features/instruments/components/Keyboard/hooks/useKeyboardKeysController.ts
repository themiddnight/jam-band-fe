import { DEFAULT_KEYBOARD_SHORTCUTS } from "../../../index";
import {
  melodySimpleKeys,
  melodySimpleKeysUpper,
  melodyAdvancedKeys,
  chordRootKeys,
  chordTriadKeys,
  chromaticWhiteKeyMapping,
  chromaticBlackKeyMapping,
} from "../../../index";
import type {
  KeyboardState,
  ScaleState,
  VirtualKeyboardState,
} from "../../../index";
import { useChordModifiers } from "./useChordModifiers";
import { useControlKeys } from "./useControlKeys";
import { useNotePlaying } from "./useNotePlaying";
import { useNoteStopping } from "./useNoteStopping";
import { useCallback, useMemo, useRef } from "react";

export const useKeyboardKeysController = (
  keyboardState: KeyboardState,
  scaleState: ScaleState,
  virtualKeyboard: VirtualKeyboardState,
  sharpModifierRef?: React.MutableRefObject<boolean>,
  setSharpModifierActive?: (active: boolean) => void,
) => {
  const { handleAllControlKeys, handleSustainRelease } = useControlKeys(
    keyboardState,
    virtualKeyboard,
  );
  const { handleChordModifierPress, handleChordModifierRelease } =
    useChordModifiers(keyboardState, virtualKeyboard);
  const { handleNotePlaying } = useNotePlaying(
    keyboardState,
    scaleState,
    virtualKeyboard,
    sharpModifierRef,
  );
  const { handleNoteStopping } = useNoteStopping(
    keyboardState,
    scaleState,
    virtualKeyboard,
  );

  // Memoize note keys array to avoid recreation on every render
  const noteKeys = useMemo(
    () => [
      ...melodySimpleKeys,
      ...melodySimpleKeysUpper,
      ...melodyAdvancedKeys,
      ...chordRootKeys,
      ...chordTriadKeys,
      ...chromaticWhiteKeyMapping.filter((k) => k !== ""),
      ...chromaticBlackKeyMapping.filter((k) => k !== ""),
    ],
    [],
  );

  // Use ref to track processing state and avoid duplicate key handling
  const processingKeys = useRef<Set<string>>(new Set());

  // Memoize control keys for faster lookup
  const controlKeys = useMemo(() => {
    return new Set([
      DEFAULT_KEYBOARD_SHORTCUTS.octaveDown.key,
      DEFAULT_KEYBOARD_SHORTCUTS.octaveUp.key,
      DEFAULT_KEYBOARD_SHORTCUTS.voicingDown.key,
      DEFAULT_KEYBOARD_SHORTCUTS.voicingUp.key,
      DEFAULT_KEYBOARD_SHORTCUTS.toggleMode.key,
      DEFAULT_KEYBOARD_SHORTCUTS.sustain.key,
      DEFAULT_KEYBOARD_SHORTCUTS.sustainToggle.key,
      DEFAULT_KEYBOARD_SHORTCUTS.velocityDown.key,
      DEFAULT_KEYBOARD_SHORTCUTS.velocityUp.key,
      DEFAULT_KEYBOARD_SHORTCUTS.arpeggioSpeedDown.key,
      DEFAULT_KEYBOARD_SHORTCUTS.arpeggioSpeedUp.key,
    ]);
  }, []);

  // Optimized set operations using a more efficient approach
  const updateHeldKeys = useCallback(
    (key: string, action: "add" | "delete") => {
      keyboardState.setHeldKeys((prev: Set<string>) => {
        if (action === "add" && prev.has(key)) return prev;
        if (action === "delete" && !prev.has(key)) return prev;

        const newSet = new Set(prev);
        if (action === "add") {
          newSet.add(key);
        } else {
          newSet.delete(key);
        }
        return newSet;
      });
    },
    [keyboardState],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Normalize key: when shift is pressed, event.key might be uppercase
      // We need to use the lowercase version for matching shortcuts
      const key = event.key.toLowerCase();
      const isShiftPressed = event.shiftKey;

      // Update sharp modifier state when shift is pressed
      if (isShiftPressed && sharpModifierRef) {
        sharpModifierRef.current = true;
        setSharpModifierActive?.(true);
      }

      // Check if the target is an input element (input, textarea, contenteditable)
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest('input, textarea, [contenteditable="true"]');

      // Skip ALL keyboard shortcuts when user is typing in input fields
      if (isInputElement) {
        return;
      }

      // Early exit if key is being processed
      if (processingKeys.current.has(key)) {
        return;
      }

      // Handle control keys (sustain, velocity, octave, etc.)
      if (handleAllControlKeys(key)) {
        // Prevent default for control keys to avoid browser behavior (e.g., spacebar scrolling)
        if (controlKeys.has(key)) {
          event.preventDefault();
        }
        return;
      }

      // Don't process if key is already held
      if (keyboardState.heldKeys.has(key)) {
        return;
      }

      // Mark key as being processed
      processingKeys.current.add(key);

      // Optimized held keys update
      updateHeldKeys(key, "add");

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
      handleNotePlaying(key)
        .catch(console.error)
        .finally(() => {
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
      controlKeys,
      sharpModifierRef,
      setSharpModifierActive,
    ],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Update sharp modifier state when shift is released
      if (key === "shift" && sharpModifierRef) {
        sharpModifierRef.current = false;
        setSharpModifierActive?.(false);
      }

      // Check if the target is an input element (input, textarea, contenteditable)
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest('input, textarea, [contenteditable="true"]');

      // Skip ALL keyboard shortcuts when user is typing in input fields
      if (isInputElement) {
        return;
      }

      // Optimized held keys update
      updateHeldKeys(key, "delete");

      // Handle chord modifier release
      if (handleChordModifierRelease(key)) {
        return;
      }

      // Handle sustain release
      if (handleSustainRelease(key)) {
        return;
      }

      // Don't handle key up for control keys (using memoized set)
      if (controlKeys.has(key)) {
        return;
      }

      // Handle note stopping for regular note keys
      if (noteKeys.includes(key)) {
        handleNoteStopping(key);
      }
    },
    [
      updateHeldKeys,
      handleChordModifierRelease,
      handleSustainRelease,
      controlKeys,
      noteKeys,
      handleNoteStopping,
      sharpModifierRef,
      setSharpModifierActive,
    ],
  );

  return { handleKeyDown, handleKeyUp };
};
