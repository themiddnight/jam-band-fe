import { useState, useRef, useEffect } from "react";
import Soundfont from "soundfont-player";
import VirtualKeyboard from "./components/VirtualKeyboard";
import ScaleSelector from "./components/ScaleSelector";
import { useScaleState } from "./hooks/useScaleState";

export default function App() {
  const [instrument, setInstrument] = useState<any>(null);
  const [sustain, setSustain] = useState<boolean>(false);
  const audioContext = useRef<AudioContext | null>(null);
  const sustainedNotes = useRef<Set<any>>(new Set());
  const activeNotes = useRef<Map<string, any>>(new Map());
  const keyHeldNotes = useRef<Set<string>>(new Set());

  const scaleState = useScaleState();

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

  const playNotes = (notes: string[], velocity: number, isKeyHeld: boolean = false) => {
    if (instrument && audioContext.current?.state === "running") {
      notes.forEach((note) => {
        const existingNote = activeNotes.current.get(note);
        if (existingNote && existingNote.stop) {
          existingNote.stop();
        }

        const playedNote = instrument.play(
          note,
          audioContext.current!.currentTime,
          { gain: velocity }
        );

        activeNotes.current.set(note, playedNote);

        // Track key-held notes (highest priority)
        if (isKeyHeld) {
          keyHeldNotes.current.add(note);
        }

        // Only add to sustained notes if NOT held by a key AND sustain is active
        if (!isKeyHeld && sustain) {
          sustainedNotes.current.add(playedNote);
        }

        // Only auto-stop notes that are not held by keys and not sustained
        if (!isKeyHeld && !sustain) {
          setTimeout(() => {
            // Only stop if the note is still active and not being held
            if (activeNotes.current.has(note) && !keyHeldNotes.current.has(note)) {
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
  };

  const stopNotes = (notes: string[]) => {
    notes.forEach((note) => {
      const activeNote = activeNotes.current.get(note);
      if (activeNote && activeNote.stop) {
        activeNote.stop();
        activeNotes.current.delete(note);
        sustainedNotes.current.delete(activeNote);
      }
      // Remove from key-held notes
      keyHeldNotes.current.delete(note);
    });
  };

  const stopSustainedNotes = () => {
    // Stop all sustained notes (only those not held by keys)
    sustainedNotes.current.forEach((note) => {
      if (note && note.stop) {
        note.stop();
      }
    });
    sustainedNotes.current.clear();

    // Stop all notes that are not being held by keys
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
  };

  const releaseKeyHeldNote = (note: string) => {
    keyHeldNotes.current.delete(note);
    
    // If the note is not being sustained, stop it
    const activeNote = activeNotes.current.get(note);
    if (activeNote && activeNote.stop && !sustain) {
      activeNote.stop();
      activeNotes.current.delete(note);
    }
  };

  const setSustainState = (newSustain: boolean) => {
    setSustain(newSustain);
    if (!newSustain) {
      stopSustainedNotes();
    }
  };

  return (
    <div className="flex flex-col items-center p-8 bg-gray-100 min-h-screen">
      <ScaleSelector
        rootNote={scaleState.rootNote}
        scale={scaleState.scale}
        onRootNoteChange={scaleState.setRootNote}
        onScaleChange={scaleState.setScale}
      />

      <VirtualKeyboard
        scaleState={{
          rootNote: scaleState.rootNote,
          scale: scaleState.scale,
          getScaleNotes: scaleState.getScaleNotes,
        }}
        onPlayNotes={playNotes}
        onStopNotes={stopNotes}
        onStopSustainedNotes={stopSustainedNotes}
        onReleaseKeyHeldNote={releaseKeyHeldNote}
        onSustainChange={setSustainState}
      />
    </div>
  );
}
