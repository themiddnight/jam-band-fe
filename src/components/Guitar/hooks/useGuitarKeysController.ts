import { useCallback } from "react";
import { DEFAULT_GUITAR_SHORTCUTS } from "../../../constants/guitarShortcuts";
import type { Scale } from "../../../hooks/useScaleState";
import type { GuitarState } from "../types/guitar";

interface UseGuitarKeysControllerProps {
  guitarState: GuitarState;
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  guitarControls: {
    mode: string;
    setMode: (mode: 'basic' | 'simple-note' | 'simple-chord') => void;
    velocity: number;
    setVelocity: (velocity: number) => void;
    sustain: boolean;
    setSustain: (sustain: boolean) => void;
    sustainToggle: boolean;
    setSustainToggle: (sustainToggle: boolean) => void;
    currentOctave: number;
    setCurrentOctave: (octave: number) => void;
    chordVoicing: number;
    setChordVoicing: (voicing: number) => void;
    chordModifiers: Set<string>;
    setChordModifiers: (modifiers: Set<string>) => void;
    pressedNotes: Set<string>;
    setPressedNotes: (notes: Set<string>) => void;
    pressedChords: Set<number>;
    setPressedChords: (chords: Set<number>) => void;
    strumConfig: { speed: number; direction: 'up' | 'down'; isActive: boolean };
    setStrumSpeed: (speed: number) => void;
    setStrumDirection: (direction: 'up' | 'down') => void;
    playNote: (note: string, isKeyHeld?: boolean) => Promise<void>;
    stopNote: (note: string) => void;
    releaseKeyHeldNote: (note: string) => void;
    stopSustainedNotes: () => void;
    handleStrumChord: (chordIndex: number, direction: 'up' | 'down') => Promise<void>;
    handleChordRelease: (chordIndex: number) => void;
  };
}

export const useGuitarKeysController = ({
  guitarState,
  scaleState,
  guitarControls,
}: UseGuitarKeysControllerProps) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      // Prevent default for all guitar shortcuts
      if (Object.values(shortcuts).some(shortcut => shortcut.key.includes(key))) {
        event.preventDefault();
      }

      // Mode controls
      if (key === shortcuts.toggleNoteChord.key) {
        if (guitarState.mode.type === 'basic') {
          guitarControls.setMode('simple-note');
        } else if (guitarState.mode.type === 'simple-note') {
          guitarControls.setMode('simple-chord');
        } else {
          guitarControls.setMode('basic');
        }
        return;
      }

      // Basic mode - sustain and velocity shortcuts only
      if (guitarState.mode.type === 'basic') {
        // Velocity controls
        const velocityKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        if (velocityKeys.includes(key)) {
          const velocity = parseInt(key) / 9;
          guitarControls.setVelocity(velocity);
          return;
        }
        
        // Sustain controls
        if (key === shortcuts.sustain.key) {
          guitarControls.setSustain(true);
          return;
        }
        if (key === shortcuts.sustainToggle.key) {
          guitarControls.setSustainToggle(!guitarState.sustainToggle);
          return;
        }
        
        return;
      }

      // Simple - Note mode
      if (guitarState.mode.type === 'simple-note') {
        // Octave controls
        if (key === shortcuts.octaveDown.key) {
          guitarControls.setCurrentOctave(Math.max(0, guitarState.currentOctave - 1));
          return;
        }
        if (key === shortcuts.octaveUp.key) {
          guitarControls.setCurrentOctave(Math.min(8, guitarState.currentOctave + 1));
          return;
        }

        // Note keys (lower octave)
        const lowerOctaveKeys = shortcuts.lowerOctaveNotes.key.split('');
        if (lowerOctaveKeys.includes(key)) {
          const keyIndex = lowerOctaveKeys.indexOf(key);
          const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, guitarState.currentOctave);
          if (scaleNotes[keyIndex]) {
            const newPressedNotes = new Set(guitarState.pressedNotes);
            newPressedNotes.add(scaleNotes[keyIndex]);
            guitarControls.setPressedNotes(newPressedNotes);
          }
          return;
        }

        // Note keys (higher octave)
        const higherOctaveKeys = shortcuts.higherOctaveNotes.key.split('');
        if (higherOctaveKeys.includes(key)) {
          const keyIndex = higherOctaveKeys.indexOf(key);
          const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, guitarState.currentOctave + 1);
          if (scaleNotes[keyIndex]) {
            const newPressedNotes = new Set(guitarState.pressedNotes);
            newPressedNotes.add(scaleNotes[keyIndex]);
            guitarControls.setPressedNotes(newPressedNotes);
          }
          return;
        }

        // Play note
        if (key === ',' || key === '.') {
          // Play all pressed notes
          for (const note of guitarState.pressedNotes) {
            await guitarControls.playNote(note, true);
          }
          return;
        }

        // Velocity controls
        const velocityKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        if (velocityKeys.includes(key)) {
          const velocity = parseInt(key) / 9;
          guitarControls.setVelocity(velocity);
          return;
        }
      }

      // Simple - Chord mode
      if (guitarState.mode.type === 'simple-chord') {
        // Chord keys
        const chordKeys = shortcuts.chordNotes.key.split('');
        if (chordKeys.includes(key)) {
          const keyIndex = chordKeys.indexOf(key);
          const newPressedChords = new Set(guitarState.pressedChords);
          newPressedChords.add(keyIndex);
          guitarControls.setPressedChords(newPressedChords);
          return;
        }

        // Strum controls
        if (key === ',' || key === '.') {
          const direction = key === ',' ? 'down' : 'up';
          guitarControls.setStrumDirection(direction);
          // Play all pressed chords with strum effect
          for (const chordIndex of guitarState.pressedChords) {
            // Call the strum chord handler from guitar controls
            if (guitarControls.handleStrumChord) {
              await guitarControls.handleStrumChord(chordIndex, direction);
            }
          }
          return;
        }

        // Strum speed controls
        if (key === shortcuts.strumSpeedDown.key) {
          const currentSpeed = guitarState.strumConfig.speed;
          const newSpeed = Math.max(5, currentSpeed -150);
          guitarControls.setStrumSpeed(newSpeed);
          return;
        }
        if (key === shortcuts.strumSpeedUp.key) {
          const currentSpeed = guitarState.strumConfig.speed;
          const newSpeed = Math.min(100, currentSpeed + 10);
          guitarControls.setStrumSpeed(newSpeed);
          return;
        }

        // Voicing controls
        if (key === shortcuts.voicingDown.key) {
          guitarControls.setChordVoicing(Math.max(-2, guitarState.chordVoicing - 1));
          return;
        }
        if (key === shortcuts.voicingUp.key) {
          guitarControls.setChordVoicing(Math.min(4, guitarState.chordVoicing + 1));
          return;
        }

        // Chord modifiers
        if (key === shortcuts.dominant7.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add('dominant7');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.major7.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add('major7');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.sus2.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add('sus2');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.sus4.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add('sus4');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.majMinToggle.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add('majMinToggle');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }

        // Velocity controls
        const velocityKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        if (velocityKeys.includes(key)) {
          const velocity = parseInt(key) / 9;
          guitarControls.setVelocity(velocity);
          return;
        }
      }

      // Sustain controls (available in all modes)
      if (key === shortcuts.sustain.key) {
        guitarControls.setSustain(true);
        return;
      }
      if (key === shortcuts.sustainToggle.key) {
        guitarControls.setSustainToggle(!guitarState.sustainToggle);
        return;
      }
    },
    [guitarState, scaleState, guitarControls, shortcuts]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Basic mode - sustain release
      if (guitarState.mode.type === 'basic') {
        if (key === shortcuts.sustain.key) {
          guitarControls.setSustain(false);
          return;
        }
      }

      // Simple - Note mode
      if (guitarState.mode.type === 'simple-note') {
        // Note keys (lower octave)
        const lowerOctaveKeys = shortcuts.lowerOctaveNotes.key.split('');
        if (lowerOctaveKeys.includes(key)) {
          const keyIndex = lowerOctaveKeys.indexOf(key);
          const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, guitarState.currentOctave);
          if (scaleNotes[keyIndex]) {
            const newPressedNotes = new Set(guitarState.pressedNotes);
            newPressedNotes.delete(scaleNotes[keyIndex]);
            guitarControls.setPressedNotes(newPressedNotes);
            guitarControls.releaseKeyHeldNote(scaleNotes[keyIndex]);
          }
          return;
        }

        // Note keys (higher octave)
        const higherOctaveKeys = shortcuts.higherOctaveNotes.key.split('');
        if (higherOctaveKeys.includes(key)) {
          const keyIndex = higherOctaveKeys.indexOf(key);
          const scaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, guitarState.currentOctave + 1);
          if (scaleNotes[keyIndex]) {
            const newPressedNotes = new Set(guitarState.pressedNotes);
            newPressedNotes.delete(scaleNotes[keyIndex]);
            guitarControls.setPressedNotes(newPressedNotes);
            guitarControls.releaseKeyHeldNote(scaleNotes[keyIndex]);
          }
          return;
        }
      }

      // Simple - Chord mode
      if (guitarState.mode.type === 'simple-chord') {
        // Chord keys
        const chordKeys = shortcuts.chordNotes.key.split('');
        if (chordKeys.includes(key)) {
          const keyIndex = chordKeys.indexOf(key);
          const newPressedChords = new Set(guitarState.pressedChords);
          newPressedChords.delete(keyIndex);
          guitarControls.setPressedChords(newPressedChords);
          
          // Stop chord notes when key is released
          if (guitarControls.handleChordRelease) {
            guitarControls.handleChordRelease(keyIndex);
          }
          return;
        }

        // Chord modifiers
        if (key === shortcuts.dominant7.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete('dominant7');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.major7.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete('major7');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.sus2.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete('sus2');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.sus4.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete('sus4');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.majMinToggle.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete('majMinToggle');
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
      }

      // Sustain controls
      if (key === shortcuts.sustain.key) {
        guitarControls.setSustain(false);
        guitarControls.stopSustainedNotes();
        return;
      }
    },
    [guitarState, scaleState, guitarControls, shortcuts]
  );

  return { handleKeyDown, handleKeyUp };
}; 