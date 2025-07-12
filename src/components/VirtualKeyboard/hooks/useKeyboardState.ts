import { useState, useRef, useEffect } from "react";
import Soundfont from "soundfont-player";
import type { MainMode, SimpleMode } from "../types/keyboard";

export const useKeyboardState = () => {
  const [instrument, setInstrument] = useState<any>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [heldKeys, setHeldKeys] = useState<Set<string>>(new Set());
  const [mainMode, setMainMode] = useState<MainMode>("simple");
  const [simpleMode, setSimpleMode] = useState<SimpleMode>("melody");
  const [velocity, setVelocity] = useState<number>(0.7);
  const [sustain, setSustain] = useState<boolean>(false);
  const [currentOctave, setCurrentOctave] = useState<number>(4);

  const audioContext = useRef<AudioContext | null>(null);
  const sustainedNotes = useRef<Set<any>>(new Set());
  const activeNotes = useRef<Map<string, any>>(new Map());
  const keyHeldNotes = useRef<Set<string>>(new Set());

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        audioContext.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        const keyboard = await Soundfont.instrument(
          audioContext.current,
          "acoustic_grand_piano",
        );
        setInstrument(keyboard);
      } catch (error) {
        console.error("Failed to load keyboard instrument:", error);
      }
    };

    initializeAudio();

    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  const playNote = (note: string, vel: number = velocity, isKeyHeld: boolean = false) => {
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

      if (isKeyHeld) {
        keyHeldNotes.current.add(note);
      } else if (sustain) {
        sustainedNotes.current.add(playedNote);
      }

      setPressedKeys((prev) => new Set(prev).add(note));

      if (!sustain && !isKeyHeld) {
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
  };

  const stopNote = (note: string) => {
    // Don't stop if the note is being held by a key
    if (keyHeldNotes.current.has(note)) {
      return;
    }

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
  };

  const releaseKeyHeldNote = (note: string) => {
    keyHeldNotes.current.delete(note);
    
    // If sustain is not active, stop the note
    if (!sustain) {
      const activeNote = activeNotes.current.get(note);
      if (activeNote && activeNote.stop) {
        activeNote.stop();
        activeNotes.current.delete(note);
      }
      
      setPressedKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(note);
        return newSet;
      });
    }
  };

  const stopSustainedNotes = () => {
    // Only stop notes that are not being held by keys
    sustainedNotes.current.forEach((note) => {
      if (note && note.stop) note.stop();
    });
    sustainedNotes.current.clear();

    activeNotes.current.forEach((note, noteName) => {
      if (!keyHeldNotes.current.has(noteName) && note && note.stop) {
        note.stop();
      }
    });
    
    // Remove from activeNotes only those not held by keys
    const notesToRemove: string[] = [];
    activeNotes.current.forEach((_note, noteName) => {
      if (!keyHeldNotes.current.has(noteName)) {
        notesToRemove.push(noteName);
      }
    });
    notesToRemove.forEach(noteName => activeNotes.current.delete(noteName));

    // Update pressed keys, keeping only key-held notes
    setPressedKeys(new Set(keyHeldNotes.current));
  };

  return {
    // State
    instrument,
    pressedKeys,
    setPressedKeys,
    heldKeys,
    setHeldKeys,
    mainMode,
    setMainMode,
    simpleMode,
    setSimpleMode,
    velocity,
    setVelocity,
    sustain,
    setSustain,
    currentOctave,
    setCurrentOctave,
    
    // Refs
    audioContext,
    sustainedNotes,
    activeNotes,
    
    // Functions
    playNote,
    stopNote,
    releaseKeyHeldNote,
    stopSustainedNotes,
  };
};
