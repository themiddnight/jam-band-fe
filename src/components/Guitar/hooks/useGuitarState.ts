import { useInstrumentState } from "../../../hooks/useInstrumentState";
import type { Scale } from "../../../hooks/useScaleState";
import { useGuitarStore } from "../../../stores/guitarStore";
import { useGuitarBasicMode } from "./useGuitarBasicMode";
import { useGuitarChordLogic } from "./useGuitarChordLogic";
import { useGuitarStringBehavior } from "./useGuitarStringBehavior";

export const useGuitarState = (
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  },
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void,
  onStopNotes: (notes: string[]) => void,
  onStopSustainedNotes: () => void,
  onReleaseKeyHeldNote: (note: string) => void,
  onSustainChange: (sustain: boolean) => void,
  onSustainToggleChange?: (sustainToggle: boolean) => void,
) => {
  // Use the unified instrument state hook
  const unifiedState = useInstrumentState({
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
    onSustainToggleChange,
  });

  // Use Zustand store for the specified states (except sustain which uses unified state)
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

  // Use separated logic hooks
  const stringBehavior = useGuitarStringBehavior(
    onPlayNotes,
    onStopNotes,
    velocity,
  );

  const chordLogic = useGuitarChordLogic(
    onPlayNotes,
    onStopNotes,
    scaleState,
    velocity,
    chordVoicing,
    brushingSpeed,
  );

  const basicMode = useGuitarBasicMode(
    onPlayNotes,
    onReleaseKeyHeldNote,
    velocity,
  );

  // Update strumConfig when brushingSpeed changes
  const updateStrumSpeed = (speed: number) => {
    handleBrushingSpeedChange(speed);
    chordLogic.updateStrumSpeed(speed);
  };

  // Create a guitar state object that matches the interface expected by useGuitarKeysController
  const guitarState = {
    mode: { type: mode, description: mode },
    velocity,
    sustain: unifiedState.sustain,
    sustainToggle: unifiedState.sustainToggle,
    currentOctave,
    chordVoicing,
    chordModifiers: chordLogic.chordModifiers,
    powerChordMode: chordLogic.powerChordMode,
    pressedNotes: new Set<string>(), // This will be managed by string behavior
    pressedChords: chordLogic.pressedChords,
    strumConfig: chordLogic.strumConfig,
    strings: stringBehavior.strings,
    hammerOnState: stringBehavior.hammerOnState,
  };

  // Create guitar controls object
  const guitarControls = {
    mode: guitarState.mode.type,
    setMode,
    velocity,
    setVelocity,
    sustain: unifiedState.sustain,
    setSustain: unifiedState.setSustain, // Use unified state setter for keyboard shortcuts
    sustainToggle: unifiedState.sustainToggle,
    setSustainToggle: unifiedState.setSustainToggle, // Use unified state setter for keyboard shortcuts
    currentOctave,
    setCurrentOctave,
    chordVoicing,
    setChordVoicing,
    chordModifiers: chordLogic.chordModifiers,
    setChordModifiers: chordLogic.setChordModifiers,
    powerChordMode: chordLogic.powerChordMode,
    setPowerChordMode: chordLogic.setPowerChordMode,
    pressedNotes: new Set<string>(), // This will be managed by string behavior
    setPressedNotes: () => {}, // Placeholder
    pressedChords: chordLogic.pressedChords,
    setPressedChords: chordLogic.setPressedChords,
    strumConfig: chordLogic.strumConfig,
    setStrumSpeed: updateStrumSpeed,
    setStrumDirection: chordLogic.updateStrumDirection,
    playNote: basicMode.handleBasicPlayNote,
    stopNote: basicMode.handleBasicReleaseNote,
    releaseKeyHeldNote: onReleaseKeyHeldNote,
    stopSustainedNotes: onStopSustainedNotes,
    handleStrumChord: chordLogic.handleStrumChord,
    handleChordPress: chordLogic.handleChordPress,
    handleChordRelease: chordLogic.handleChordRelease,
    // String-based functions
    handleNotePress: stringBehavior.handleNotePress,
    handleNoteRelease: stringBehavior.handleNoteRelease,
    handlePlayButtonPress: stringBehavior.handlePlayButtonPress,
    handleHammerOnPress: stringBehavior.handleHammerOnPress,
  };

  return {
    unifiedState,
    guitarState,
    guitarControls,
    stringBehavior,
    chordLogic,
    basicMode,
    // Store getters and setters
    mode,
    setMode,
    velocity,
    setVelocity,
    currentOctave,
    setCurrentOctave,
    chordVoicing,
    setChordVoicing,
    brushingSpeed,
    setBrushingSpeed: handleBrushingSpeedChange,
    // Use unified state for sustain to avoid conflicts
    sustain: unifiedState.sustain,
    setSustain: unifiedState.setSustain,
    sustainToggle: unifiedState.sustainToggle,
    setSustainToggle: unifiedState.setSustainToggle,
  };
};
