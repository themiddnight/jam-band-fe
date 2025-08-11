import {
  DEFAULT_GUITAR_SHORTCUTS,
  GUITAR_PLAY_BUTTONS,
} from "../../../constants/guitarShortcuts";
import type { Scale } from "../../../hooks/useScaleState";
import { useVelocityControl } from "../../../hooks/useVelocityControl";
import { useGuitarStore } from "../../../stores/guitarStore";
import type { GuitarState } from "../types/guitar";
import { useCallback } from "react";

interface UseGuitarKeysControllerProps {
  guitarState: GuitarState;
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  guitarControls: {
    mode: string;
    setMode: (mode: "basic" | "melody" | "chord") => void;
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
    powerChordMode: boolean;
    setPowerChordMode: (powerChordMode: boolean) => void;
    pressedNotes: Set<string>;
    setPressedNotes: (notes: Set<string>) => void;
    pressedChords: Set<number>;
    setPressedChords: (chords: Set<number>) => void;
    strumConfig: { speed: number; direction: "up" | "down"; isActive: boolean };
    setStrumDirection: (direction: "up" | "down") => void;
    playNote: (note: string, velocity?: number) => Promise<void>;
    stopNote: (note: string) => void;
    releaseKeyHeldNote: (note: string) => void;
    stopSustainedNotes: () => void;
    handleStrumChord: (
      chordIndex: number,
      direction: "up" | "down",
    ) => Promise<void>;
    handleChordPress: (chordIndex: number) => void;
    handleChordRelease: (chordIndex: number) => void;
    // New functions for string behavior
    handleNotePress: (stringId: "lower" | "higher", note: string) => void;
    handleNoteRelease: (stringId: "lower" | "higher", note: string) => void;
    handlePlayButtonPress: (
      stringId: "lower" | "higher",
      customVelocity?: number,
    ) => void;
    handleHammerOnPress: (stringId: "lower" | "higher", note: string) => void;
  };
}

export const useGuitarKeysController = ({
  guitarState,
  scaleState,
  guitarControls,
}: UseGuitarKeysControllerProps) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;
  const { handleVelocityChange } = useVelocityControl({
    velocity: guitarControls.velocity,
    setVelocity: guitarControls.setVelocity,
  });

  // Get guitar store functions for brushing speed control
  const { incrementBrushingSpeed, decrementBrushingSpeed } = useGuitarStore();

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Check if the target is an input element (including chat input)
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest('input, textarea, [contenteditable="true"]') ||
        target.hasAttribute("data-chat-input") ||
        target.closest("[data-chat-input]");

      // Skip guitar shortcuts if typing in an input element
      if (isInputElement) {
        return;
      }

      // Prevent default for all guitar shortcuts
      if (
        Object.values(shortcuts).some((shortcut) => shortcut.key.includes(key))
      ) {
        event.preventDefault();
      }

      // Handle velocity changes first
      if (handleVelocityChange(key)) {
        return;
      }

      // Mode controls
      if (key === shortcuts.toggleMode.key) {
        if (guitarState.mode.type === "basic") {
          // When in basic mode, shift switches to melody mode
          guitarControls.setMode("melody");
        } else if (guitarState.mode.type === "melody") {
          // When in melody mode, shift switches to chord mode
          guitarControls.setMode("chord");
        } else if (guitarState.mode.type === "chord") {
          // When in chord mode, shift switches back to melody mode
          guitarControls.setMode("melody");
        }
        return;
      }

      // Basic mode - sustain shortcuts only
      if (guitarState.mode.type === "basic") {
        // Sustain controls
        if (key === shortcuts.sustain.key) {
          if (guitarState.sustainToggle) {
            // If toggle mode is active, sustain key stops current sustained notes
            // but keeps sustain active (like keyboard behavior)
            guitarControls.stopSustainedNotes();
            // Temporarily turn off sustain to communicate state change
            // then immediately turn it back on to maintain the toggle state
            guitarControls.setSustain(false);
            setTimeout(() => {
              guitarControls.setSustain(true);
            }, 10);
          } else {
            // Normal momentary sustain behavior
            guitarControls.setSustain(true);
          }
          return;
        }
        if (key === shortcuts.sustainToggle.key) {
          guitarControls.setSustainToggle(!guitarState.sustainToggle);
          return;
        }

        return;
      }

      // Simple - Note mode
      if (guitarState.mode.type === "melody") {
        // Octave controls
        if (key === shortcuts.octaveDown.key) {
          guitarControls.setCurrentOctave(
            Math.max(0, guitarState.currentOctave - 1),
          );
          return;
        }
        if (key === shortcuts.octaveUp.key) {
          guitarControls.setCurrentOctave(
            Math.min(8, guitarState.currentOctave + 1),
          );
          return;
        }

        // Note keys (base octave - ASDFGHJKL;')
        const lowerOctaveKeys = shortcuts.lowerOctaveNotes.key.split("");
        if (lowerOctaveKeys.includes(key)) {
          const keyIndex = lowerOctaveKeys.indexOf(key);

          // Get scale notes for current and next octaves
          const currentScaleNotes = scaleState.getScaleNotes(
            scaleState.rootNote,
            scaleState.scale,
            guitarState.currentOctave,
          );
          const nextOctaveScaleNotes = scaleState.getScaleNotes(
            scaleState.rootNote,
            scaleState.scale,
            guitarState.currentOctave + 1,
          );

          // Combine notes from both octaves: [...currentScaleNotes, ...nextOctaveScaleNotes]
          const baseOctaveNotes = [
            ...currentScaleNotes,
            ...nextOctaveScaleNotes,
          ];

          if (baseOctaveNotes[keyIndex]) {
            // Check if hammer-on is enabled for this string
            const string = guitarState.strings.lower;
            const currentTime = Date.now();
            const isHammerOnWindow =
              currentTime - string.lastPlayTime <=
              guitarState.hammerOnState.windowMs;

            if (string.isHammerOnEnabled && isHammerOnWindow) {
              // Try hammer-on
              guitarControls.handleHammerOnPress(
                "lower",
                baseOctaveNotes[keyIndex],
              );
            } else {
              // Normal note press
              guitarControls.handleNotePress(
                "lower",
                baseOctaveNotes[keyIndex],
              );
            }
          }
          return;
        }

        // Note keys (higher octave - QWERTYUIOP[])
        const higherOctaveKeys = shortcuts.higherOctaveNotes.key.split("");
        if (higherOctaveKeys.includes(key)) {
          const keyIndex = higherOctaveKeys.indexOf(key);

          // Get scale notes for next and upper octaves
          const nextOctaveScaleNotes = scaleState.getScaleNotes(
            scaleState.rootNote,
            scaleState.scale,
            guitarState.currentOctave + 1,
          );
          const upperOctaveScaleNotes = scaleState.getScaleNotes(
            scaleState.rootNote,
            scaleState.scale,
            guitarState.currentOctave + 2,
          );

          // Combine notes from both octaves: [...nextOctaveScaleNotes, ...upperOctaveScaleNotes]
          const higherOctaveNotes = [
            ...nextOctaveScaleNotes,
            ...upperOctaveScaleNotes,
          ];

          if (higherOctaveNotes[keyIndex]) {
            // Check if hammer-on is enabled for this string
            const string = guitarState.strings.higher;
            const currentTime = Date.now();
            const isHammerOnWindow =
              currentTime - string.lastPlayTime <=
              guitarState.hammerOnState.windowMs;

            if (string.isHammerOnEnabled && isHammerOnWindow) {
              // Try hammer-on
              guitarControls.handleHammerOnPress(
                "higher",
                higherOctaveNotes[keyIndex],
              );
            } else {
              // Normal note press
              guitarControls.handleNotePress(
                "higher",
                higherOctaveNotes[keyIndex],
              );
            }
          }
          return;
        }

        // Play note buttons
        if (key === "," || key === ".") {
          // Play notes for both strings with velocity adjustment for ',' key
          const velocity =
            key === ","
              ? guitarState.velocity *
                GUITAR_PLAY_BUTTONS.PICK_UP_VELOCITY_MULTIPLIER
              : guitarState.velocity;
          guitarControls.handlePlayButtonPress("lower", velocity);
          guitarControls.handlePlayButtonPress("higher", velocity);
          return;
        }
      }

      // Simple - Chord mode
      if (guitarState.mode.type === "chord") {
        // Chord keys
        const chordKeys = shortcuts.chordNotes.key.split("");
        if (chordKeys.includes(key)) {
          const keyIndex = chordKeys.indexOf(key);
          const newPressedChords = new Set(guitarState.pressedChords);
          newPressedChords.add(keyIndex);
          guitarControls.setPressedChords(newPressedChords);

          // Also call the chord press handler to play the chord
          if (guitarControls.handleChordPress) {
            guitarControls.handleChordPress(keyIndex);
          }
          return;
        }

        // Strum controls
        if (key === "," || key === ".") {
          const direction = key === "," ? "up" : "down";
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
          decrementBrushingSpeed();
          return;
        }
        if (key === shortcuts.strumSpeedUp.key) {
          incrementBrushingSpeed();
          return;
        }

        // Voicing controls
        if (key === shortcuts.voicingDown.key) {
          guitarControls.setChordVoicing(
            Math.max(-2, guitarState.chordVoicing - 1),
          );
          return;
        }
        if (key === shortcuts.voicingUp.key) {
          guitarControls.setChordVoicing(
            Math.min(4, guitarState.chordVoicing + 1),
          );
          return;
        }

        // Chord modifiers
        if (key === shortcuts.dominant7.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add(shortcuts.dominant7.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.major7.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add(shortcuts.major7.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.sus2.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add(shortcuts.sus2.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.sus4.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add(shortcuts.sus4.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.majMinToggle.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.add(shortcuts.majMinToggle.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.powerChordToggle.key) {
          // Toggle power chord mode
          const newPowerChordMode = !guitarState.powerChordMode;
          // Update the power chord mode through the guitar controls
          if (guitarControls.setPowerChordMode) {
            guitarControls.setPowerChordMode(newPowerChordMode);
          }
          return;
        }

        // Velocity controls
      }

      // Sustain controls (available in all modes)
      if (key === shortcuts.sustain.key) {
        if (guitarState.sustainToggle) {
          // If toggle mode is active, sustain key stops current sustained notes
          // but keeps sustain active (like keyboard behavior)
          guitarControls.stopSustainedNotes();
          // Temporarily turn off sustain to communicate state change
          // then immediately turn it back on to maintain the toggle state
          guitarControls.setSustain(false);
          setTimeout(() => {
            guitarControls.setSustain(true);
          }, 10);
        } else {
          // Normal momentary sustain behavior
          guitarControls.setSustain(true);
        }
        return;
      }
      if (key === shortcuts.sustainToggle.key) {
        guitarControls.setSustainToggle(!guitarState.sustainToggle);
        return;
      }
    },
    [
      guitarState,
      scaleState,
      guitarControls,
      shortcuts,
      handleVelocityChange,
      decrementBrushingSpeed,
      incrementBrushingSpeed,
    ],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Basic mode - sustain release
      if (guitarState.mode.type === "basic") {
        if (key === shortcuts.sustain.key) {
          if (guitarState.sustainToggle) {
            // If toggle mode is active, releasing sustain should resume sustain mode
            // This creates the "inverse" behavior where lifting sustain resumes sustain
            guitarControls.setSustain(true);
          } else {
            // Normal momentary sustain behavior - turn off sustain
            guitarControls.setSustain(false);
          }
          return;
        }
      }

      // Simple - Note mode
      if (guitarState.mode.type === "melody") {
        // Note keys (base octave - ASDFGHJKL;')
        const lowerOctaveKeys = shortcuts.lowerOctaveNotes.key.split("");
        if (lowerOctaveKeys.includes(key)) {
          const keyIndex = lowerOctaveKeys.indexOf(key);

          // Get scale notes for current and next octaves
          const currentScaleNotes = scaleState.getScaleNotes(
            scaleState.rootNote,
            scaleState.scale,
            guitarState.currentOctave,
          );
          const nextOctaveScaleNotes = scaleState.getScaleNotes(
            scaleState.rootNote,
            scaleState.scale,
            guitarState.currentOctave + 1,
          );

          // Combine notes from both octaves: [...currentScaleNotes, ...nextOctaveScaleNotes]
          const baseOctaveNotes = [
            ...currentScaleNotes,
            ...nextOctaveScaleNotes,
          ];

          if (baseOctaveNotes[keyIndex]) {
            guitarControls.handleNoteRelease(
              "lower",
              baseOctaveNotes[keyIndex],
            );
          }
          return;
        }

        // Note keys (higher octave - QWERTYUIOP[])
        const higherOctaveKeys = shortcuts.higherOctaveNotes.key.split("");
        if (higherOctaveKeys.includes(key)) {
          const keyIndex = higherOctaveKeys.indexOf(key);

          // Get scale notes for next and upper octaves
          const nextOctaveScaleNotes = scaleState.getScaleNotes(
            scaleState.rootNote,
            scaleState.scale,
            guitarState.currentOctave + 1,
          );
          const upperOctaveScaleNotes = scaleState.getScaleNotes(
            scaleState.rootNote,
            scaleState.scale,
            guitarState.currentOctave + 2,
          );

          // Combine notes from both octaves: [...nextOctaveScaleNotes, ...upperOctaveScaleNotes]
          const higherOctaveNotes = [
            ...nextOctaveScaleNotes,
            ...upperOctaveScaleNotes,
          ];

          if (higherOctaveNotes[keyIndex]) {
            guitarControls.handleNoteRelease(
              "higher",
              higherOctaveNotes[keyIndex],
            );
          }
          return;
        }
      }

      // Simple - Chord mode
      if (guitarState.mode.type === "chord") {
        // Chord keys
        const chordKeys = shortcuts.chordNotes.key.split("");
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
          newModifiers.delete(shortcuts.dominant7.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.major7.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete(shortcuts.major7.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.sus2.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete(shortcuts.sus2.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.sus4.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete(shortcuts.sus4.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
        if (key === shortcuts.majMinToggle.key) {
          const newModifiers = new Set(guitarState.chordModifiers);
          newModifiers.delete(shortcuts.majMinToggle.key);
          guitarControls.setChordModifiers(newModifiers);
          return;
        }
      }

      // Sustain controls
      if (key === shortcuts.sustain.key) {
        if (guitarState.sustainToggle) {
          // If toggle mode is active, releasing sustain should resume sustain mode
          // This creates the "inverse" behavior where lifting sustain resumes sustain
          guitarControls.setSustain(true);
        } else {
          // Normal momentary sustain behavior - turn off sustain
          guitarControls.setSustain(false);
          guitarControls.stopSustainedNotes();
        }
        return;
      }
    },
    [guitarState, scaleState, guitarControls, shortcuts],
  );

  return { handleKeyDown, handleKeyUp };
};
