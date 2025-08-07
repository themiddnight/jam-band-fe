import { DEFAULT_KEYBOARD_SHORTCUTS } from "../../../constants/keyboardShortcuts";
import {
  chordRootKeys,
  chordTriadKeys,
  chromaticBlackKeyMapping,
  chromaticWhiteKeyMapping,
  melodySimpleKeys,
  melodySimpleKeysUpper,
} from "../../../constants/virtualKeyboardKeys";
import type { Scale } from "../../../hooks/useScaleState";
import { useKeyboardStore } from "../../../stores/keyboardStore";
import { getChordFromDegree } from "../../../utils/musicUtils";
import type { KeyboardKey } from "../types/keyboard";
import { useState, useCallback, useMemo } from "react";

export const useVirtualKeyboard = (
  getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[],
  rootNote: string,
  scale: Scale,
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void,
  onReleaseKeyHeldNote: (note: string) => void,
  keyboardState?: any, // Add keyboardState parameter
) => {
  const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;
  const {
    mode,
    currentOctave,
    velocity,
    chordVoicing,
    sustain,
    sustainToggle,
    setMode,
    setCurrentOctave,
    setVelocity,
    setChordVoicing,
    setSustain,
    setSustainToggle,
  } = useKeyboardStore();
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [pressedTriads, setPressedTriads] = useState<Set<number>>(new Set());
  const [activeTriadChords, setActiveTriadChords] = useState<
    Map<number, string[]>
  >(new Map());

  // Memoize white and black note arrays
  const whiteNotes = useMemo(() => ["C", "D", "E", "F", "G", "A", "B"], []);
  const blackNotes = useMemo(() => ["C#", "D#", "", "F#", "G#", "A#", ""], []);

  // Memoize scale notes calculations
  const currentScaleNotes = useMemo(
    () => getScaleNotes(rootNote, scale, currentOctave),
    [getScaleNotes, rootNote, scale, currentOctave],
  );

  const nextOctaveScaleNotes = useMemo(
    () => getScaleNotes(rootNote, scale, currentOctave + 1),
    [getScaleNotes, rootNote, scale, currentOctave],
  );

  const upperOctaveScaleNotes = useMemo(
    () => getScaleNotes(rootNote, scale, currentOctave + 2),
    [getScaleNotes, rootNote, scale, currentOctave],
  );

  // Use centralized chord generation function
  const getChord = useCallback(
    (
      root: string,
      scaleType: Scale,
      degree: number,
      voicing: number = 0,
      modifiers: Set<string> = new Set(),
    ): string[] => {
      // Convert shortcut keys to modifier names for the centralized function
      const convertedModifiers = new Set<string>();

      if (modifiers.has(shortcuts.majMinToggle.key)) {
        convertedModifiers.add("majMinToggle");
      }
      if (modifiers.has(shortcuts.sus2.key)) {
        convertedModifiers.add("sus2");
      }
      if (modifiers.has(shortcuts.sus4.key)) {
        convertedModifiers.add("sus4");
      }
      if (modifiers.has(shortcuts.dominant7.key)) {
        convertedModifiers.add("dominant7");
      }
      if (modifiers.has(shortcuts.major7.key)) {
        convertedModifiers.add("major7");
      }

      return getChordFromDegree(
        root,
        scaleType,
        degree,
        voicing,
        convertedModifiers,
      );
    },
    [shortcuts],
  );

  const generateVirtualKeys = useMemo((): KeyboardKey[] => {
    const keys: KeyboardKey[] = [];

    if (mode === "simple-melody") {
      // Lower row keys (current octave) - use memoized scale notes
      const lowerRowNotes = [...currentScaleNotes, ...nextOctaveScaleNotes];

      melodySimpleKeys.forEach((key, index) => {
        if (index < lowerRowNotes.length) {
          keys.push({
            note: lowerRowNotes[index],
            isBlack: false,
            position: index,
            keyboardKey: key,
          });
        }
      });

      // Upper row keys (one octave higher) - use memoized scale notes
      const upperRowNotes = [...nextOctaveScaleNotes, ...upperOctaveScaleNotes];

      melodySimpleKeysUpper.forEach((key, index) => {
        if (index < upperRowNotes.length) {
          keys.push({
            note: upperRowNotes[index],
            isBlack: false,
            position: index + 100,
            keyboardKey: key,
          });
        }
      });
    } else if (mode === "simple-chord") {
      // Use currentOctave for chord root notes (baseline) - use memoized scale notes
      chordRootKeys.forEach((key, index) => {
        if (index < currentScaleNotes.length) {
          keys.push({
            note: currentScaleNotes[index],
            isBlack: false,
            position: index,
            keyboardKey: key,
          });
        }
      });
    } else {
      // Basic mode - generate chromatic piano keys (full 2 octaves + next C)
      // Generate white keys for 2 full octaves + next C (15 white keys total)
      for (let i = 0; i < 3; i++) { // 3 iterations to cover 2 full octaves + next C
        whiteNotes.forEach((note, index) => {
          const octave = currentOctave + i;
          const keyIndex = i * 7 + index;
          const keyboardKey = chromaticWhiteKeyMapping[keyIndex];

          // Show all white keys for 2 full octaves + next C (15 keys: 0-14)
          if (keyIndex <= 14) { // 0-6 (first octave), 7-13 (second octave), 14 (next C)
            keys.push({
              note: `${note}${octave}`,
              isBlack: false,
              position: keyIndex,
              keyboardKey: keyboardKey || undefined,
            });
          }
        });
      }

      // Generate black keys for 2 full octaves (10 black keys total)
      for (let i = 0; i < 2; i++) { // 2 iterations for 2 octaves
        blackNotes.forEach((note, index) => {
          if (note) {
            const octave = currentOctave + i;
            const position = i * 7 + index + 0.5;
            const keyIndex = i * 7 + index;
            const keyboardKey = chromaticBlackKeyMapping[keyIndex];

            // Show all black keys for 2 full octaves (10 keys: positions 0-13)
            if (keyIndex <= 13) {
              keys.push({
                note: `${note}${octave}`,
                isBlack: true,
                position,
                keyboardKey: keyboardKey || undefined,
              });
            }
          }
        });
      }
    }

    return keys;
  }, [
    mode,
    currentOctave,
    currentScaleNotes,
    nextOctaveScaleNotes,
    upperOctaveScaleNotes,
    whiteNotes,
    blackNotes,
  ]);

  const handleVirtualKeyPress = useCallback(
    async (key: KeyboardKey) => {
      if (
        mode === "simple-chord" &&
        chordTriadKeys.some((k) => k === key.keyboardKey)
      ) {
        const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
        const chord = getChord(
          rootNote,
          scale,
          keyIndex,
          chordVoicing,
          chordModifiers,
        );
        await onPlayNotes(chord, velocity, true); // isKeyHeld = true for chord keys
      } else {
        await onPlayNotes([key.note], velocity, true); // isKeyHeld = true for virtual key presses
      }
    },
    [
      mode,
      rootNote,
      scale,
      getChord,
      chordVoicing,
      velocity,
      onPlayNotes,
      chordModifiers,
    ],
  );

  const handleVirtualKeyRelease = useCallback(
    (key: KeyboardKey) => {
      if (
        mode === "simple-chord" &&
        chordTriadKeys.some((k) => k === key.keyboardKey)
      ) {
        const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
        const chord = activeTriadChords.get(keyIndex);
        if (chord) {
          chord.forEach((note: string) => onReleaseKeyHeldNote(note));

          // Optimized Map update - only create new Map if needed
          setActiveTriadChords((prev) => {
            if (!prev.has(keyIndex)) return prev;
            const newMap = new Map(prev);
            newMap.delete(keyIndex);
            return newMap;
          });
        }

        // Optimized Set update - only create new Set if needed
        setPressedTriads((prev) => {
          if (!prev.has(keyIndex)) return prev;
          const newSet = new Set(prev);
          newSet.delete(keyIndex);
          return newSet;
        });
      } else {
        onReleaseKeyHeldNote(key.note);
      }
    },
    [mode, activeTriadChords, onReleaseKeyHeldNote],
  );

  const handleModifierPress = useCallback((modifier: string) => {
    setChordModifiers((prev: Set<string>) => {
      if (prev.has(modifier)) return prev;
      return new Set(prev).add(modifier);
    });
  }, []);

  const handleModifierRelease = useCallback((modifier: string) => {
    setChordModifiers((prev: Set<string>) => {
      if (!prev.has(modifier)) return prev;
      const newSet = new Set(prev);
      newSet.delete(modifier);
      return newSet;
    });
  }, []);

  const handleTriadPress = useCallback(
    async (index: number) => {
      const chord = getChord(
        rootNote,
        scale,
        index,
        chordVoicing,
        chordModifiers,
      );

      // Optimized Map update - only create new Map if chord is different
      setActiveTriadChords((prev: Map<number, string[]>) => {
        const existingChord = prev.get(index);
        if (
          existingChord &&
          JSON.stringify(existingChord) === JSON.stringify(chord)
        ) {
          return prev;
        }
        return new Map(prev).set(index, chord);
      });

      if (keyboardState) {
        // Use keyboard state system to respect sustain settings
        // Play all notes simultaneously by calling playNote for each note without await
        // This ensures all notes are triggered at the same time without waiting for each one
        chord.forEach((note) => {
          keyboardState.playNote(note, velocity, true);
        });
      } else {
        // Fallback to direct call (for backward compatibility)
        onPlayNotes(chord, velocity, true);
      }

      // Optimized Set update - only create new Set if needed
      setPressedTriads((prev: Set<number>) => {
        if (prev.has(index)) return prev;
        return new Set(prev).add(index);
      });
    },
    [
      rootNote,
      scale,
      getChord,
      chordVoicing,
      velocity,
      chordModifiers,
      keyboardState,
      onPlayNotes,
    ],
  );

  const handleTriadRelease = useCallback(
    (index: number) => {
      const chord = activeTriadChords.get(index);
      if (chord) {
        if (keyboardState) {
          // Use keyboard state system for consistency
          chord.forEach((note: string) =>
            keyboardState.releaseKeyHeldNote(note),
          );
        } else {
          // Fallback to direct call (for backward compatibility)
          chord.forEach((note: string) => onReleaseKeyHeldNote(note));
        }

        // Optimized Map update - only create new Map if needed
        setActiveTriadChords((prev: Map<number, string[]>) => {
          if (!prev.has(index)) return prev;
          const newMap = new Map(prev);
          newMap.delete(index);
          return newMap;
        });
      }

      // Optimized Set update - only create new Set if needed
      setPressedTriads((prev: Set<number>) => {
        if (!prev.has(index)) return prev;
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    },
    [activeTriadChords, keyboardState, onReleaseKeyHeldNote],
  );

  return {
    mode,
    setMode,
    currentOctave,
    setCurrentOctave,
    velocity,
    setVelocity,
    chordVoicing,
    setChordVoicing,
    sustain,
    setSustain,
    sustainToggle,
    setSustainToggle,
    chordModifiers,
    setChordModifiers,
    pressedTriads,
    setPressedTriads,
    activeTriadChords,
    setActiveTriadChords,
    getChord,
    generateVirtualKeys,
    handleVirtualKeyPress,
    handleVirtualKeyRelease,
    handleTriadPress,
    handleTriadRelease,
    handleModifierPress,
    handleModifierRelease,
  } as const;
};
