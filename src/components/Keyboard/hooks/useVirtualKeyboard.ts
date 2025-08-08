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
    arpeggioSpeed,
  } = useKeyboardStore();
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [pressedTriads, setPressedTriads] = useState<Set<number>>(new Set());
  const [activeTriadChords, setActiveTriadChords] = useState<
    Map<number, string[]>
  >(new Map());
  // Track scheduled timeouts for arpeggio so they can be cancelled on release
  const [scheduledArpTimeouts, setScheduledArpTimeouts] = useState<
    Map<number, NodeJS.Timeout[]>
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
      for (let i = 0; i < 3; i++) {
        // 3 iterations to cover 2 full octaves + next C
        whiteNotes.forEach((note, index) => {
          const octave = currentOctave + i;
          const keyIndex = i * 7 + index;
          const keyboardKey = chromaticWhiteKeyMapping[keyIndex];

          // Show all white keys for 2 full octaves + next C (15 keys: 0-14)
          if (keyIndex <= 14) {
            // 0-6 (first octave), 7-13 (second octave), 14 (next C)
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
      for (let i = 0; i < 2; i++) {
        // 2 iterations for 2 octaves
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

  // Sort notes by pitch (low to high) helper
  const sortNotesLowToHigh = useCallback((notes: string[]): string[] => {
    return [...notes].sort((a, b) => {
      const noteA = a.slice(0, -1);
      const octaveA = parseInt(a.slice(-1));
      const noteB = b.slice(0, -1);
      const octaveB = parseInt(b.slice(-1));

      if (octaveA !== octaveB) {
        return octaveA - octaveB;
      }

      const order = ["C", "D", "E", "F", "G", "A", "B"];
      return order.indexOf(noteA) - order.indexOf(noteB);
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

      const ordered = sortNotesLowToHigh(chord);

      // Store active chord (for reference)
      setActiveTriadChords((prev: Map<number, string[]>) => {
        const existingChord = prev.get(index);
        if (
          existingChord &&
          JSON.stringify(existingChord) === JSON.stringify(ordered)
        ) {
          return prev;
        }
        return new Map(prev).set(index, ordered);
      });

      // If speed is 0ms, trigger all notes effectively simultaneously
      if (arpeggioSpeed === 0) {
        if (keyboardState) {
          ordered.forEach((note) => {
            keyboardState.playNote(note, velocity, true);
          });
        } else {
          ordered.forEach((note) => onPlayNotes([note], velocity, true));
        }
      } else {
        // Schedule arpeggio low -> high
        const timeouts: NodeJS.Timeout[] = [];
        ordered.forEach((note, i) => {
          const timeout = setTimeout(() => {
            if (keyboardState) {
              keyboardState.playNote(note, velocity, true);
            } else {
              onPlayNotes([note], velocity, true);
            }
          }, i * arpeggioSpeed);
          timeouts.push(timeout);
        });
        setScheduledArpTimeouts((prev) => {
          const next = new Map(prev);
          next.set(index, timeouts);
          return next;
        });
      }

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
      arpeggioSpeed,
      sortNotesLowToHigh,
    ],
  );

  const handleTriadRelease = useCallback(
    (index: number) => {
      // Cancel any scheduled arpeggio timeouts
      const timeouts = scheduledArpTimeouts.get(index);
      if (timeouts) {
        timeouts.forEach((t) => clearTimeout(t));
        setScheduledArpTimeouts((prev) => {
          const next = new Map(prev);
          next.delete(index);
          return next;
        });
      }

      // Always release the planned chord notes to ensure all notes are properly released
      // This is more reliable than depending on playedTriadNotes which might be incomplete
      const chord = activeTriadChords.get(index);
      if (chord) {
        if (keyboardState) {
          chord.forEach((note) => keyboardState.releaseKeyHeldNote(note));
        } else {
          chord.forEach((note) => onReleaseKeyHeldNote(note));
        }
      }

      // Clean active chord map
      setActiveTriadChords((prev: Map<number, string[]>) => {
        if (!prev.has(index)) return prev;
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });

      setPressedTriads((prev: Set<number>) => {
        if (!prev.has(index)) return prev;
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    },
    [
      scheduledArpTimeouts,
      activeTriadChords,
      keyboardState,
      onReleaseKeyHeldNote,
    ],
  );

  // Virtual key handlers (placed after triad handlers to satisfy dependencies)
  const handleVirtualKeyPress = useCallback(
    async (key: KeyboardKey) => {
      if (
        mode === "simple-chord" &&
        chordTriadKeys.some((k) => k === key.keyboardKey)
      ) {
        const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
        await handleTriadPress(keyIndex);
      } else {
        await onPlayNotes([key.note], velocity, true);
      }
    },
    [mode, velocity, onPlayNotes, handleTriadPress],
  );

  const handleVirtualKeyRelease = useCallback(
    (key: KeyboardKey) => {
      if (
        mode === "simple-chord" &&
        chordTriadKeys.some((k) => k === key.keyboardKey)
      ) {
        const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
        handleTriadRelease(keyIndex);
      } else {
        onReleaseKeyHeldNote(key.note);
      }
    },
    [mode, onReleaseKeyHeldNote, handleTriadRelease],
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
