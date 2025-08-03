import { useEffect } from "react";
import { useGuitarState } from "./hooks/useGuitarState";
import { useGuitarKeysController } from "./hooks/useGuitarKeysController";
import { useInstrumentState } from "../../hooks/useInstrumentState";
import { BasicFretboard } from "./components/BasicFretboard";
import { SimpleNoteKeys } from "./components/SimpleNoteKeys";
import { SimpleChordKeys } from "./components/SimpleChordKeys";
import { getChordFromDegree } from "../../utils/musicUtils";
import type { Scale } from "../../hooks/useScaleState";

export interface GuitarProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onStopSustainedNotes: () => void;
  onReleaseKeyHeldNote: (note: string) => void;
  onSustainChange: (sustain: boolean) => void;
  onSustainToggleChange?: (sustainToggle: boolean) => void;
}

export default function Guitar({
  scaleState,
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
  onSustainToggleChange,
}: GuitarProps) {

  // Use the guitar state hook
  const guitarStateData = useGuitarState({
    scaleState,
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
    onSustainToggleChange,
  });

  const {
    mode,
    setMode,
    velocity,
    setVelocity,
    sustain,
    setSustain,
    sustainToggle,
    setSustainToggle,
    currentOctave,
    setCurrentOctave,
    chordVoicing,
    setChordVoicing,
    chordModifiers,
    setChordModifiers,
    pressedNotes,
    setPressedNotes,
    pressedChords,
    setPressedChords,
    strumConfig,
    setStrumSpeed,
    setStrumDirection,
    releaseKeyHeldNote,
    stopSustainedNotes,
    // New string-based functions
    handleNotePress,
    handleNoteRelease,
    handlePlayButtonPress,
    handleHammerOnPress,
  } = guitarStateData;

  // Use instrument state for fretboard functionality
  const {
    pressedFrets,
    handleFretPress,
    handleFretRelease,
  } = useInstrumentState();

  // Handle strum chord for simple chord mode with proper timing
  const handleStrumChord = async (chordIndex: number, direction: 'up' | 'down') => {
    // Generate 5-note chord: root note starting from E2 + 4 chord notes
    let chordNotes = getChordFromDegree(
      scaleState.rootNote,
      scaleState.scale,
      chordIndex,
      chordVoicing,
      chordModifiers
    );
    
    // Ensure we have exactly 5 notes by adding additional chord tones if needed
    if (chordNotes.length < 5) {
      // Add octave variations of existing chord tones
      const baseChordNotes = [...chordNotes];
      for (let i = 0; i < baseChordNotes.length && chordNotes.length < 5; i++) {
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
      const noteOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      return noteOrder.indexOf(noteA) - noteOrder.indexOf(noteB);
    });
    
    // Play notes with strum timing - up strum plays high to low (like real guitar)
    const noteOrder = direction === 'up' ? [...chordNotes].reverse() : chordNotes;
    
    // Use 70% velocity for strum up (,) button
    const strumVelocity = direction === 'up' ? velocity * 0.7 : velocity;
    
    for (let i = 0; i < noteOrder.length; i++) {
      setTimeout(async () => {
        await onPlayNotes([noteOrder[i]], strumVelocity, true);
      }, i * strumConfig.speed);
    }
  };

  // Handle fret press/release for basic mode
  const handleBasicFretPress = async (stringIndex: number, fret: number) => {
    handleFretPress(stringIndex, fret);
  };

  const handleBasicFretRelease = (stringIndex: number, fret: number) => {
    handleFretRelease(stringIndex, fret);
  };

  const handleBasicPlayNote = async (note: string, customVelocity?: number) => {
    const noteVelocity = customVelocity !== undefined ? customVelocity : velocity;
    await onPlayNotes([note], noteVelocity, true);
  };

  const handleBasicReleaseNote = (note: string) => {
    onReleaseKeyHeldNote(note);
  };

  // Handle chord press/release for simple chord mode
  const handleChordPress = (chordIndex: number) => {
    const newPressedChords = new Set(pressedChords);
    newPressedChords.add(chordIndex);
    setPressedChords(newPressedChords);
  };

  const handleChordRelease = (chordIndex: number) => {
    const newPressedChords = new Set(pressedChords);
    newPressedChords.delete(chordIndex);
    setPressedChords(newPressedChords);
    
    // Stop chord notes when releasing chord button - same 5-note logic as strum
    let chordNotes = getChordFromDegree(
      scaleState.rootNote,
      scaleState.scale,
      chordIndex,
      chordVoicing,
      chordModifiers
    );
    
    // Ensure we have exactly 5 notes by adding additional chord tones if needed
    if (chordNotes.length < 5) {
      // Add octave variations of existing chord tones
      const baseChordNotes = [...chordNotes];
      for (let i = 0; i < baseChordNotes.length && chordNotes.length < 5; i++) {
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
    
    for (const note of chordNotes) {
      onReleaseKeyHeldNote(note);
    }
  };

  // Create a guitar state object that matches the interface expected by useGuitarKeysController
  const guitarState = {
    mode: { type: mode, description: mode },
    velocity,
    sustain,
    sustainToggle,
    currentOctave,
    chordVoicing,
    chordModifiers,
    pressedNotes,
    pressedChords,
    strumConfig,
    // Include the new string state
    strings: guitarStateData.guitarState.strings,
    hammerOnState: guitarStateData.guitarState.hammerOnState,
  };

  // Create guitar controls object
  const guitarControls = {
    mode: guitarState.mode.type,
    setMode: (mode: 'basic' | 'melody' | 'chord') => {
      setMode(mode);
    },
    velocity,
    setVelocity,
    sustain,
    setSustain,
    sustainToggle,
    setSustainToggle,
    currentOctave,
    setCurrentOctave,
    chordVoicing,
    setChordVoicing,
    chordModifiers,
    setChordModifiers,
    pressedNotes,
    setPressedNotes,
    pressedChords,
    setPressedChords,
    strumConfig,
    setStrumSpeed,
    setStrumDirection,
    playNote: handleBasicPlayNote,
    stopNote: handleBasicReleaseNote,
    releaseKeyHeldNote,
    stopSustainedNotes,
    handleStrumChord,
    handleChordRelease,
    // New string-based functions
    handleNotePress,
    handleNoteRelease,
    handlePlayButtonPress,
    handleHammerOnPress,
  };

  const { handleKeyDown, handleKeyUp } = useGuitarKeysController({
    guitarState,
    scaleState,
    guitarControls,
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const renderGuitarMode = () => {
    switch (mode) {
      case 'basic':
        return (
          <BasicFretboard
            scaleState={scaleState}
            velocity={velocity}
            sustain={sustain}
            sustainToggle={sustainToggle}
            pressedFrets={pressedFrets}
            onFretPress={handleBasicFretPress}
            onFretRelease={handleBasicFretRelease}
            onVelocityChange={setVelocity}
            onSustainChange={setSustain}
            onSustainToggleChange={setSustainToggle}
            onPlayNote={handleBasicPlayNote}
            onReleaseNote={handleBasicReleaseNote}
            onStopSustainedNotes={stopSustainedNotes}
          />
        );
      case 'melody':
        return (
          <SimpleNoteKeys
            scaleState={scaleState}
            currentOctave={currentOctave}
            velocity={velocity}
            onOctaveChange={setCurrentOctave}
            onVelocityChange={setVelocity}
            // Pass the new string-based functions
            handleNotePress={handleNotePress}
            handleNoteRelease={handleNoteRelease}
            handlePlayButtonPress={handlePlayButtonPress}
            handleHammerOnPress={handleHammerOnPress}
            guitarState={guitarStateData.guitarState}
          />
        );
      case 'chord':
        return (
          <SimpleChordKeys
            scaleState={scaleState}
            chordVoicing={chordVoicing}
            velocity={velocity}
            pressedChords={pressedChords}
            chordModifiers={chordModifiers}
            strumConfig={strumConfig}
            onChordPress={handleChordPress}
            onChordRelease={handleChordRelease}
            onStrumChord={handleStrumChord}
            onChordVoicingChange={setChordVoicing}
            onVelocityChange={setVelocity}
            onStrumSpeedChange={setStrumSpeed}
            onChordModifierChange={setChordModifiers}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body p-3">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <h3 className="card-title text-base">Guitar Controls</h3>
          </div>

          <div className="flex gap-3 flex-wrap justify-end">
            <div className="block join">
              <button
                onClick={() => setMode('basic')}
                className={`btn btn-sm join-item touch-manipulation ${mode === 'basic' ? 'btn-primary' : 'btn-outline'}`}
              >
                Basic
              </button>
              <button
                onClick={() => setMode('melody')}
                className={`btn btn-sm join-item touch-manipulation ${mode === 'melody' ? 'btn-primary' : 'btn-outline'}`}
              >
                Melody
              </button>
              <button
                onClick={() => setMode('chord')}
                className={`btn btn-sm join-item touch-manipulation ${mode === 'chord' ? 'btn-primary' : 'btn-outline'}`}
              >
                Chord
              </button>
            </div>
          </div>
        </div>

        {renderGuitarMode()}
      </div>
    </div>
  );
} 