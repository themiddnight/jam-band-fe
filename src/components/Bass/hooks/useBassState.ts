import { useInstrumentState } from "../../../hooks/useInstrumentState";
import type { Scale } from "../../../hooks/useScaleState";
import { useBassStore } from "../../../stores/bassStore";
import { useGuitarBasicMode } from "../../Guitar/hooks/useGuitarBasicMode";
import { useGuitarStringBehavior } from "../../Guitar/hooks/useGuitarStringBehavior";

export const useBassState = (
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
  // Unified instrument state
  const unifiedState = useInstrumentState({
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
    onSustainToggleChange,
  });

  // Bass store
  const {
    mode,
    setMode,
    velocity,
    setVelocity,
    currentOctave,
    setCurrentOctave,
    alwaysRoot,
    setAlwaysRoot,
  } = useBassStore();

  // Reuse basic and string behavior from guitar
  const basicMode = useGuitarBasicMode(onPlayNotes, onReleaseKeyHeldNote, velocity);
  const stringBehavior = useGuitarStringBehavior(onPlayNotes, onStopNotes, velocity);

  // Construct bass state for controllers
  const bassState = {
    mode: { type: mode, description: mode },
    velocity,
    sustain: unifiedState.sustain,
    sustainToggle: unifiedState.sustainToggle,
    currentOctave,
    alwaysRoot,
    strings: stringBehavior.strings,
    hammerOnState: stringBehavior.hammerOnState,
  };

  const bassControls = {
    mode: bassState.mode.type,
    setMode,
    velocity,
    setVelocity,
    sustain: unifiedState.sustain,
    setSustain: unifiedState.setSustain,
    sustainToggle: unifiedState.sustainToggle,
    setSustainToggle: unifiedState.setSustainToggle,
    currentOctave,
    setCurrentOctave,
    alwaysRoot,
    setAlwaysRoot,
    // basic
    playNote: basicMode.handleBasicPlayNote,
    stopNote: basicMode.handleBasicReleaseNote,
    releaseKeyHeldNote: onReleaseKeyHeldNote,
    stopSustainedNotes: onStopSustainedNotes,
    // string behavior
    handleNotePress: stringBehavior.handleNotePress,
    handleNoteRelease: stringBehavior.handleNoteRelease,
    handlePlayButtonPress: stringBehavior.handlePlayButtonPress,
    handleHammerOnPress: stringBehavior.handleHammerOnPress,
  };

  return {
    unifiedState,
    bassState,
    bassControls,
    // store
    mode,
    setMode,
    velocity,
    setVelocity,
    currentOctave,
    setCurrentOctave,
    sustain: unifiedState.sustain,
    setSustain: unifiedState.setSustain,
    sustainToggle: unifiedState.sustainToggle,
    setSustainToggle: unifiedState.setSustainToggle,
    alwaysRoot,
    setAlwaysRoot,
    stringBehavior,
    basicMode,
  };
}; 