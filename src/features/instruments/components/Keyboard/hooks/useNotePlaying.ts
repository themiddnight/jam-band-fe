import {
  melodySimpleKeys,
  melodySimpleKeysUpper,
  melodyAdvancedKeys,
  chordRootKeys,
  chordTriadKeys,
  chromaticWhiteKeyMapping,
  chromaticBlackKeyMapping,
} from "../../../../../constants/virtualKeyboardKeys";
import type {
  KeyboardState,
  ScaleState,
  VirtualKeyboardState,
} from "../../../../../types/keyboard";
import { useCallback } from "react";

export const useNotePlaying = (
  keyboardState: KeyboardState,
  scaleState: ScaleState,
  virtualKeyboard: VirtualKeyboardState,
) => {
  const handleNotePlaying = useCallback(
    async (key: string) => {
      // Check if the key is a note key
      const isNoteKey =
        melodySimpleKeys.includes(key) ||
        melodySimpleKeysUpper.includes(key) ||
        melodyAdvancedKeys.includes(key) ||
        chordRootKeys.includes(key) ||
        chordTriadKeys.includes(key);

      if (!isNoteKey) {
        return;
      }

      // Get scale notes for current octave
      const currentScaleNotes = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        keyboardState.currentOctave,
      );

      // Get scale notes for next octave
      const nextOctaveScaleNotes = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        keyboardState.currentOctave + 1,
      );

      // Get scale notes for upper octave
      const upperOctaveScaleNotes = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        keyboardState.currentOctave + 2,
      );

      let note: string | undefined;

      if (keyboardState.mode === "simple-melody") {
        // Handle melody keys
        if (melodySimpleKeys.includes(key)) {
          const keyIndex = melodySimpleKeys.indexOf(key);
          const lowerRowNotes = [...currentScaleNotes, ...nextOctaveScaleNotes];
          note = lowerRowNotes[keyIndex];
        } else if (melodySimpleKeysUpper.includes(key)) {
          const keyIndex = melodySimpleKeysUpper.indexOf(key);
          const upperRowNotes = [
            ...nextOctaveScaleNotes,
            ...upperOctaveScaleNotes,
          ];
          note = upperRowNotes[keyIndex];
        }
      } else if (keyboardState.mode === "simple-chord") {
        // Handle chord keys
        if (chordRootKeys.includes(key)) {
          const keyIndex = chordRootKeys.indexOf(key);
          note = currentScaleNotes[keyIndex];
        } else if (chordTriadKeys.includes(key)) {
          const keyIndex = chordTriadKeys.indexOf(key);
          // Use unified triad handler to benefit from arpeggio logic
          await virtualKeyboard.handleTriadPress(keyIndex);
          return; // Triad handled
        }
      } else if (keyboardState.mode === "basic") {
        // Handle basic mode keys - chromatic mapping
        const chromaticKeys = [
          ...chromaticWhiteKeyMapping,
          ...chromaticBlackKeyMapping,
        ].filter((k) => k !== "");
        if (chromaticKeys.includes(key)) {
          // Find the virtual key that matches this keyboard key
          const virtualKeys = virtualKeyboard.generateVirtualKeys;
          const matchingKey = virtualKeys.find((vk) => vk.keyboardKey === key);
          if (matchingKey) {
            note = matchingKey.note;
          }
        }
      }

      if (note) {
        await keyboardState.playNote(note, keyboardState.velocity, true);
      }
    },
    [keyboardState, scaleState, virtualKeyboard],
  );

  return { handleNotePlaying };
};
