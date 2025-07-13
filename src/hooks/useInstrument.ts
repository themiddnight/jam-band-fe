import { useState, useRef, useEffect, useCallback } from "react";
import Soundfont from "soundfont-player";
import { SOUNDFONT_INSTRUMENTS } from "../constants/instruments";
import { ControlType } from "../types";

export const useInstrument = (
  initialInstrument = "acoustic_grand_piano"
) => {
  const [instrument, setInstrument] = useState<any>(null);
  const [currentInstrument, setCurrentInstrument] =
    useState<string>(initialInstrument);
  const [sustain, setSustain] = useState<boolean>(false);
  const [isLoadingInstrument, setIsLoadingInstrument] =
    useState<boolean>(false);
  const audioContext = useRef<AudioContext | null>(null);
  const sustainedNotes = useRef<Set<any>>(new Set());
  const activeNotes = useRef<Map<string, any>>(new Map());
  const keyHeldNotes = useRef<Set<string>>(new Set());

  const loadInstrument = async (instrumentName: string) => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    if (audioContext.current.state === "suspended") {
      await audioContext.current.resume();
    }

    setIsLoadingInstrument(true);
    try {
      const newInstrument = await Soundfont.instrument(
        audioContext.current,
        instrumentName as any
      );
      setInstrument(newInstrument);
      setCurrentInstrument(instrumentName);
    } catch (error) {
      console.error("Failed to load instrument:", error);
    } finally {
      setIsLoadingInstrument(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  const playNotes = useCallback(
    (notes: string[], velocity: number, isKeyHeld: boolean = false) => {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }

      if (instrument && audioContext.current?.state === "running") {
        notes.forEach((note) => {
          const existingNote = activeNotes.current.get(note);
          if (existingNote && existingNote.stop) {
            existingNote.stop();
          }

          const playedNote = instrument.play(
            note,
            audioContext.current!.currentTime,
            { gain: velocity * 5 }
          );

          activeNotes.current.set(note, playedNote);

          if (isKeyHeld) {
            keyHeldNotes.current.add(note);
          }

          if (!isKeyHeld && sustain) {
            sustainedNotes.current.add(playedNote);
          }

          if (!isKeyHeld && !sustain) {
            setTimeout(() => {
              if (
                activeNotes.current.has(note) &&
                !keyHeldNotes.current.has(note)
              ) {
                if (playedNote && playedNote.stop) {
                  playedNote.stop();
                }
                activeNotes.current.delete(note);
              }
            }, 300);
          }
        });
      } else if (audioContext.current?.state === "suspended") {
        audioContext.current.resume();
      }
    },
    [instrument, audioContext, sustain]
  );

  const stopNotes = (notes: string[]) => {
    notes.forEach((note) => {
      const activeNote = activeNotes.current.get(note);
      if (activeNote && activeNote.stop) {
        activeNote.stop();
        activeNotes.current.delete(note);
        sustainedNotes.current.delete(activeNote);
      }
      keyHeldNotes.current.delete(note);
    });
  };

  const stopSustainedNotes = useCallback(() => {
    sustainedNotes.current.forEach((note) => {
      if (note && note.stop) {
        note.stop();
      }
    });
    sustainedNotes.current.clear();

    activeNotes.current.forEach((note, noteName) => {
      if (!keyHeldNotes.current.has(noteName) && note && note.stop) {
        note.stop();
      }
    });

    const notesToRemove: string[] = [];
    activeNotes.current.forEach((_note, noteName) => {
      if (!keyHeldNotes.current.has(noteName)) {
        notesToRemove.push(noteName);
      }
    });
    notesToRemove.forEach((noteName) => activeNotes.current.delete(noteName));
  }, []);

  const releaseKeyHeldNote = useCallback(
    (note: string) => {
      keyHeldNotes.current.delete(note);

      const activeNote = activeNotes.current.get(note);
      if (activeNote && activeNote.stop && !sustain) {
        activeNote.stop();
        activeNotes.current.delete(note);
      }
    },
    [sustain]
  );

  const setSustainState = useCallback(
    (newSustain: boolean) => {
      setSustain(newSustain);
      if (!newSustain) {
        stopSustainedNotes();
      }
    },
    [stopSustainedNotes]
  );

  const handleInstrumentChange = (instrumentName: string) => {
    loadInstrument(instrumentName);
  };

  const getCurrentInstrumentControlType = (): ControlType => {
    const instrumentData = SOUNDFONT_INSTRUMENTS.find(
      (inst) => inst.value === currentInstrument
    );
    return instrumentData?.controlType || ControlType.Keyboard;
  };

  const handleMidiNoteOn = useCallback(
    (note: number, velocity: number) => {
      if (audioContext.current?.state === "suspended") {
        audioContext.current.resume();
      }

      if (!instrument) {
        return;
      }

      const noteNames = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
      ];
      const octave = Math.floor(note / 12) - 1;
      const noteName = noteNames[note % 12];
      const noteString = `${noteName}${octave}`;

      playNotes([noteString], velocity, true);
    },
    [instrument, playNotes]
  );

  const handleMidiNoteOff = useCallback(
    (note: number) => {
      const noteNames = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
      ];
      const octave = Math.floor(note / 12) - 1;
      const noteName = noteNames[note % 12];
      const noteString = `${noteName}${octave}`;
      releaseKeyHeldNote(noteString);
    },
    [releaseKeyHeldNote]
  );

  const handleMidiControlChange = useCallback((controller: number) => {
    switch (controller) {
      case 1:
        break;
      case 7:
        break;
      case 10:
        break;
    }
  }, []);

  const handleMidiSustainChange = useCallback(
    (sustain: boolean) => {
      setSustainState(sustain);
    },
    [setSustainState]
  );

  return {
    instrument,
    currentInstrument,
    isLoadingInstrument,
    loadInstrument,
    playNotes,
    stopNotes,
    stopSustainedNotes,
    releaseKeyHeldNote,
    setSustainState,
    handleInstrumentChange,
    getCurrentInstrumentControlType,
    handleMidiNoteOn,
    handleMidiNoteOff,
    handleMidiControlChange,
    handleMidiSustainChange,
    audioContext: audioContext.current,
  };
}; 