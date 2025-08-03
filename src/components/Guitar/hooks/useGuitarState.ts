import { useState, useCallback, useRef } from "react";
import type { Scale } from "../../../hooks/useScaleState";
import type { GuitarState, StrumConfig, GuitarString, HammerOnState } from "../types/guitar";

interface UseGuitarStateProps {
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

export const useGuitarState = ({
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
  onSustainToggleChange,
}: UseGuitarStateProps) => {
  const [mode, setMode] = useState<'basic' | 'melody' | 'chord'>('basic');
  const [velocity, setVelocity] = useState(0.5);
  const [sustain, setSustain] = useState(false);
  const [sustainToggle, setSustainToggle] = useState(false);
  const [currentOctave, setCurrentOctave] = useState(3);
  const [chordVoicing, setChordVoicing] = useState(0);
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [pressedNotes, setPressedNotes] = useState<Set<string>>(new Set());
  const [pressedChords, setPressedChords] = useState<Set<number>>(new Set());
  const [strumConfig, setStrumConfig] = useState<StrumConfig>({
    speed: 5, // 5ms default
    direction: 'down',
    isActive: false,
  });

  // New state for string behavior
  const [strings, setStrings] = useState<{
    lower: GuitarString;
    higher: GuitarString;
  }>({
    lower: {
      id: 'lower',
      pressedNotes: new Set(),
      activeNote: null,
      lastPlayedNote: null,
      lastPlayTime: 0,
      isHammerOnEnabled: false,
    },
    higher: {
      id: 'higher',
      pressedNotes: new Set(),
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

  const handleSustainChange = useCallback((newSustain: boolean) => {
    setSustain(newSustain);
    onSustainChange(newSustain);
  }, [onSustainChange]);

  const handleSustainToggleChange = useCallback((newSustainToggle: boolean) => {
    setSustainToggle(newSustainToggle);
    onSustainToggleChange?.(newSustainToggle);
  }, [onSustainToggleChange]);

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

  const handleVelocityChange = useCallback((newVelocity: number) => {
    setVelocity(newVelocity);
  }, []);

  const handleOctaveChange = useCallback((newOctave: number) => {
    setCurrentOctave(newOctave);
  }, []);

  const handleChordVoicingChange = useCallback((newVoicing: number) => {
    setChordVoicing(newVoicing);
  }, []);

  const handleStrumSpeedChange = useCallback((newSpeed: number) => {
    setStrumConfig(prev => ({ ...prev, speed: newSpeed }));
  }, []);

  const handleStrumDirectionChange = useCallback((direction: 'up' | 'down') => {
    setStrumConfig(prev => ({ ...prev, direction }));
  }, []);

  const guitarState: GuitarState = {
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
    strings,
    hammerOnState,
  };

  return {
    guitarState,
    mode,
    setMode,
    velocity,
    setVelocity: handleVelocityChange,
    sustain,
    setSustain: handleSustainChange,
    sustainToggle,
    setSustainToggle: handleSustainToggleChange,
    currentOctave,
    setCurrentOctave: handleOctaveChange,
    chordVoicing,
    setChordVoicing: handleChordVoicingChange,
    chordModifiers,
    setChordModifiers,
    pressedNotes,
    setPressedNotes,
    pressedChords,
    setPressedChords,
    strumConfig,
    setStrumSpeed: handleStrumSpeedChange,
    setStrumDirection: handleStrumDirectionChange,
    playNote,
    stopNote,
    releaseKeyHeldNote,
    stopSustainedNotes,
    // New functions for string behavior
    handleNotePress,
    handleNoteRelease,
    handlePlayButtonPress,
    handleHammerOnPress,
  };
}; 