import { useCallback } from "react";
import { 
  melodySimpleKeys, 
  melodySimpleKeysUpper, 
  melodyAdvancedKeys, 
  chordRootKeys, 
  chordTriadKeys 
} from "../../../constants/virtualKeyboardKeys";
import type {
  KeyboardState,
  ScaleState,
  VirtualKeyboardState,
} from "../../../types/keyboard";

export const useKeyboardKeysController = (keyboardState: KeyboardState, scaleState: ScaleState, virtualKeyboard: VirtualKeyboardState) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === " ") {
        event.preventDefault();
        if (!keyboardState.heldKeys.has(key)) {
          keyboardState.setSustain(true);
          keyboardState.setHeldKeys((prev: Set<string>) => new Set(prev).add(key));
        }
        return;
      }

      if (keyboardState.heldKeys.has(key)) {
        return;
      }

      keyboardState.setHeldKeys((prev: Set<string>) => new Set(prev).add(key));

      // Handle chord modifier keys ONLY in simple chord mode
      if (
        ["i", "o", "n", "m", "."].includes(key) &&
        keyboardState.mainMode === "simple" &&
        keyboardState.simpleMode === "chord"
      ) {
        virtualKeyboard.setChordModifiers((prev: Set<string>) => new Set(prev).add(key));
        return;
      }

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

      if (key >= "1" && key <= "9") {
        keyboardState.setVelocity(parseInt(key) / 9);
        return;
      }

      if (key === "/") {
        if (keyboardState.mainMode === "simple") {
          keyboardState.setSimpleMode((prev: string) => (prev === "melody" ? "chord" : "melody"));
        }
        return;
      }

      // Octave controls (z, x)
      if (key === "z") {
        keyboardState.setCurrentOctave((prev: number) => Math.max(0, prev - 1));
        return;
      }

      if (key === "x") {
        keyboardState.setCurrentOctave((prev: number) => Math.min(8, prev + 1));
        return;
      }

      // Voicing controls (c, v)
      if (key === "c") {
        if (keyboardState.mainMode === "simple" && keyboardState.simpleMode === "chord") {
          virtualKeyboard.setChordVoicing((prev: number) => Math.max(0, prev - 1));
        }
        return;
      }

      if (key === "v") {
        if (keyboardState.mainMode === "simple" && keyboardState.simpleMode === "chord") {
          virtualKeyboard.setChordVoicing((prev: number) => Math.min(5, prev + 1));
        }
        return;
      }

      // Handle note playing logic
      if (keyboardState.mainMode === "simple") {
        if (keyboardState.simpleMode === "melody") {
          // Lower row keys
          if (melodySimpleKeys.includes(key)) {
            const keyIndex = melodySimpleKeys.indexOf(key);
            const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave);
            if (keyIndex < scaleNotes.length) {
              keyboardState.playNote(scaleNotes[keyIndex], keyboardState.velocity, true);
            } else {
              const nextOctaveNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave + 1);
              if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
                keyboardState.playNote(nextOctaveNotes[keyIndex - scaleNotes.length], keyboardState.velocity, true);
              }
            }
          }
          // Upper row keys
          else if (melodySimpleKeysUpper.includes(key)) {
            const keyIndex = melodySimpleKeysUpper.indexOf(key);
            const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave + 1);
            if (keyIndex < scaleNotes.length) {
              keyboardState.playNote(scaleNotes[keyIndex], keyboardState.velocity, true);
            } else {
              const nextOctaveNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave + 2);
              if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
                keyboardState.playNote(nextOctaveNotes[keyIndex - scaleNotes.length], keyboardState.velocity, true);
              }
            }
          }
        } else if (keyboardState.simpleMode === "chord") {
          if (chordRootKeys.includes(key)) {
            const keyIndex = chordRootKeys.indexOf(key);
            const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave);
            if (keyIndex < scaleNotes.length) {
              keyboardState.playNote(scaleNotes[keyIndex], keyboardState.velocity, true);
            }
          } else if (chordTriadKeys.includes(key)) {
            const keyIndex = chordTriadKeys.indexOf(key);
            const chord = virtualKeyboard.getChord(
              scaleState.rootNote,
              scaleState.scale,
              keyIndex,
              3,
              virtualKeyboard.chordVoicing,
              virtualKeyboard.chordModifiers
            );

            virtualKeyboard.setActiveTriadChords((prev: Map<number, string[]>) => new Map(prev).set(keyIndex, chord));
            chord.forEach((note: string) => keyboardState.playNote(note, keyboardState.velocity, true));
            virtualKeyboard.setPressedTriads((prev: Set<number>) => new Set(prev).add(keyIndex));
          }
        }
      } else if (keyboardState.mainMode === "advanced") {
        if (melodyAdvancedKeys.includes(key)) {
          const keyIndex = melodyAdvancedKeys.indexOf(key);
          const noteMapping = [
            "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
            "C", "C#", "D", "D#", "E", "F", "F#",
          ];
          const octaveOffset = keyIndex >= 12 ? 1 : 0;
          const note = `${noteMapping[keyIndex]}${keyboardState.currentOctave + octaveOffset}`;
          keyboardState.playNote(note, keyboardState.velocity, true);
        }
      }
    },
    [keyboardState, scaleState, virtualKeyboard]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      keyboardState.setHeldKeys((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });

      // Remove chord modifiers when keys are released
      if (
        ["i", "o", "n", "m", "."].includes(key) &&
        keyboardState.mainMode === "simple" &&
        keyboardState.simpleMode === "chord"
      ) {
        virtualKeyboard.setChordModifiers((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });

        // Handle modifier release logic
        virtualKeyboard.activeTriadChords.forEach((chord: string[], triadIndex: number) => {
          if (virtualKeyboard.pressedTriads.has(triadIndex)) {
            const newChord = virtualKeyboard.getChord(
              scaleState.rootNote,
              scaleState.scale,
              triadIndex,
              3,
              virtualKeyboard.chordVoicing,
              virtualKeyboard.chordModifiers
            );

            chord.forEach((note: string) => {
              if (!newChord.includes(note)) {
                keyboardState.releaseKeyHeldNote(note);
              }
            });

            newChord.forEach((note: string) => {
              if (!chord.includes(note)) {
                keyboardState.playNote(note, keyboardState.velocity, true);
              }
            });

            virtualKeyboard.setActiveTriadChords((prev: Map<number, string[]>) =>
              new Map(prev).set(triadIndex, newChord)
            );
          }
        });

        return;
      }

      if (key === " ") {
        keyboardState.setSustain(false);
        keyboardState.stopSustainedNotes();
        return;
      }

      // Don't handle key up for control keys
      if (["z", "x", "c", "v", "/"].includes(key) || (key >= "1" && key <= "9")) {
        return;
      }

      // Handle note stopping logic (similar structure to key down)
      if (keyboardState.mainMode === "simple") {
        if (keyboardState.simpleMode === "melody") {
          // Lower row keys
          if (melodySimpleKeys.includes(key)) {
            const keyIndex = melodySimpleKeys.indexOf(key);
            const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave);
            if (keyIndex < scaleNotes.length) {
              keyboardState.releaseKeyHeldNote(scaleNotes[keyIndex]);
            } else {
              const nextOctaveNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave + 1);
              if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
                keyboardState.releaseKeyHeldNote(nextOctaveNotes[keyIndex - scaleNotes.length]);
              }
            }
          }
          // Upper row keys
          else if (melodySimpleKeysUpper.includes(key)) {
            const keyIndex = melodySimpleKeysUpper.indexOf(key);
            const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave + 1);
            if (keyIndex < scaleNotes.length) {
              keyboardState.releaseKeyHeldNote(scaleNotes[keyIndex]);
            } else {
              const nextOctaveNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave + 2);
              if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
                keyboardState.releaseKeyHeldNote(nextOctaveNotes[keyIndex - scaleNotes.length]);
              }
            }
          }
        } else if (keyboardState.simpleMode === "chord") {
          if (chordRootKeys.includes(key)) {
            const keyIndex = chordRootKeys.indexOf(key);
            const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, keyboardState.currentOctave);
            if (keyIndex < scaleNotes.length) {
              keyboardState.releaseKeyHeldNote(scaleNotes[keyIndex]);
            }
          } else if (chordTriadKeys.includes(key)) {
            const keyIndex = chordTriadKeys.indexOf(key);
            const chord = virtualKeyboard.activeTriadChords.get(keyIndex);
            if (chord) {
              chord.forEach((note: string) => keyboardState.releaseKeyHeldNote(note));
              virtualKeyboard.setActiveTriadChords((prev: Map<number, string[]>) => {
                const newMap = new Map(prev);
                newMap.delete(keyIndex);
                return newMap;
              });
            }
            virtualKeyboard.setPressedTriads((prev: Set<number>) => {
              const newSet = new Set(prev);
              newSet.delete(keyIndex);
              return newSet;
            });
          }
        }
      } else if (keyboardState.mainMode === "advanced") {
        if (melodyAdvancedKeys.includes(key)) {
          const keyIndex = melodyAdvancedKeys.indexOf(key);
          const noteMapping = [
            "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
            "C", "C#", "D", "D#", "E", "F", "F#",
          ];
          const octaveOffset = keyIndex >= 12 ? 1 : 0;
          const note = `${noteMapping[keyIndex]}${keyboardState.currentOctave + octaveOffset}`;
          keyboardState.releaseKeyHeldNote(note);
        }
      }
    },
    [keyboardState, scaleState, virtualKeyboard]
  );

  return { handleKeyDown, handleKeyUp };
};
