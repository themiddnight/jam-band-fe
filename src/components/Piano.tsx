import { useEffect, useState, useRef, useCallback } from "react";
import Soundfont from "soundfont-player";

interface PianoKey {
  note: string;
  isBlack: boolean;
  position: number;
  keyboardKey?: string;
}

type MainMode = "simple" | "advanced";
type SimpleMode = "melody" | "chord";
type Scale = "major" | "minor";

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const melodySimpleKeys = [
  "a",
  "s",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  ";",
  "'",
];
const melodySimpleKeysUpper = [
  "q",
  "w",
  "e",
  "r",
  "t",
  "y",
  "u",
  "i",
  "o",
  "p",
  "[",
  "]",
];
const melodyAdvancedKeys = [
  "a",
  "w",
  "s",
  "e",
  "d",
  "f",
  "t",
  "g",
  "y",
  "h",
  "u",
  "j",
  "k",
  "o",
  "l",
  "p",
  ";",
  "'",
  "]",
];
const chordRootKeys = ["a", "s", "d", "f", "g", "h", "j"];
const chordTriadKeys = ["q", "w", "e", "r", "t", "y", "u"];

export default function Piano() {
  const [instrument, setInstrument] = useState<any>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [heldKeys, setHeldKeys] = useState<Set<string>>(new Set());
  const [pressedTriads, setPressedTriads] = useState<Set<number>>(new Set());
  const [activeTriadChords, setActiveTriadChords] = useState<
    Map<number, string[]>
  >(new Map()); // Track which chords are active for each triad
  const [mainMode, setMainMode] = useState<MainMode>("simple");
  const [simpleMode, setSimpleMode] = useState<SimpleMode>("melody");
  const [scale, setScale] = useState<Scale>("major");
  const [rootNote, setRootNote] = useState<string>("C");
  const [velocity, setVelocity] = useState<number>(0.7);
  const [sustain, setSustain] = useState<boolean>(false);
  const [currentOctave, setCurrentOctave] = useState<number>(4);
  const [chordVoicing, setChordVoicing] = useState<number>(0);
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());

  const audioContext = useRef<AudioContext | null>(null);
  const sustainedNotes = useRef<Set<any>>(new Set());
  const activeNotes = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        audioContext.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        const piano = await Soundfont.instrument(
          audioContext.current,
          "acoustic_grand_piano"
        );
        setInstrument(piano);
      } catch (error) {
        console.error("Failed to load piano instrument:", error);
      }
    };

    initializeAudio();

    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  const getScaleNotes = useCallback(
    (root: string, scaleType: Scale, octave: number) => {
      const rootIndex = NOTE_NAMES.indexOf(root);
      return SCALES[scaleType].map((interval) => {
        const noteIndex = (rootIndex + interval) % 12;
        const noteOctave = octave + Math.floor((rootIndex + interval) / 12);
        return `${NOTE_NAMES[noteIndex]}${noteOctave}`;
      });
    },
    []
  );

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

      // Find the highest note in the triad to place tension notes above it
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
        const seventhNoteIndex = NOTE_NAMES.indexOf(seventh.replace(/\d+/, ""));

        // For dominant 7th, use flat 7th if it's a major chord
        const rootIndex = NOTE_NAMES.indexOf(rootNote.replace(/\d+/, ""));
        const interval = (seventhNoteIndex - rootIndex + 12) % 12;

        let tensionNoteIndex = seventhNoteIndex;
        if (interval === 11 && !modifiers.has(".")) {
          // Natural 7th in major context -> make it flat 7th
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
        // Major 7th
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

  const playNote = useCallback(
    (note: string, vel: number = velocity, sustainNote: boolean = false) => {
      if (instrument && audioContext.current?.state === "running") {
        const existingNote = activeNotes.current.get(note);
        if (existingNote && existingNote.stop) {
          existingNote.stop();
        }

        const playedNote = instrument.play(
          note,
          audioContext.current.currentTime,
          { gain: vel }
        );

        activeNotes.current.set(note, playedNote);

        if (sustain || sustainNote) {
          sustainedNotes.current.add(playedNote);
        }

        setPressedKeys((prev) => new Set(prev).add(note));

        if (!sustain && !sustainNote) {
          setTimeout(() => {
            if (playedNote && playedNote.stop) {
              playedNote.stop();
            }
            activeNotes.current.delete(note);
            setPressedKeys((prev) => {
              const newSet = new Set(prev);
              newSet.delete(note);
              return newSet;
            });
          }, 300);
        }
      } else if (audioContext.current?.state === "suspended") {
        audioContext.current.resume();
      }
    },
    [instrument, velocity, sustain]
  );

  const stopNote = useCallback(
    (note: string) => {
      const activeNote = activeNotes.current.get(note);
      if (activeNote && activeNote.stop) {
        if (!sustain) {
          activeNote.stop();
          activeNotes.current.delete(note);
          sustainedNotes.current.delete(activeNote);
        }
      }

      if (!sustain) {
        setPressedKeys((prev) => {
          const newSet = new Set(prev);
          newSet.delete(note);
          return newSet;
        });
      }
    },
    [sustain]
  );

  const stopSustainedNotes = useCallback(() => {
    sustainedNotes.current.forEach((note) => {
      if (note && note.stop) note.stop();
    });
    sustainedNotes.current.clear();

    activeNotes.current.forEach((note) => {
      if (note && note.stop) note.stop();
    });
    activeNotes.current.clear();

    setPressedKeys(new Set());
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === " ") {
        event.preventDefault();
        if (!heldKeys.has(key)) {
          setSustain(true);
          setHeldKeys((prev) => new Set(prev).add(key));
        }
        return;
      }

      if (heldKeys.has(key)) {
        return;
      }

      setHeldKeys((prev) => new Set(prev).add(key));

      // Handle chord modifier keys ONLY in simple chord mode
      if (
        ["i", "o", "n", "m", "."].includes(key) &&
        mainMode === "simple" &&
        simpleMode === "chord"
      ) {
        setChordModifiers((prev) => new Set(prev).add(key));
        return; // Don't play notes for modifier keys in chord mode
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
        setVelocity(parseInt(key) / 9);
        return;
      }

      if (key === "/") {
        if (mainMode === "simple") {
          setSimpleMode((prev) => (prev === "melody" ? "chord" : "melody"));
        }
        return;
      }

      // Octave controls (z, x) - affects melody, chord baseline, and advanced mode
      if (key === "z") {
        setCurrentOctave((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key === "x") {
        setCurrentOctave((prev) => Math.min(8, prev + 1));
        return;
      }

      // Voicing controls (c, v) - only affects chord triads
      if (key === "c") {
        if (mainMode === "simple" && simpleMode === "chord") {
          setChordVoicing((prev) => Math.max(-2, prev - 1));
        }
        return;
      }

      if (key === "v") {
        if (mainMode === "simple" && simpleMode === "chord") {
          setChordVoicing((prev) => Math.min(2, prev + 1));
        }
        return;
      }

      if (mainMode === "simple") {
        if (simpleMode === "melody") {
          // Lower row keys (a,s,d,f,g,h,j,k,l,;,')
          if (melodySimpleKeys.includes(key)) {
            const keyIndex = melodySimpleKeys.indexOf(key);
            const scaleNotes = getScaleNotes(rootNote, scale, currentOctave);
            if (keyIndex < scaleNotes.length) {
              playNote(scaleNotes[keyIndex], velocity, true);
            } else {
              const nextOctaveNotes = getScaleNotes(
                rootNote,
                scale,
                currentOctave + 1
              );
              if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
                playNote(
                  nextOctaveNotes[keyIndex - scaleNotes.length],
                  velocity,
                  true
                );
              }
            }
          }
          // Upper row keys (q,w,e,r,t,y,u,i,o,p,[,])
          else if (melodySimpleKeysUpper.includes(key)) {
            const keyIndex = melodySimpleKeysUpper.indexOf(key);
            const scaleNotes = getScaleNotes(
              rootNote,
              scale,
              currentOctave + 1
            );
            if (keyIndex < scaleNotes.length) {
              playNote(scaleNotes[keyIndex], velocity, true);
            } else {
              const nextOctaveNotes = getScaleNotes(
                rootNote,
                scale,
                currentOctave + 2
              );
              if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
                playNote(
                  nextOctaveNotes[keyIndex - scaleNotes.length],
                  velocity,
                  true
                );
              }
            }
          }
        } else if (simpleMode === "chord") {
          if (chordRootKeys.includes(key)) {
            const keyIndex = chordRootKeys.indexOf(key);
            const scaleNotes = getScaleNotes(rootNote, scale, currentOctave);
            if (keyIndex < scaleNotes.length) {
              playNote(scaleNotes[keyIndex], velocity, true);
            }
          } else if (chordTriadKeys.includes(key)) {
            const keyIndex = chordTriadKeys.indexOf(key);
            // Pass current modifiers to getChord
            const chord = getChord(
              rootNote,
              scale,
              keyIndex,
              3,
              chordVoicing,
              chordModifiers
            );

            // Store the chord notes for this triad key
            setActiveTriadChords((prev) => new Map(prev).set(keyIndex, chord));

            chord.forEach((note) => playNote(note, velocity, true));
            // Track which triad is pressed
            setPressedTriads((prev) => new Set(prev).add(keyIndex));
          }
        }
      } else if (mainMode === "advanced") {
        if (melodyAdvancedKeys.includes(key)) {
          const keyIndex = melodyAdvancedKeys.indexOf(key);
          const noteMapping = [
            "C",
            "C#",
            "D",
            "D#",
            "E",
            "F",
            "F#",
            "G",
            "G#",
            "A",
            "A#",
            "B",
            "C",
            "C#",
            "D",
            "D#",
            "E",
            "F",
            "F#",
          ];
          const octaveOffset = keyIndex >= 12 ? 1 : 0;
          const note = `${noteMapping[keyIndex]}${
            currentOctave + octaveOffset
          }`;
          playNote(note, velocity, true);
        }
      }
    },
    [
      heldKeys,
      mainMode,
      simpleMode,
      getScaleNotes,
      rootNote,
      scale,
      currentOctave,
      playNote,
      getChord,
      chordVoicing,
      velocity,
      chordModifiers,
    ]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      setHeldKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });

      // Remove chord modifiers when keys are released ONLY in simple chord mode
      if (
        ["i", "o", "n", "m", "."].includes(key) &&
        mainMode === "simple" &&
        simpleMode === "chord"
      ) {
        setChordModifiers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });

        // When a modifier is released, we need to stop any tension notes that were added by that modifier
        // but keep the triad notes playing if the triad key is still held
        activeTriadChords.forEach((chord, triadIndex) => {
          if (pressedTriads.has(triadIndex)) {
            // Triad is still pressed, so regenerate chord without the released modifier
            const newChord = getChord(
              rootNote,
              scale,
              triadIndex,
              3,
              chordVoicing,
              chordModifiers
            );

            // Stop notes that are no longer in the new chord
            chord.forEach((note) => {
              if (!newChord.includes(note)) {
                stopNote(note);
              }
            });

            // Play any new notes that weren't in the old chord
            newChord.forEach((note) => {
              if (!chord.includes(note)) {
                playNote(note, velocity, true);
              }
            });

            // Update the stored chord
            setActiveTriadChords((prev) =>
              new Map(prev).set(triadIndex, newChord)
            );
          }
        });

        return;
      }

      if (key === " ") {
        setSustain(false);
        stopSustainedNotes();
        return;
      }

      // Don't handle key up for control keys
      if (
        ["z", "x", "c", "v", "/"].includes(key) ||
        (key >= "1" && key <= "9")
      ) {
        return;
      }

      if (mainMode === "simple") {
        if (simpleMode === "melody") {
          // Lower row keys
          if (melodySimpleKeys.includes(key)) {
            const keyIndex = melodySimpleKeys.indexOf(key);
            const scaleNotes = getScaleNotes(rootNote, scale, currentOctave);
            if (keyIndex < scaleNotes.length) {
              stopNote(scaleNotes[keyIndex]);
            } else {
              const nextOctaveNotes = getScaleNotes(
                rootNote,
                scale,
                currentOctave + 1
              );
              if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
                stopNote(nextOctaveNotes[keyIndex - scaleNotes.length]);
              }
            }
          }
          // Upper row keys
          else if (melodySimpleKeysUpper.includes(key)) {
            const keyIndex = melodySimpleKeysUpper.indexOf(key);
            const scaleNotes = getScaleNotes(
              rootNote,
              scale,
              currentOctave + 1
            );
            if (keyIndex < scaleNotes.length) {
              stopNote(scaleNotes[keyIndex]);
            } else {
              const nextOctaveNotes = getScaleNotes(
                rootNote,
                scale,
                currentOctave + 2
              );
              if (keyIndex - scaleNotes.length < nextOctaveNotes.length) {
                stopNote(nextOctaveNotes[keyIndex - scaleNotes.length]);
              }
            }
          }
        } else if (simpleMode === "chord") {
          if (chordRootKeys.includes(key)) {
            const keyIndex = chordRootKeys.indexOf(key);
            const scaleNotes = getScaleNotes(rootNote, scale, currentOctave);
            if (keyIndex < scaleNotes.length) {
              stopNote(scaleNotes[keyIndex]);
            }
          } else if (chordTriadKeys.includes(key)) {
            const keyIndex = chordTriadKeys.indexOf(key);

            // Stop all notes for this triad (including tension notes)
            const chord = activeTriadChords.get(keyIndex);
            if (chord) {
              chord.forEach((note) => stopNote(note));
              // Remove from active chords
              setActiveTriadChords((prev) => {
                const newMap = new Map(prev);
                newMap.delete(keyIndex);
                return newMap;
              });
            }

            // Remove from pressed triads
            setPressedTriads((prev) => {
              const newSet = new Set(prev);
              newSet.delete(keyIndex);
              return newSet;
            });
          }
        }
      } else if (mainMode === "advanced") {
        if (melodyAdvancedKeys.includes(key)) {
          const keyIndex = melodyAdvancedKeys.indexOf(key);
          const noteMapping = [
            "C",
            "C#",
            "D",
            "D#",
            "E",
            "F",
            "F#",
            "G",
            "G#",
            "A",
            "A#",
            "B",
            "C",
            "C#",
            "D",
            "D#",
            "E",
            "F",
            "F#",
          ];
          const octaveOffset = keyIndex >= 12 ? 1 : 0;
          const note = `${noteMapping[keyIndex]}${
            currentOctave + octaveOffset
          }`;
          stopNote(note);
        }
      }
    },
    [
      mainMode,
      simpleMode,
      getScaleNotes,
      rootNote,
      scale,
      currentOctave,
      getChord,
      chordVoicing,
      stopNote,
      stopSustainedNotes,
      chordModifiers,
      activeTriadChords,
      pressedTriads,
      playNote,
      velocity,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const generateVirtualKeys = () => {
    const keys: PianoKey[] = [];

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
          const whiteKeyMapping = [
            "a",
            "s",
            "d",
            "f",
            "g",
            "h",
            "j",
            "k",
            "l",
            ";",
            "'",
            "]",
          ];
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
  };

  const handleVirtualKeyPress = (key: PianoKey) => {
    if (
      mainMode === "simple" &&
      simpleMode === "chord" &&
      chordTriadKeys.some((k) => k === key.keyboardKey)
    ) {
      const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
      const chord = getChord(
        rootNote,
        scale,
        keyIndex,
        3,
        chordVoicing,
        chordModifiers
      );
      chord.forEach((note) => playNote(note, velocity, sustain));
    } else {
      playNote(key.note, velocity, sustain);
    }
  };

  const virtualKeys = generateVirtualKeys();

  return (
    <div className="flex flex-col items-center p-8 bg-gray-100 min-h-screen">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">Piano Player</h2>

      <div className="bg-white p-6 rounded-lg shadow-lg mb-6 w-full max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Mode Controls</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setMainMode("simple")}
                className={`px-4 py-2 rounded ${
                  mainMode === "simple"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setMainMode("advanced")}
                className={`px-4 py-2 rounded ${
                  mainMode === "advanced"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                Advanced
              </button>
            </div>

            {mainMode === "simple" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSimpleMode("melody")}
                  className={`px-3 py-1 text-sm rounded ${
                    simpleMode === "melody"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Melody (/)
                </button>
                <button
                  onClick={() => setSimpleMode("chord")}
                  className={`px-3 py-1 text-sm rounded ${
                    simpleMode === "chord"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Chord (/)
                </button>
              </div>
            )}
          </div>

          {mainMode === "simple" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700">Scale</h3>
              <div className="flex gap-2">
                <select
                  value={rootNote}
                  onChange={(e) => setRootNote(e.target.value)}
                  className="px-3 py-2 border rounded"
                >
                  {NOTE_NAMES.map((note) => (
                    <option key={note} value={note}>
                      {note}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setScale("major")}
                  className={`px-4 py-2 rounded ${
                    scale === "major"
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Major
                </button>
                <button
                  onClick={() => setScale("minor")}
                  className={`px-4 py-2 rounded ${
                    scale === "minor"
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Minor
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Controls</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Octave: {currentOctave}</span>
                <button
                  onClick={() =>
                    setCurrentOctave((prev) => Math.max(0, prev - 1))
                  }
                  className="px-2 py-1 bg-gray-200 rounded text-sm"
                >
                  Z (-)
                </button>
                <button
                  onClick={() =>
                    setCurrentOctave((prev) => Math.min(8, prev + 1))
                  }
                  className="px-2 py-1 bg-gray-200 rounded text-sm"
                >
                  X (+)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">
                  Velocity: {Math.round(velocity * 9)}
                </span>
                <input
                  type="range"
                  min="1"
                  max="9"
                  value={Math.round(velocity * 9)}
                  onChange={(e) => setVelocity(parseInt(e.target.value) / 9)}
                  className="w-20"
                />
              </div>

              <button
                onMouseDown={() => setSustain(true)}
                onMouseUp={() => {
                  setSustain(false);
                  stopSustainedNotes();
                }}
                className={`px-4 py-2 rounded ${
                  sustain ? "bg-yellow-500 text-white" : "bg-gray-200"
                }`}
              >
                Sustain (Space)
              </button>

              {mainMode === "simple" && simpleMode === "chord" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Voicing: {chordVoicing}</span>
                  <button
                    onClick={() =>
                      setChordVoicing((prev) => Math.max(-2, prev - 1))
                    }
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                  >
                    C (-)
                  </button>
                  <button
                    onClick={() =>
                      setChordVoicing((prev) => Math.min(2, prev + 1))
                    }
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                  >
                    V (+)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black p-4 rounded-lg shadow-2xl">
        {mainMode === "simple" && simpleMode === "chord" ? (
          <div className="space-y-4">
            {/* Chord Modifiers Display */}
            <div className="text-center">
              <p className="text-white text-sm mb-2">
                Chord Modifiers (hold while playing triads)
              </p>
              <div className="flex gap-2 justify-center mb-4">
                <div
                  className={`px-2 py-1 rounded text-xs ${
                    chordModifiers.has("i")
                      ? "bg-yellow-500 text-black"
                      : "bg-gray-600 text-gray-300"
                  }`}
                >
                  I (dom7)
                </div>
                <div
                  className={`px-2 py-1 rounded text-xs ${
                    chordModifiers.has("o")
                      ? "bg-yellow-500 text-black"
                      : "bg-gray-600 text-gray-300"
                  }`}
                >
                  O (maj7)
                </div>
                <div
                  className={`px-2 py-1 rounded text-xs ${
                    chordModifiers.has("n")
                      ? "bg-green-500 text-black"
                      : "bg-gray-600 text-gray-300"
                  }`}
                >
                  N (sus2)
                </div>
                <div
                  className={`px-2 py-1 rounded text-xs ${
                    chordModifiers.has("m")
                      ? "bg-green-500 text-black"
                      : "bg-gray-600 text-gray-300"
                  }`}
                >
                  M (sus4)
                </div>
                <div
                  className={`px-2 py-1 rounded text-xs ${
                    chordModifiers.has(".")
                      ? "bg-blue-500 text-black"
                      : "bg-gray-600 text-gray-300"
                  }`}
                >
                  . (maj/min)
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-white text-sm mb-2">Triads (q,w,e,r,t,y,u)</p>
              <div className="flex gap-1">
                {chordTriadKeys.map((key, index) => {
                  const isPressed = pressedTriads.has(index);

                  // Generate chord name based on current modifiers
                  let chordSuffix = "";
                  if (chordModifiers.has("n")) chordSuffix += "sus2";
                  else if (chordModifiers.has("m")) chordSuffix += "sus4";
                  if (chordModifiers.has("i"))
                    chordSuffix += chordSuffix ? "+7" : "7";
                  else if (chordModifiers.has("o"))
                    chordSuffix += chordSuffix ? "+M7" : "M7";
                  if (chordModifiers.has("."))
                    chordSuffix = chordSuffix.includes("sus")
                      ? chordSuffix
                      : chordSuffix + (scale === "major" ? "m" : "M");

                  return (
                    <button
                      key={key}
                      onMouseDown={() => {
                        const chord = getChord(
                          rootNote,
                          scale,
                          index,
                          3,
                          chordVoicing,
                          chordModifiers
                        );
                        chord.forEach((note) =>
                          playNote(note, velocity, sustain)
                        );
                      }}
                      className={`w-12 h-20 border-2 border-gray-300 bg-purple-100 hover:bg-purple-200 
                              transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                              ${
                                isPressed
                                  ? "bg-purple-300 transform scale-95"
                                  : ""
                              }`}
                    >
                      <span className="text-xs text-purple-800 font-bold">
                        {key.toUpperCase()}
                      </span>
                      <div className="text-center">
                        <div className="text-xs text-purple-800">
                          {["I", "ii", "iii", "IV", "V", "vi", "vii"][index]}
                        </div>
                        {chordSuffix && (
                          <div className="text-xs text-purple-600 font-bold">
                            {chordSuffix}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-center">
              <p className="text-white text-sm mb-2">
                Root Notes (a,s,d,f,g,h,j)
              </p>
              <div className="flex gap-1">
                {virtualKeys.map((key) => (
                  <button
                    key={`${key.note}-${key.keyboardKey}`}
                    onMouseDown={() => handleVirtualKeyPress(key)}
                    className={`
                      w-12 h-20 border-2 border-gray-300 bg-white hover:bg-gray-100 
                      transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                      ${
                        pressedKeys.has(key.note)
                          ? "bg-gray-200 transform scale-95"
                          : ""
                      }
                    `}
                  >
                    <span className="text-xs text-gray-600 font-bold">
                      {key.keyboardKey?.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-600">{key.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : mainMode === "simple" ? (
          <div className="text-center">
            <p className="text-white text-sm mb-2">Scale Notes</p>
            <div className="space-y-2">
              {/* Upper row */}
              <div className="flex gap-1 justify-center">
                {virtualKeys
                  .filter((key) => key.position >= 100)
                  .map((key) => (
                    <button
                      key={`${key.note}-${key.keyboardKey}`}
                      onMouseDown={() => handleVirtualKeyPress(key)}
                      className={`
                      w-12 h-24 border-2 border-gray-300 bg-blue-50 hover:bg-blue-100 
                      transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                      ${
                        pressedKeys.has(key.note)
                          ? "bg-blue-200 transform scale-95"
                          : ""
                      }
                    `}
                    >
                      <span className="text-xs text-blue-800 font-bold">
                        {key.keyboardKey?.toUpperCase()}
                      </span>
                      <span className="text-xs text-blue-800">{key.note}</span>
                    </button>
                  ))}
              </div>

              {/* Lower row */}
              <div className="flex gap-1 justify-center">
                {virtualKeys
                  .filter((key) => key.position < 100)
                  .map((key) => (
                    <button
                      key={`${key.note}-${key.keyboardKey}`}
                      onMouseDown={() => handleVirtualKeyPress(key)}
                      className={`
                      w-12 h-32 border-2 border-gray-300 bg-white hover:bg-gray-100 
                      transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                      ${
                        pressedKeys.has(key.note)
                          ? "bg-gray-200 transform scale-95"
                          : ""
                      }
                    `}
                    >
                      <span className="text-xs text-gray-600 font-bold">
                        {key.keyboardKey?.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600">{key.note}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="relative flex">
              {virtualKeys
                .filter((key) => !key.isBlack)
                .map((key) => (
                  <button
                    key={`${key.note}-${key.keyboardKey}`}
                    onMouseDown={() => handleVirtualKeyPress(key)}
                    className={`
                    w-12 h-40 border-2 border-gray-300 bg-white hover:bg-gray-100 
                    transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                    ${
                      pressedKeys.has(key.note)
                        ? "bg-gray-200 transform scale-95"
                        : ""
                    }
                  `}
                    style={{ zIndex: 1 }}
                  >
                    <span className="text-xs text-gray-600 font-bold">
                      {key.keyboardKey?.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-600">{key.note}</span>
                  </button>
                ))}

              {virtualKeys
                .filter((key) => key.isBlack)
                .map((key) => (
                  <button
                    key={`${key.note}-${key.keyboardKey}`}
                    onMouseDown={() => handleVirtualKeyPress(key)}
                    className={`
                    absolute w-8 h-24 bg-black hover:bg-gray-800 border border-gray-600
                    transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                    ${
                      pressedKeys.has(key.note)
                        ? "bg-gray-600 transform scale-95"
                        : ""
                    }
                  `}
                    style={{
                      left: `${key.position * 48 - 16}px`,
                      zIndex: 2,
                    }}
                  >
                    <span className="text-xs text-white font-bold">
                      {key.keyboardKey?.toUpperCase()}
                    </span>
                    <span className="text-xs text-white">{key.note}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-center">
          <p className="text-white text-sm">
            {mainMode === "simple"
              ? simpleMode === "melody"
                ? "Play melody notes"
                : "Play root notes and chords"
              : "Play chromatic notes"}
          </p>
        </div>
      </div>
    </div>
  );
}
