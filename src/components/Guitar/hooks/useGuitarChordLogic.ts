import type { Scale } from "../../../hooks/useScaleState";
import { getChordFromDegree } from "../../../utils/musicUtils";
import type { StrumConfig } from "../types/guitar";
import { useState, useCallback } from "react";

export const useGuitarChordLogic = (
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void,
  onReleaseKeyHeldNote: (note: string) => void,
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  },
  velocity: number,
  chordVoicing: number,
  brushingSpeed: number,
) => {
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [powerChordMode, setPowerChordMode] = useState(false);
  const [pressedChords, setPressedChords] = useState<Set<number>>(new Set());
  const [strumConfig, setStrumConfig] = useState<StrumConfig>({
    speed: brushingSpeed,
    direction: "down",
    isActive: false,
  });

  // Convert shortcut keys to modifier names for chord generation
  const convertChordModifiers = useCallback(
    (modifiers: Set<string>): Set<string> => {
      const convertedModifiers = new Set<string>();

      if (modifiers.has("q")) {
        convertedModifiers.add("dominant7");
      }
      if (modifiers.has("w")) {
        convertedModifiers.add("major7");
      }
      if (modifiers.has("e")) {
        convertedModifiers.add("sus2");
      }
      if (modifiers.has("r")) {
        convertedModifiers.add("sus4");
      }
      if (modifiers.has("t")) {
        convertedModifiers.add("majMinToggle");
      }
      if (powerChordMode) {
        convertedModifiers.add("powerChordToggle");
      }

      return convertedModifiers;
    },
    [powerChordMode],
  );

  // Handle strum chord for simple chord mode with proper timing
  const handleStrumChord = useCallback(
    async (chordIndex: number, direction: "up" | "down") => {
      // Generate chord notes
      let chordNotes = getChordFromDegree(
        scaleState.rootNote,
        scaleState.scale,
        chordIndex,
        chordVoicing,
        convertChordModifiers(chordModifiers),
      );

      // For power chords, use exactly 2 notes. For normal chords, ensure 5 notes
      if (powerChordMode) {
        // Power chords: use exactly 2 notes
        chordNotes = chordNotes.slice(0, 2);
      } else {
        // Normal chords: ensure we have exactly 5 notes by adding additional chord tones if needed
        if (chordNotes.length < 5) {
          // Add octave variations of existing chord tones
          const baseChordNotes = [...chordNotes];
          for (
            let i = 0;
            i < baseChordNotes.length && chordNotes.length < 5;
            i++
          ) {
            const note = baseChordNotes[i];
            const noteName = note.slice(0, -1);
            const octave = parseInt(note.slice(-1));
            const higherOctaveNote = `${noteName}${octave + 1}`;

            // Only add if not already in the chord
            if (!chordNotes.includes(higherOctaveNote)) {
              chordNotes.push(higherOctaveNote);
            }
          }
        }

        // Take only the first 5 notes
        chordNotes = chordNotes.slice(0, 5);
      }

      // Sort notes by pitch (low to high) for proper strumming
      chordNotes.sort((a, b) => {
        const noteA = a.slice(0, -1);
        const octaveA = parseInt(a.slice(-1));
        const noteB = b.slice(0, -1);
        const octaveB = parseInt(b.slice(-1));

        if (octaveA !== octaveB) {
          return octaveA - octaveB;
        }

        // Simple note comparison (C < D < E < F < G < A < B)
        const noteOrder = ["C", "D", "E", "F", "G", "A", "B"];
        return noteOrder.indexOf(noteA) - noteOrder.indexOf(noteB);
      });

      // Play notes with strum timing - up strum plays high to low (like real guitar)
      const noteOrder =
        direction === "up" ? [...chordNotes].reverse() : chordNotes;

      // Use 70% velocity for strum up (,) button
      const strumVelocity = direction === "up" ? velocity * 0.7 : velocity;

      for (let i = 0; i < noteOrder.length; i++) {
        setTimeout(async () => {
          await onPlayNotes([noteOrder[i]], strumVelocity, true);
        }, i * strumConfig.speed);
      }
    },
    [
      scaleState.rootNote,
      scaleState.scale,
      chordVoicing,
      convertChordModifiers,
      chordModifiers,
      powerChordMode,
      velocity,
      strumConfig.speed,
      onPlayNotes,
    ],
  );

  // Handle chord press/release for simple chord mode
  const handleChordPress = useCallback(
    (chordIndex: number) => {
      const newPressedChords = new Set(pressedChords);
      newPressedChords.add(chordIndex);
      setPressedChords(newPressedChords);
    },
    [pressedChords],
  );

  const handleChordRelease = useCallback(
    (chordIndex: number) => {
      const newPressedChords = new Set(pressedChords);
      newPressedChords.delete(chordIndex);
      setPressedChords(newPressedChords);

      // Stop chord notes when releasing chord button
      let chordNotes = getChordFromDegree(
        scaleState.rootNote,
        scaleState.scale,
        chordIndex,
        chordVoicing,
        convertChordModifiers(chordModifiers),
      );

      // For power chords, use exactly 2 notes. For normal chords, ensure 5 notes
      if (powerChordMode) {
        // Power chords: use exactly 2 notes
        chordNotes = chordNotes.slice(0, 2);
      } else {
        // Normal chords: ensure we have exactly 5 notes by adding additional chord tones if needed
        if (chordNotes.length < 5) {
          // Add octave variations of existing chord tones
          const baseChordNotes = [...chordNotes];
          for (
            let i = 0;
            i < baseChordNotes.length && chordNotes.length < 5;
            i++
          ) {
            const note = baseChordNotes[i];
            const noteName = note.slice(0, -1);
            const octave = parseInt(note.slice(-1));
            const higherOctaveNote = `${noteName}${octave + 1}`;

            // Only add if not already in the chord
            if (!chordNotes.includes(higherOctaveNote)) {
              chordNotes.push(higherOctaveNote);
            }
          }
        }

        // Take only the first 5 notes
        chordNotes = chordNotes.slice(0, 5);
      }

      for (const note of chordNotes) {
        onReleaseKeyHeldNote(note);
      }
    },
    [
      pressedChords,
      scaleState.rootNote,
      scaleState.scale,
      chordVoicing,
      convertChordModifiers,
      chordModifiers,
      powerChordMode,
      onReleaseKeyHeldNote,
    ],
  );

  // Update strumConfig when brushingSpeed changes
  const updateStrumSpeed = useCallback((speed: number) => {
    setStrumConfig((prev) => ({ ...prev, speed }));
  }, []);

  const updateStrumDirection = useCallback((direction: "up" | "down") => {
    setStrumConfig((prev) => ({ ...prev, direction }));
  }, []);

  return {
    chordModifiers,
    setChordModifiers,
    powerChordMode,
    setPowerChordMode,
    pressedChords,
    setPressedChords,
    strumConfig,
    handleStrumChord,
    handleChordPress,
    handleChordRelease,
    updateStrumSpeed,
    updateStrumDirection,
  };
};
