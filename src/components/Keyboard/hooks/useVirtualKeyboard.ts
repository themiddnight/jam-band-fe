import { useState, useCallback, useMemo } from "react";
import { useKeyboardShortcutsStore } from "../../../stores/keyboardShortcutsStore";
import type { Scale } from "../../../hooks/useScaleState";
import type { MainMode, KeyboardKey, SimpleMode } from "../types/keyboard";
import {
  blackKeyMapping,
  chordRootKeys,
  chordTriadKeys,
  melodySimpleKeys,
  melodySimpleKeysUpper,
  whiteKeyMapping,
} from "../../../constants/virtualKeyboardKeys";

export const useVirtualKeyboard = (
  getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[],
  rootNote: string,
  scale: Scale,
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void,
  onReleaseKeyHeldNote: (note: string) => void,
  keyboardState?: any // Add keyboardState parameter
) => {
  const shortcuts = useKeyboardShortcutsStore((state) => state.shortcuts);
  const [mainMode, setMainMode] = useState<MainMode>("simple");
  const [simpleMode, setSimpleMode] = useState<SimpleMode>("melody");
  const [currentOctave, setCurrentOctave] = useState<number>(2);
  const [velocity, setVelocity] = useState<number>(0.7);
  const [chordVoicing, setChordVoicing] = useState<number>(0);
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [pressedTriads, setPressedTriads] = useState<Set<number>>(new Set());
  const [activeTriadChords, setActiveTriadChords] = useState<
    Map<number, string[]>
  >(new Map());

  // Memoize white and black note arrays
  const whiteNotes = useMemo(() => ["C", "D", "E", "F", "G", "A", "B"], []);
  const blackNotes = useMemo(() => ["C#", "D#", "", "F#", "G#", "A#", ""], []);

  // Memoize scale notes calculations
  const currentScaleNotes = useMemo(() => 
    getScaleNotes(rootNote, scale, currentOctave),
    [getScaleNotes, rootNote, scale, currentOctave]
  );

  const nextOctaveScaleNotes = useMemo(() => 
    getScaleNotes(rootNote, scale, currentOctave + 1),
    [getScaleNotes, rootNote, scale, currentOctave]
  );

  const upperOctaveScaleNotes = useMemo(() => 
    getScaleNotes(rootNote, scale, currentOctave + 2),
    [getScaleNotes, rootNote, scale, currentOctave]
  );

  const getChord = useCallback(
    (
      root: string,
      scaleType: Scale,
      degree: number,
      voicing: number = 0,
      modifiers: Set<string> = new Set()
    ): string[] => {
      const allNotes = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
      ];
      const getNoteIndex = (note: string) => {
        if (!note) return 0;
        const noteName = note.slice(0, -1);
        const octave = parseInt(note.slice(-1));
        return allNotes.indexOf(noteName) + octave * 12;
      };
      const getNoteFromIndex = (index: number) => {
        const noteName = allNotes[index % 12];
        const octave = Math.floor(index / 12);
        return `${noteName}${octave}`;
      };

      const baseOctave = 3 + voicing;
      const scaleNotes = getScaleNotes(root, scaleType, baseOctave);

      const rootNoteOfChord = scaleNotes[degree % 7];
      const rootNoteIndex = getNoteIndex(rootNoteOfChord);

      const scaleNoteNames = getScaleNotes(root, scaleType, 0).map((n) =>
        n.slice(0, -1)
      );

      // Determine original diatonic quality
      const rootNoteName = scaleNoteNames[degree % 7];
      const thirdNoteNameFromScale = scaleNoteNames[(degree + 2) % 7];
      const fifthNoteNameFromScale = scaleNoteNames[(degree + 4) % 7];

      const rootPitch = allNotes.indexOf(rootNoteName);
      let thirdPitch = allNotes.indexOf(thirdNoteNameFromScale);
      if (thirdPitch < rootPitch) thirdPitch += 12;
      let fifthPitch = allNotes.indexOf(fifthNoteNameFromScale);
      if (fifthPitch < rootPitch) fifthPitch += 12;

      const thirdInterval = thirdPitch - rootPitch;
      const fifthInterval = fifthPitch - rootPitch;

      let quality: "major" | "minor" | "diminished" | "augmented" = "major";
      if (thirdInterval === 3 && fifthInterval === 7) {
        quality = "minor";
      } else if (thirdInterval === 3 && fifthInterval === 6) {
        quality = "diminished";
      } else if (thirdInterval === 4 && fifthInterval === 8) {
        quality = "augmented";
      }

      // Handle quality modifier
      if (modifiers.has(shortcuts.majMinToggle.key)) {
        if (quality === "major") quality = "minor";
        else quality = "major"; // a simple toggle for now
      }

      let chordIntervals: number[] = [];

      // Handle sus modifiers
      if (modifiers.has(shortcuts.sus2.key)) {
        // sus2
        chordIntervals = [0, 2, 7];
      } else if (modifiers.has(shortcuts.sus4.key)) {
        // sus4
        chordIntervals = [0, 5, 7];
      } else {
        switch (quality) {
          case "major":
            chordIntervals = [0, 4, 7];
            break;
          case "minor":
            chordIntervals = [0, 3, 7];
            break;
          case "diminished":
            chordIntervals = [0, 3, 6];
            break;
          case "augmented":
            chordIntervals = [0, 4, 8];
            break;
        }
      }

      const chordNotes = chordIntervals.map((interval) =>
        getNoteFromIndex(rootNoteIndex + interval)
      );

      const finalChordNotes = chordNotes.map((note) => {
        const noteIndex = getNoteIndex(note);
        const noteOctave = Math.floor(noteIndex / 12);
        if (noteOctave < baseOctave) {
          return getNoteFromIndex(noteIndex + 12);
        }
        if (noteOctave > baseOctave) {
          return getNoteFromIndex(noteIndex - 12);
        }
        return note;
      });

      if (modifiers.has(shortcuts.dominant7.key)) {
        const rootNoteIndex = getNoteIndex(rootNoteOfChord);
        let seventhNoteIndex = rootNoteIndex + 10;
        const highestNoteIndex =
          getNoteIndex(finalChordNotes[finalChordNotes.length - 1]);
        if (seventhNoteIndex <= highestNoteIndex) seventhNoteIndex += 12;
        finalChordNotes.push(getNoteFromIndex(seventhNoteIndex));
      }
      if (modifiers.has(shortcuts.major7.key)) {
        const rootNoteIndex = getNoteIndex(rootNoteOfChord);
        let seventhNoteIndex = rootNoteIndex + 11;
        const highestNoteIndex =
          getNoteIndex(finalChordNotes[finalChordNotes.length - 1]);
        if (seventhNoteIndex <= highestNoteIndex) seventhNoteIndex += 12;
        finalChordNotes.push(getNoteFromIndex(seventhNoteIndex));
      }

      return finalChordNotes.sort((a, b) => getNoteIndex(a) - getNoteIndex(b));
    },
    [getScaleNotes, shortcuts]
  );

  const generateVirtualKeys = useMemo((): KeyboardKey[] => {
    const keys: KeyboardKey[] = [];

    if (mainMode === "simple") {
      if (simpleMode === "melody") {
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
      } else {
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
      }
    } else {
      // Advanced mode - generate piano keys
      for (let i = 0; i < 2; i++) {
        whiteNotes.forEach((note, index) => {
          const octave = currentOctave + i;
          const keyIndex = i * 7 + index;
          const keyboardKey = whiteKeyMapping[keyIndex];

          keys.push({
            note: `${note}${octave}`,
            isBlack: false,
            position: keyIndex,
            keyboardKey,
          });
        });
      }

      for (let i = 0; i < 2; i++) {
        blackNotes.forEach((note, index) => {
          if (note) {
            const octave = currentOctave + i;
            const position = i * 7 + index + 0.5;
            const keyboardKey = blackKeyMapping[index];

            if (keyboardKey) {
              keys.push({
                note: `${note}${octave}`,
                isBlack: true,
                position,
                keyboardKey,
              });
            }
          }
        });
      }
    }

    return keys;
  }, [
    mainMode,
    simpleMode,
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
        mainMode === "simple" &&
        simpleMode === "chord" &&
        chordTriadKeys.some((k) => k === key.keyboardKey)
      ) {
        const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
        const chord = getChord(rootNote, scale, keyIndex, chordVoicing, chordModifiers);
        await onPlayNotes(chord, velocity, true); // isKeyHeld = true for chord keys
      } else {
        await onPlayNotes([key.note], velocity, true); // isKeyHeld = true for virtual key presses
      }
    },
    [
      mainMode,
      simpleMode,
      rootNote,
      scale,
      getChord,
      chordVoicing,
      velocity,
      onPlayNotes,
      chordModifiers,
    ]
  );

  const handleVirtualKeyRelease = useCallback(
    (key: KeyboardKey) => {
      if (
        mainMode === "simple" &&
        simpleMode === "chord" &&
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
    [mainMode, simpleMode, activeTriadChords, onReleaseKeyHeldNote]
  );

  const handleModifierPress = useCallback((modifier: string) => {
    setChordModifiers((prev) => {
      if (prev.has(modifier)) return prev;
      return new Set(prev).add(modifier);
    });
  }, []);

  const handleModifierRelease = useCallback((modifier: string) => {
    setChordModifiers((prev) => {
      if (!prev.has(modifier)) return prev;
      const newSet = new Set(prev);
      newSet.delete(modifier);
      return newSet;
    });
  }, []);

  const handleTriadPress = useCallback(
    async (index: number) => {
      const chord = getChord(rootNote, scale, index, chordVoicing, chordModifiers);
      
      // Optimized Map update - only create new Map if chord is different
      setActiveTriadChords((prev) => {
        const existingChord = prev.get(index);
        if (existingChord && JSON.stringify(existingChord) === JSON.stringify(chord)) {
          return prev;
        }
        return new Map(prev).set(index, chord);
      });
      
      if (keyboardState) {
        // Use keyboard state system to respect sustain settings
        for (const note of chord) {
          await keyboardState.playNote(note, velocity, true);
        }
      } else {
        // Fallback to direct call (for backward compatibility)
        onPlayNotes(chord, velocity, true);
      }
      
      // Optimized Set update - only create new Set if needed
      setPressedTriads((prev) => {
        if (prev.has(index)) return prev;
        return new Set(prev).add(index);
      });
    },
    [rootNote, scale, getChord, chordVoicing, velocity, chordModifiers, keyboardState, onPlayNotes]
  );

  const handleTriadRelease = useCallback(
    (index: number) => {
      const chord = activeTriadChords.get(index);
      if (chord) {
        if (keyboardState) {
          // Use keyboard state system for consistency
          chord.forEach((note: string) => keyboardState.releaseKeyHeldNote(note));
        } else {
          // Fallback to direct call (for backward compatibility)
          chord.forEach((note: string) => onReleaseKeyHeldNote(note));
        }
        
        // Optimized Map update - only create new Map if needed
        setActiveTriadChords((prev) => {
          if (!prev.has(index)) return prev;
          const newMap = new Map(prev);
          newMap.delete(index);
          return newMap;
        });
      }
      
      // Optimized Set update - only create new Set if needed
      setPressedTriads((prev) => {
        if (!prev.has(index)) return prev;
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    },
    [activeTriadChords, keyboardState, onReleaseKeyHeldNote]
  );

  return {
    mainMode,
    setMainMode,
    simpleMode,
    setSimpleMode,
    currentOctave,
    setCurrentOctave,
    velocity,
    setVelocity,
    chordVoicing,
    setChordVoicing,
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
  };
};
