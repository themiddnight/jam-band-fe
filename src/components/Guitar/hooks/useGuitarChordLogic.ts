import { GUITAR_STRUM } from "../../../constants/guitarShortcuts";
import type { Scale } from "../../../hooks/useScaleState";
import { getChordFromDegree } from "../../../utils/musicUtils";
import type { StrumConfig } from "../types/guitar";
import { useState, useCallback, useEffect } from "react";

export const useGuitarChordLogic = (
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void,
  onStopNotes: (notes: string[]) => void,
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
  // Track the actual notes that were played for each chord with their modifiers
  const [playedChordNotes, setPlayedChordNotes] = useState<
    Map<number, string[]>
  >(new Map());
  // Track scheduled timeouts for strumming to cancel them if needed
  const [scheduledTimeouts, setScheduledTimeouts] = useState<
    Map<number, number[]>
  >(new Map());
  const [strumConfig, setStrumConfig] = useState<StrumConfig>({
    speed: brushingSpeed,
    direction: "down",
    isActive: false,
  });

  // Update strumConfig when brushingSpeed prop changes
  useEffect(() => {
    setStrumConfig((prev) => ({ ...prev, speed: brushingSpeed }));
  }, [brushingSpeed]);

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

      // Play notes with strum timing - down strum plays low to high, up strum plays high to low
      const noteOrder =
        direction === "down" ? chordNotes : [...chordNotes].reverse();

      // Use strum velocity for strum up (,) button
      const strumVelocity =
        direction === "up"
          ? velocity * GUITAR_STRUM.UP_VELOCITY_MULTIPLIER
          : velocity;

      // Track the notes that are actually played for this chord
      setPlayedChordNotes((prev) => {
        const newMap = new Map(prev);
        newMap.set(chordIndex, [...chordNotes]); // Store all chord notes regardless of strum order
        return newMap;
      });

      // If brush time is 0ms, play all notes simultaneously
      if (strumConfig.speed === 0) {
        // Play all notes at once without any delays
        for (const note of noteOrder) {
          onPlayNotes([note], strumVelocity, true);
        }
      } else {
        // Use strum timing with delays when brush time is greater than 0ms
        const timeouts: number[] = [];
        for (let i = 0; i < noteOrder.length; i++) {
          const timeout = setTimeout(async () => {
            await onPlayNotes([noteOrder[i]], strumVelocity, true);
          }, i * strumConfig.speed) as unknown as number;
          timeouts.push(timeout);
        }

        // Track timeouts so they can be cancelled if chord is released
        setScheduledTimeouts((prev) => {
          const newMap = new Map(prev);
          const existingTimeouts = newMap.get(chordIndex) || [];
          newMap.set(chordIndex, [...existingTimeouts, ...timeouts]);
          return newMap;
        });
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

      // Generate and store the chord notes when pressed to ensure we can stop them later
      let chordNotes = getChordFromDegree(
        scaleState.rootNote,
        scaleState.scale,
        chordIndex,
        chordVoicing,
        convertChordModifiers(chordModifiers),
      );

      // For power chords, use exactly 2 notes. For normal chords, ensure 5 notes
      if (powerChordMode) {
        chordNotes = chordNotes.slice(0, 2);
      } else {
        if (chordNotes.length < 5) {
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

            if (!chordNotes.includes(higherOctaveNote)) {
              chordNotes.push(higherOctaveNote);
            }
          }
        }
        chordNotes = chordNotes.slice(0, 5);
      }

      // Store the notes that should be played for this chord
      setPlayedChordNotes((prev) => {
        const newMap = new Map(prev);
        newMap.set(chordIndex, chordNotes);
        return newMap;
      });
    },
    [
      pressedChords,
      scaleState.rootNote,
      scaleState.scale,
      chordVoicing,
      convertChordModifiers,
      chordModifiers,
      powerChordMode,
    ],
  );

  const handleChordRelease = useCallback(
    (chordIndex: number) => {
      const newPressedChords = new Set(pressedChords);
      newPressedChords.delete(chordIndex);
      setPressedChords(newPressedChords);

      // Cancel any scheduled strum timeouts for this chord
      const timeouts = scheduledTimeouts.get(chordIndex);
      if (timeouts) {
        timeouts.forEach((timeout) => clearTimeout(timeout));
        setScheduledTimeouts((prev) => {
          const newMap = new Map(prev);
          newMap.delete(chordIndex);
          return newMap;
        });
      }

      // Stop the notes that were actually played for this chord
      const actualPlayedNotes = playedChordNotes.get(chordIndex);
      if (actualPlayedNotes) {
        // Stop all the notes that were played for this chord immediately
        onStopNotes(actualPlayedNotes);

        // Remove the chord from played notes
        setPlayedChordNotes((prev) => {
          const newMap = new Map(prev);
          newMap.delete(chordIndex);
          return newMap;
        });
      } else {
        // Fallback: calculate current chord notes and stop them
        let chordNotes = getChordFromDegree(
          scaleState.rootNote,
          scaleState.scale,
          chordIndex,
          chordVoicing,
          convertChordModifiers(chordModifiers),
        );

        // For power chords, use exactly 2 notes. For normal chords, ensure 5 notes
        if (powerChordMode) {
          chordNotes = chordNotes.slice(0, 2);
        } else {
          if (chordNotes.length < 5) {
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

              if (!chordNotes.includes(higherOctaveNote)) {
                chordNotes.push(higherOctaveNote);
              }
            }
          }
          chordNotes = chordNotes.slice(0, 5);
        }

        // Stop all notes immediately
        onStopNotes(chordNotes);
      }
    },
    [
      pressedChords,
      scheduledTimeouts,
      playedChordNotes,
      scaleState.rootNote,
      scaleState.scale,
      chordVoicing,
      convertChordModifiers,
      chordModifiers,
      powerChordMode,
      onStopNotes,
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
