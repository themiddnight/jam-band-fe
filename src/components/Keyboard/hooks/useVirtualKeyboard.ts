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
      voicing: number = 0,
      modifiers: Set<string> = new Set()
    ): string[] => {
      const allNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
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
      const wideScaleNotes = [
          ...getScaleNotes(root, scaleType, baseOctave-1), 
          ...scaleNotes, 
          ...getScaleNotes(root, scaleType, baseOctave+1)
        ];

      const rootNoteOfChord = scaleNotes[degree % 7];

      const scaleNoteNames = getScaleNotes(root, scaleType, 0).map(n => n.slice(0, -1));

      // Determine original quality from diatonic interval
      const rootNoteName = scaleNoteNames[degree % 7];
      const thirdNoteNameFromScale = scaleNoteNames[(degree + 2) % 7];

      const rootPitch = allNotes.indexOf(rootNoteName);
      let thirdPitch = allNotes.indexOf(thirdNoteNameFromScale);
      if (thirdPitch < rootPitch) thirdPitch += 12;

      const semitoneInterval = thirdPitch - rootPitch;
      const isOriginallyMajor = semitoneInterval === 4;

      let finalThirdNoteName = thirdNoteNameFromScale;

      if (modifiers.has(".")) {
        if (isOriginallyMajor) { // originally major, change to minor
          finalThirdNoteName = allNotes[(allNotes.indexOf(thirdNoteNameFromScale) - 1 + 12) % 12];
        } else { // originally minor/dim, change to major
          finalThirdNoteName = allNotes[(allNotes.indexOf(thirdNoteNameFromScale) + 1) % 12];
        }
      }
      
      const fifthDegree = (degree + 4) % 7;
      const fifthNoteName = scaleNoteNames[fifthDegree];
      
      let chordNotes: string[] = [rootNoteOfChord];

      const getNoteByName = (name: string, referenceNote: string) => {
        const note = wideScaleNotes.find(n => n.startsWith(name) && getNoteIndex(n) >= getNoteIndex(referenceNote));
        if (!note) {
            let noteIndex = getNoteIndex(referenceNote) - allNotes.indexOf(referenceNote.slice(0,-1)) + allNotes.indexOf(name);
            if (noteIndex < getNoteIndex(referenceNote)) noteIndex += 12;
            return getNoteFromIndex(noteIndex);
        }
        return note;
      };
      
      const thirdNote = getNoteByName(finalThirdNoteName, rootNoteOfChord);
      const fifthNote = getNoteByName(fifthNoteName, rootNoteOfChord);
      
      if (modifiers.has("n")) {
        const secondDegree = (degree + 1) % 7;
        const secondNoteName = scaleNoteNames[secondDegree];
        chordNotes.push(getNoteByName(secondNoteName, rootNoteOfChord));
      } else if (modifiers.has("m")) {
        const fourthDegree = (degree + 3) % 7;
        const fourthNoteName = scaleNoteNames[fourthDegree];
        chordNotes.push(getNoteByName(fourthNoteName, rootNoteOfChord));
      } else {
        chordNotes.push(thirdNote);
      }
      chordNotes.push(fifthNote);

      chordNotes = [...new Set(chordNotes)];
      chordNotes.sort((a,b) => getNoteIndex(a) - getNoteIndex(b));
      
      const finalChordNotes = chordNotes.map(note => {
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

      if (modifiers.has("i")) {
        const rootNoteIndex = getNoteIndex(rootNoteOfChord);
        let seventhNoteIndex = rootNoteIndex + 10;
        const highestNoteIndex = getNoteIndex(finalChordNotes[finalChordNotes.length-1]);
        if (seventhNoteIndex <= highestNoteIndex) seventhNoteIndex += 12;
        finalChordNotes.push(getNoteFromIndex(seventhNoteIndex));
      }
      if (modifiers.has("o")) {
        const rootNoteIndex = getNoteIndex(rootNoteOfChord);
        let seventhNoteIndex = rootNoteIndex + 11;
        const highestNoteIndex = getNoteIndex(finalChordNotes[finalChordNotes.length-1]);
        if (seventhNoteIndex <= highestNoteIndex) seventhNoteIndex += 12;
        finalChordNotes.push(getNoteFromIndex(seventhNoteIndex));
      }

      return finalChordNotes;
    },
    [getScaleNotes]
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
        const chord = getChord(rootNote, scale, keyIndex, 3, chordVoicing, chordModifiers);
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

  const handleModifierPress = useCallback((modifier: string) => {
    setChordModifiers((prev) => new Set(prev).add(modifier));
  }, []);

  const handleModifierRelease = useCallback((modifier: string) => {
    setChordModifiers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(modifier);
      return newSet;
    });
  }, []);

  const handleTriadPress = useCallback(
    (index: number) => {
      const chord = getChord(rootNote, scale, index, 3, chordVoicing, chordModifiers);
      onPlayNotes(chord, velocity, true); // isKeyHeld = true for triad presses
    },
    [rootNote, scale, getChord, chordVoicing, velocity, onPlayNotes, chordModifiers]
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
    handleModifierPress,
    handleModifierRelease,
  };
};
