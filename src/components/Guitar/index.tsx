import { useGuitarKeysController } from "./hooks/useGuitarKeysController";
import { BasicFretboard } from "./components/BasicFretboard";
import { SimpleNoteKeys } from "./components/SimpleNoteKeys";
import { SimpleChordKeys } from "./components/SimpleChordKeys";
import { getChordFromDegree } from "../../utils/musicUtils";
import type { Scale } from "../../hooks/useScaleState";
import BaseInstrument from "../shared/BaseInstrument";
import { DEFAULT_GUITAR_SHORTCUTS } from "../../constants/guitarShortcuts";
import { getKeyDisplayName } from "../../constants/guitarShortcuts";
import { useGuitarStore } from "../../stores/guitarStore";
import { useInstrumentState } from "../../hooks/useInstrumentState";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { GuitarString, HammerOnState, StrumConfig } from "./types/guitar";

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

  // Use the unified instrument state hook
  const unifiedState = useInstrumentState({
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
    onSustainToggleChange,
  });

  // Use Zustand store for the specified states
  const {
    mode,
    setMode,
    velocity,
    setVelocity,
    currentOctave,
    setCurrentOctave,
    chordVoicing,
    setChordVoicing,
    brushingSpeed,
    setBrushingSpeed,
  } = useGuitarStore();

  // Wrapper function to handle type conversion for brushing speed
  const handleBrushingSpeedChange = (speed: number) => {
    setBrushingSpeed(speed as any);
  };

  // Local state for guitar-specific functionality
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [powerChordMode, setPowerChordMode] = useState(false);
  const [pressedNotes, setPressedNotes] = useState<Set<string>>(new Set());
  const [pressedChords, setPressedChords] = useState<Set<number>>(new Set());
  const [strumConfig, setStrumConfig] = useState<StrumConfig>({
    speed: brushingSpeed,
    direction: 'down',
    isActive: false,
  });

  // Update strumConfig when brushingSpeed changes
  useEffect(() => {
    setStrumConfig(prev => ({ ...prev, speed: brushingSpeed }));
  }, [brushingSpeed]);

  // New state for string behavior
  const [strings, setStrings] = useState<{
    lower: GuitarString;
    higher: GuitarString;
  }>({
    lower: {
      id: 'lower',
      pressedNotes: new Set<string>(),
      activeNote: null,
      lastPlayedNote: null,
      lastPlayTime: 0,
      isHammerOnEnabled: false,
    },
    higher: {
      id: 'higher',
      pressedNotes: new Set<string>(),
      activeNote: null,
      lastPlayedNote: null,
      lastPlayTime: 0,
      isHammerOnEnabled: false,
    },
  });

  const [hammerOnState] = useState<HammerOnState>({
    isEnabled: false,
    lastPlayTime: 0,
    lastPlayedNote: null,
    windowMs: 200,
  });

  // Ref to track current state for stable callbacks
  const stateRef = useRef({ strings, hammerOnState, velocity });
  stateRef.current = { strings, hammerOnState, velocity };

  // Helper function to get the highest note from a set of notes
  const getHighestNote = useCallback((notes: Set<string>): string | null => {
    if (notes.size === 0) return null;
    
    // Sort notes by pitch (higher note = higher pitch)
    const sortedNotes = Array.from(notes).sort((a, b) => {
      const noteA = a.replace(/\d/g, '');
      const noteB = b.replace(/\d/g, '');
      const octaveA = parseInt(a.replace(/\D/g, '') || '0');
      const octaveB = parseInt(b.replace(/\D/g, '') || '0');
      
      if (octaveA !== octaveB) return octaveB - octaveA; // Higher octave first
      
      // Note order: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
      const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const indexA = noteOrder.indexOf(noteA);
      const indexB = noteOrder.indexOf(noteB);
      
      return indexB - indexA; // Higher note first
    });
    
    return sortedNotes[0];
  }, []);

  // Helper function to check if hammer-on is valid
  const isHammerOnValid = useCallback((stringId: 'lower' | 'higher', note: string): boolean => {
    const currentTime = Date.now();
    const string = stateRef.current.strings[stringId];
    
    // Check if hammer-on window is still open (based on last play time)
    if (currentTime - string.lastPlayTime > stateRef.current.hammerOnState.windowMs) {
      return false;
    }
    
    // Must be enabled first by normal play or previous hammer-on
    if (!string.isHammerOnEnabled) {
      return false;
    }
    
    // Check if the note is different from the last played note
    if (string.lastPlayedNote === note) {
      return false;
    }
    
    // Allow hammer-on to any note (not just higher) for more flexibility
    // Hammer-on is valid as long as we're within the time window and it's a different note
    return true;
  }, []);

  const playNote = useCallback(async (note: string, customVelocity?: number, isHammerOn: boolean = false) => {
    const noteVelocity = customVelocity !== undefined ? customVelocity : velocity;
    const finalVelocity = isHammerOn ? noteVelocity * 0.7 : noteVelocity;
    await onPlayNotes([note], finalVelocity, true);
  }, [onPlayNotes, velocity]);

  const stopNote = useCallback((note: string) => {
    onStopNotes([note]);
  }, [onStopNotes]);

  const releaseKeyHeldNote = useCallback((note: string) => {
    onReleaseKeyHeldNote(note);
  }, [onReleaseKeyHeldNote]);

  const stopSustainedNotes = useCallback(() => {
    onStopSustainedNotes();
  }, [onStopSustainedNotes]);

  // New function to handle note press with string behavior
  const handleNotePress = useCallback((stringId: 'lower' | 'higher', note: string) => {
    setStrings(prevStrings => {
      const newStrings = { ...prevStrings };
      const string = { ...newStrings[stringId] };
      
      // Add note to pressed notes
      string.pressedNotes.add(note);
      
      // Get the highest note from pressed notes
      const highestNote = getHighestNote(string.pressedNotes);
      
      // If changing to a different highest note, stop the previous active note
      if (highestNote && highestNote !== string.activeNote) {
        if (string.activeNote) {
          stopNote(string.activeNote);
        }
        string.activeNote = highestNote;
      }
      
      newStrings[stringId] = string;
      return newStrings;
    });
  }, [getHighestNote, stopNote]);

  // New function to handle note release with string behavior
  const handleNoteRelease = useCallback((stringId: 'lower' | 'higher', note: string) => {
    const currentTime = Date.now();
    
    setStrings(prevStrings => {
      const newStrings = { ...prevStrings };
      const string = { ...newStrings[stringId] };
      
      // Remove note from pressed notes
      string.pressedNotes.delete(note);
      
      // Get the highest remaining note
      const highestNote = getHighestNote(string.pressedNotes);
      
      // Check if this is a pull-off: 
      // - Hammer-on enabled
      // - Within time window
      // - The released note was the currently active note (higher note being lifted)
      // - There's a lower note still pressed
      const isPullOff = string.isHammerOnEnabled && 
                       currentTime - string.lastPlayTime <= hammerOnState.windowMs &&
                       string.activeNote === note && // The released note was the active note
                       highestNote && // There's still a note pressed
                       highestNote !== note; // And it's different from the released note
      
      if (isPullOff) {
        // Pull-off: stop current note and play the lower remaining note with 70% velocity
        if (string.activeNote) {
          stopNote(string.activeNote);
        }
        playNote(highestNote, velocity * 0.7, true);
        string.activeNote = highestNote;
        string.lastPlayedNote = highestNote;
        string.lastPlayTime = currentTime; // Reset timer for chaining
        string.isHammerOnEnabled = true; // Keep hammer-on enabled for chaining
      } else if (string.activeNote === note) {
        // The released note was the active note - stop it
        stopNote(string.activeNote);
        if (highestNote) {
          // There's still a note pressed, make it active but don't play it
          string.activeNote = highestNote;
        } else {
          // No notes pressed, clear active state
          string.activeNote = null;
          string.isHammerOnEnabled = false;
        }
      } else if (highestNote && highestNote !== string.activeNote) {
        // Normal note change: update active note but don't play it
        string.activeNote = highestNote;
      } else if (!highestNote) {
        // No notes pressed, stop current note and clear state
        if (string.activeNote) {
          stopNote(string.activeNote);
          string.activeNote = null;
        }
        string.isHammerOnEnabled = false;
      }
      
      newStrings[stringId] = string;
      return newStrings;
    });
  }, [getHighestNote, playNote, stopNote, velocity, hammerOnState.windowMs]);

  // New function to handle play button press
  const handlePlayButtonPress = useCallback((stringId: 'lower' | 'higher', customVelocity?: number) => {
    const currentTime = Date.now();
    
    // Get current state to check what needs to be stopped
    const currentStrings = stateRef.current.strings;
    const currentString = currentStrings[stringId];
    const currentActiveNote = currentString?.activeNote;
    
    // Stop the current active note first (outside state update)
    if (currentActiveNote) {
      stopNote(currentActiveNote);
    }
    
    setStrings(prevStrings => {
      const newStrings = { ...prevStrings };
      const string = { ...newStrings[stringId] };
      
      const highestNote = getHighestNote(string.pressedNotes);
      
      if (highestNote) {
        // Always play the highest note when play button is pressed (this is normal play)
        // Only prevent if it's exactly the same note played within a very short time (to prevent rapid clicking)
        const timeSinceLastPlay = currentTime - string.lastPlayTime;
        const shouldPlay = string.lastPlayedNote !== highestNote || timeSinceLastPlay > 50; // 50ms debounce
        
        if (shouldPlay) {
          const finalVelocity = customVelocity !== undefined ? customVelocity : velocity;
          // Play the note after state update
          setTimeout(() => {
            playNote(highestNote, finalVelocity, false);
          }, 0);
        }
        
        string.activeNote = highestNote;
        string.lastPlayedNote = highestNote;
        string.lastPlayTime = currentTime;
        string.isHammerOnEnabled = true; // Enable hammer-on after normal play
      }
      
      newStrings[stringId] = string;
      return newStrings;
    });
  }, [getHighestNote, playNote, stopNote, velocity]);

  // New function to handle hammer-on note press (called after normal play)
  const handleHammerOnPress = useCallback((stringId: 'lower' | 'higher', note: string) => {
    const currentTime = Date.now();
    
    setStrings(prevStrings => {
      const newStrings = { ...prevStrings };
      const string = { ...newStrings[stringId] };
      
      // Check if hammer-on is valid based on timing, not on key being held
      const isHammerOn = isHammerOnValid(stringId, note);
      
      if (isHammerOn) {
        // Hammer-on: stop previous note and play new note with 70% velocity
        if (string.activeNote && string.activeNote !== note) {
          stopNote(string.activeNote);
        }
        playNote(note, velocity * 0.7, true);
        string.activeNote = note;
        string.lastPlayedNote = note;
        string.lastPlayTime = currentTime; // Reset timer for chaining
        string.isHammerOnEnabled = true; // Keep enabled for chaining
        
        // Also add to pressed notes if not already there
        string.pressedNotes.add(note);
      } else {
        // Not a valid hammer-on, just update pressed notes
        string.pressedNotes.add(note);
        const highestNote = getHighestNote(string.pressedNotes);
        if (highestNote && highestNote !== string.activeNote) {
          string.activeNote = highestNote;
        }
      }
      
      newStrings[stringId] = string;
      return newStrings;
    });
  }, [isHammerOnValid, playNote, stopNote, velocity, getHighestNote]);

  // Convert shortcut keys to modifier names for chord generation
  const convertChordModifiers = (modifiers: Set<string>): Set<string> => {
    const convertedModifiers = new Set<string>();
    
    if (modifiers.has('q')) {
      convertedModifiers.add("dominant7");
    }
    if (modifiers.has('w')) {
      convertedModifiers.add("major7");
    }
    if (modifiers.has('e')) {
      convertedModifiers.add("sus2");
    }
    if (modifiers.has('r')) {
      convertedModifiers.add("sus4");
    }
    if (modifiers.has('t')) {
      convertedModifiers.add("majMinToggle");
    }
    if (powerChordMode) {
      convertedModifiers.add("powerChordToggle");
    }
    
    return convertedModifiers;
  };

  // Handle strum chord for simple chord mode with proper timing
  const handleStrumChord = async (chordIndex: number, direction: 'up' | 'down') => {
    // Generate chord notes
    let chordNotes = getChordFromDegree(
      scaleState.rootNote,
      scaleState.scale,
      chordIndex,
      chordVoicing,
      convertChordModifiers(chordModifiers)
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
  const handleBasicFretPress = async () => {
    // This is now handled by useUnifiedInstrumentState
  };

  const handleBasicFretRelease = () => {
    // This is now handled by useUnifiedInstrumentState
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
    
    // Stop chord notes when releasing chord button
    let chordNotes = getChordFromDegree(
      scaleState.rootNote,
      scaleState.scale,
      chordIndex,
      chordVoicing,
      convertChordModifiers(chordModifiers)
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
    }
    
    for (const note of chordNotes) {
      onReleaseKeyHeldNote(note);
    }
  };

  // Create a guitar state object that matches the interface expected by useGuitarKeysController
  const guitarState = {
    mode: { type: mode, description: mode },
    velocity,
    sustain: unifiedState.sustain,
    sustainToggle: unifiedState.sustainToggle,
    currentOctave,
    chordVoicing,
    chordModifiers,
    powerChordMode,
    pressedNotes,
    pressedChords,
    strumConfig,
    // Include the new string state
    strings,
    hammerOnState,
  };

  // Create guitar controls object
  const guitarControls = {
    mode: guitarState.mode.type,
    setMode,
    velocity,
    setVelocity,
    sustain: unifiedState.sustain,
    setSustain: unifiedState.setSustain,
    sustainToggle: unifiedState.sustainToggle,
    setSustainToggle: unifiedState.setSustainToggle,
    currentOctave,
    setCurrentOctave,
    chordVoicing,
    setChordVoicing,
    chordModifiers,
    setChordModifiers,
    powerChordMode,
    setPowerChordMode,
    pressedNotes,
    setPressedNotes,
    pressedChords,
    setPressedChords,
    strumConfig,
    setStrumSpeed: handleBrushingSpeedChange,
    setStrumDirection: (direction: 'up' | 'down') => setStrumConfig(prev => ({ ...prev, direction })),
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

  // Get shortcuts
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  // Check if there are sustained notes
  const hasSustainedNotes = false; // Guitar doesn't use sustained notes in the same way as keyboard

  // Convert pressedKeys to pressedFrets format for BasicFretboard
  const pressedFrets = useMemo(() => {
    const fretSet = new Set<string>();
    unifiedState.pressedKeys.forEach(key => {
      // Convert note to fret format if needed
      // For now, we'll use the key as-is since BasicFretboard expects string-fret format
      fretSet.add(key);
    });
    return fretSet;
  }, [unifiedState.pressedKeys]);

  const renderGuitarMode = () => {
    switch (mode) {
      case 'basic':
        return (
          <BasicFretboard
            scaleState={scaleState}
            velocity={velocity}
            sustain={unifiedState.sustain}
            sustainToggle={unifiedState.sustainToggle}
            pressedFrets={pressedFrets}
            onFretPress={handleBasicFretPress}
            onFretRelease={handleBasicFretRelease}
            onVelocityChange={setVelocity}
            onPlayNote={handleBasicPlayNote}
            onReleaseNote={handleBasicReleaseNote}
          />
        );
      case 'melody':
        return (
          <SimpleNoteKeys
            scaleState={scaleState}
            currentOctave={currentOctave}
            velocity={velocity}
            // Pass the new string-based functions
            handleNotePress={handleNotePress}
            handleNoteRelease={handleNoteRelease}
            handlePlayButtonPress={handlePlayButtonPress}
            handleHammerOnPress={handleHammerOnPress}
            guitarState={{
              mode: { type: mode, description: mode },
              velocity,
              sustain: unifiedState.sustain,
              sustainToggle: unifiedState.sustainToggle,
              currentOctave,
              chordVoicing,
              chordModifiers,
              powerChordMode,
              pressedNotes,
              pressedChords,
              strumConfig,
              strings,
              hammerOnState,
            }}
          />
        );
      case 'chord':
        return (
          <SimpleChordKeys
            scaleState={scaleState}
            chordVoicing={chordVoicing}
            pressedChords={pressedChords}
            chordModifiers={chordModifiers}
            powerChordMode={powerChordMode}
            onChordPress={handleChordPress}
            onChordRelease={handleChordRelease}
            onStrumChord={handleStrumChord}
            onChordModifierChange={setChordModifiers}
            onPowerChordModeChange={setPowerChordMode}
          />
        );
      default:
        return null;
    }
  };

  // Mode controls JSX
  const modeControls = (
    <div className="block join">
      <button
        onClick={() => setMode('melody')}
        className={`btn btn-sm join-item touch-manipulation ${mode === 'melody' ? 'btn-primary' : 'btn-outline'}`}
      >
        Melody{" "}
        <kbd className="kbd kbd-xs">
          {getKeyDisplayName(shortcuts.toggleMode.key)}
        </kbd>
      </button>
      <button
        onClick={() => setMode('chord')}
        className={`btn btn-sm join-item touch-manipulation ${mode === 'chord' ? 'btn-primary' : 'btn-outline'}`}
      >
        Chord{" "}
        <kbd className="kbd kbd-xs">
          {getKeyDisplayName(shortcuts.toggleMode.key)}
        </kbd>
      </button>
      <button
        onClick={() => setMode('basic')}
        className={`btn btn-sm join-item touch-manipulation ${mode === 'basic' ? 'btn-primary' : 'btn-outline'}`}
      >
        Basic
      </button>
    </div>
  );

  // Get control configuration based on mode
  const getControlConfig = () => {
    switch (mode) {
      case 'basic':
        return {
          velocity: true,
          sustain: true,
        };
      case 'melody':
        return {
          velocity: true,
          octave: true,
        };
      case 'chord':
        return {
          velocity: true,
          chordVoicing: true,
          brushingSpeed: true,
        };
      default:
        return {};
    }
  };

  return (
    <BaseInstrument
      title="Guitar"
      shortcuts={shortcuts}
      modeControls={modeControls}
      controlConfig={getControlConfig()}
      velocity={velocity}
      setVelocity={setVelocity}
      currentOctave={currentOctave}
      setCurrentOctave={setCurrentOctave}
      sustain={unifiedState.sustain}
      setSustain={unifiedState.setSustain}
      sustainToggle={unifiedState.sustainToggle}
      setSustainToggle={unifiedState.setSustainToggle}
      onStopSustainedNotes={stopSustainedNotes}
      hasSustainedNotes={hasSustainedNotes}
      chordVoicing={chordVoicing}
      setChordVoicing={setChordVoicing}
      brushingSpeed={brushingSpeed}
      setBrushingSpeed={handleBrushingSpeedChange}
      handleKeyDown={handleKeyDown}
      handleKeyUp={handleKeyUp}
    >
      {renderGuitarMode()}
    </BaseInstrument>
  );
} 