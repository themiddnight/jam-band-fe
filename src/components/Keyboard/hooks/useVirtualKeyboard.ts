import { useState, useCallback } from "react";
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
  onReleaseKeyHeldNote: (note: string) => void
) => {
  const [mainMode, setMainMode] = useState<MainMode>("simple");
  const [simpleMode, setSimpleMode] = useState<SimpleMode>("melody");
  const [currentOctave, setCurrentOctave] = useState<number>(2);
  const [velocity, setVelocity] = useState<number>(0.7);
  const [chordVoicing, setChordVoicing] = useState<number>(1);
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [pressedTriads, setPressedTriads] = useState<Set<number>>(new Set());
  const [activeTriadChords, setActiveTriadChords] = useState<
    Map<number, string[]>
  >(new Map());

  const getChord = useCallback(
    (
      root: string,
      scaleType: Scale,
      degree: number,
      numNotes: number,
      voicing: number = 0
    ): string[] => {
      const baseOctave = currentOctave + voicing;
      const scaleNotes = getScaleNotes(root, scaleType, baseOctave);
      const rootNote = scaleNotes[degree % 7];

      const chordNotes: string[] = [rootNote];

      // Build the basic triad (or more)
      for (let i = 1; i < numNotes; i++) {
        const noteIndex = (degree + i * 2) % 7;
        const note = scaleNotes[noteIndex];

        // Ensure notes are in the correct octave relative to the root
        const rootNoteNumber = parseInt(rootNote.match(/(\d+)/)?.[0] || "0");
        const currentNoteNumber = parseInt(note.match(/(\d+)/)?.[0] || "0");

        if (currentNoteNumber < rootNoteNumber) {
          chordNotes.push(
            note.replace(/\d+/, (currentNoteNumber + 1).toString())
          );
        } else {
          chordNotes.push(note);
        }
      }

      return chordNotes;
    },
    [getScaleNotes, currentOctave]
  );

  const generateVirtualKeys = useCallback((): KeyboardKey[] => {
    const keys: KeyboardKey[] = [];

    if (mainMode === "simple") {
      if (simpleMode === "melody") {
        // Lower row keys (current octave)
        const scaleNotes = getScaleNotes(rootNote, scale, currentOctave);
        const nextOctaveNotes = getScaleNotes(
          rootNote,
          scale,
          currentOctave + 1
        );
        const lowerRowNotes = [...scaleNotes, ...nextOctaveNotes];

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

        // Upper row keys (one octave higher)
        const upperScaleNotes = getScaleNotes(
          rootNote,
          scale,
          currentOctave + 1
        );
        const upperNextOctaveNotes = getScaleNotes(
          rootNote,
          scale,
          currentOctave + 2
        );
        const upperRowNotes = [...upperScaleNotes, ...upperNextOctaveNotes];

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
        // Use currentOctave for chord root notes (baseline)
        const scaleNotes = getScaleNotes(rootNote, scale, currentOctave);

        chordRootKeys.forEach((key, index) => {
          if (index < scaleNotes.length) {
            keys.push({
              note: scaleNotes[index],
              isBlack: false,
              position: index,
              keyboardKey: key,
            });
          }
        });
      }
    } else {
      const whiteNotes = ["C", "D", "E", "F", "G", "A", "B"];
      const blackNotes = ["C#", "D#", "", "F#", "G#", "A#", ""];

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
  }, [mainMode, simpleMode, getScaleNotes, rootNote, scale, currentOctave]);

  const handleVirtualKeyPress = useCallback(
    (key: KeyboardKey) => {
      if (
        mainMode === "simple" &&
        simpleMode === "chord" &&
        chordTriadKeys.some((k) => k === key.keyboardKey)
      ) {
        const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
        const chord = getChord(rootNote, scale, keyIndex, 3, chordVoicing);
        onPlayNotes(chord, velocity, true); // isKeyHeld = true for chord keys
      } else {
        onPlayNotes([key.note], velocity, true); // isKeyHeld = true for virtual key presses
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
          setActiveTriadChords((prev) => {
            const newMap = new Map(prev);
            newMap.delete(keyIndex);
            return newMap;
          });
        }
        setPressedTriads((prev) => {
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

  const handleTriadPress = useCallback(
    (index: number) => {
      const chord = getChord(rootNote, scale, index, 3, chordVoicing);
      onPlayNotes(chord, velocity, true); // isKeyHeld = true for triad presses
    },
    [rootNote, scale, getChord, chordVoicing, velocity, onPlayNotes]
  );

  const handleTriadRelease = useCallback(
    (index: number) => {
      const chord = activeTriadChords.get(index);
      if (chord) {
        chord.forEach((note: string) => onReleaseKeyHeldNote(note));
        setActiveTriadChords((prev) => {
          const newMap = new Map(prev);
          newMap.delete(index);
          return newMap;
        });
      }
      setPressedTriads((prev) => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    },
    [activeTriadChords, onReleaseKeyHeldNote]
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
  };
};
