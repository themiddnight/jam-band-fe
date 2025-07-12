import { useState, useCallback } from "react";
import { NOTE_NAMES, type Scale } from "../../../hooks/useScaleState";
import type { MainMode, KeyboardKey, SimpleMode } from "../types/keyboard";


export const melodySimpleKeys = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"];
export const melodySimpleKeysUpper = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"];
export const melodyAdvancedKeys = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k", "o", "l", "p", ";", "'", "]"];
export const chordRootKeys = ["a", "s", "d", "f", "g", "h", "j"];
export const chordTriadKeys = ["q", "w", "e", "r", "t", "y", "u"];

export const useVirtualKeyboard = (
  mainMode: MainMode,
  simpleMode: SimpleMode,
  getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[],
  rootNote: string,
  scale: Scale,
  currentOctave: number
) => {
  const [chordVoicing, setChordVoicing] = useState<number>(0);
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [pressedTriads, setPressedTriads] = useState<Set<number>>(new Set());
  const [activeTriadChords, setActiveTriadChords] = useState<Map<number, string[]>>(new Map());

  const getChord = useCallback(
    (
      root: string,
      scaleType: Scale,
      degree: number,
      octave: number,
      voicing: number = 0,
      modifiers: Set<string> = new Set()
    ) => {
      const scaleNotes = getScaleNotes(root, scaleType, octave);
      const rootNote = scaleNotes[degree % 7];
      const third = scaleNotes[(degree + 2) % 7];
      const fifth = scaleNotes[(degree + 4) % 7];

      const baseOctave = octave + voicing;
      const chordNotes = [rootNote];

      // Apply chord modifications
      if (modifiers.has("n")) {
        // Sus2: replace third with second
        const second = scaleNotes[(degree + 1) % 7];
        chordNotes.push(second.replace(/\d+/, baseOctave.toString()));
      } else if (modifiers.has("m")) {
        // Sus4: replace third with fourth
        const fourth = scaleNotes[(degree + 3) % 7];
        chordNotes.push(fourth.replace(/\d+/, baseOctave.toString()));
      } else {
        // Normal third
        let thirdToUse = third;

        // Major/minor toggle
        if (modifiers.has(".")) {
          const rootIndex = NOTE_NAMES.indexOf(rootNote.replace(/\d+/, ""));
          const thirdIndex = NOTE_NAMES.indexOf(third.replace(/\d+/, ""));
          const interval = (thirdIndex - rootIndex + 12) % 12;

          if (interval === 4) {
            // Major third -> minor third (lower by semitone)
            const newThirdIndex = (thirdIndex - 1 + 12) % 12;
            thirdToUse = `${NOTE_NAMES[newThirdIndex]}${
              third.match(/\d+/)?.[0] || baseOctave
            }`;
          } else if (interval === 3) {
            // Minor third -> major third (raise by semitone)
            const newThirdIndex = (thirdIndex + 1) % 12;
            const octaveAdjust = newThirdIndex === 0 ? 1 : 0;
            thirdToUse = `${NOTE_NAMES[newThirdIndex]}${
              parseInt(third.match(/\d+/)?.[0] || baseOctave.toString()) +
              octaveAdjust
            }`;
          }
        }

        chordNotes.push(thirdToUse.replace(/\d+/, baseOctave.toString()));
      }

      // Add fifth
      chordNotes.push(fifth.replace(/\d+/, baseOctave.toString()));

      // Helper functions for tension notes
      const getNoteNumber = (note: string) => {
        const noteMatch = note.match(/([A-G]#?)(\d+)/);
        if (!noteMatch) return 0;
        const [, noteName, octaveStr] = noteMatch;
        const noteIndex = NOTE_NAMES.indexOf(noteName);
        const octave = parseInt(octaveStr);
        return octave * 12 + noteIndex;
      };

      const getNoteFromNumber = (noteNumber: number) => {
        const octave = Math.floor(noteNumber / 12);
        const noteIndex = noteNumber % 12;
        return `${NOTE_NAMES[noteIndex]}${octave}`;
      };

      // Get the highest note number in the current triad
      const triadNoteNumbers = chordNotes.map((note) => getNoteNumber(note));
      const highestNoteNumber = Math.max(...triadNoteNumbers);

      // Add tension notes just above the highest triad note
      if (modifiers.has("i")) {
        // Dominant 7th
        const seventh = scaleNotes[(degree + 6) % 7];
        const rootIndex = NOTE_NAMES.indexOf(rootNote.replace(/\d+/, ""));
        const seventhNoteIndex = NOTE_NAMES.indexOf(seventh.replace(/\d+/, ""));
        const interval = (seventhNoteIndex - rootIndex + 12) % 12;

        let tensionNoteIndex = seventhNoteIndex;
        
        // Determine if we should use flat 7th based on chord context
        const shouldUseFlatSeventh = () => {
          // For major scale: use flat 7th on I, IV, V chords (degrees 0, 3, 4)
          // For minor scale: use flat 7th on i, iv, v chords (degrees 0, 3, 4)
          if ([0, 3, 4].includes(degree)) {
            return interval === 11; // Natural 7th -> make it flat 7th
          }
          // For other degrees, use the natural scale seventh
          return false;
        };

        if (shouldUseFlatSeventh() && !modifiers.has(".")) {
          // Natural 7th -> make it flat 7th
          tensionNoteIndex = (seventhNoteIndex - 1 + 12) % 12;
        }

        // Place tension note just above the highest triad note
        let tensionNoteNumber = highestNoteNumber + 1;
        while (tensionNoteNumber % 12 !== tensionNoteIndex) {
          tensionNoteNumber++;
        }

        chordNotes.push(getNoteFromNumber(tensionNoteNumber));
      }

      if (modifiers.has("o")) {
        // Major 7th - always use the natural 7th from the scale
        const seventh = scaleNotes[(degree + 6) % 7];
        const seventhNoteIndex = NOTE_NAMES.indexOf(seventh.replace(/\d+/, ""));

        // Place tension note just above the highest triad note
        let tensionNoteNumber = highestNoteNumber + 1;
        while (tensionNoteNumber % 12 !== seventhNoteIndex) {
          tensionNoteNumber++;
        }

        chordNotes.push(getNoteFromNumber(tensionNoteNumber));
      }

      return chordNotes;
    },
    [getScaleNotes]
  );

  const generateVirtualKeys = useCallback((): KeyboardKey[] => {
    const keys: KeyboardKey[] = [];

    if (mainMode === "simple") {
      if (simpleMode === "melody") {
        // Lower row keys (current octave)
        const scaleNotes = getScaleNotes(rootNote, scale, currentOctave);
        const nextOctaveNotes = getScaleNotes(rootNote, scale, currentOctave + 1);
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
        const upperScaleNotes = getScaleNotes(rootNote, scale, currentOctave + 1);
        const upperNextOctaveNotes = getScaleNotes(rootNote, scale, currentOctave + 2);
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
          const whiteKeyMapping = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "]"];
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
            const blackKeyMapping = ["w", "e", "", "t", "y", "u", ""];
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

  return {
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
  };
};
