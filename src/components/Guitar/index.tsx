import { DEFAULT_GUITAR_SHORTCUTS } from "../../constants/guitarShortcuts";
import { getKeyDisplayName } from "../../constants/utils/displayUtils";
import type { Scale } from "../../hooks/useScaleState";
import BaseInstrument from "../shared/BaseInstrument";
import { BasicFretboard } from "./components/BasicFretboard";
import { SimpleChordKeys } from "./components/SimpleChordKeys";
import { SimpleNoteKeys } from "./components/SimpleNoteKeys";
import { useGuitarKeysController } from "./hooks/useGuitarKeysController";
import { useGuitarState } from "./hooks/useGuitarState";
import { useMemo } from "react";

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
  // Use the separated guitar state hook
  const {
    unifiedState,
    guitarState,
    guitarControls,
    stringBehavior,
    chordLogic,
    basicMode,
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
  } = useGuitarState(
    scaleState,
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
    onSustainToggleChange,
  );

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
    unifiedState.pressedKeys.forEach((key) => {
      // Convert note to fret format if needed
      // For now, we'll use the key as-is since BasicFretboard expects string-fret format
      fretSet.add(key);
    });
    return fretSet;
  }, [unifiedState.pressedKeys]);

  const renderGuitarMode = () => {
    switch (mode) {
      case "basic":
        return (
          <BasicFretboard
            scaleState={scaleState}
            velocity={velocity}
            sustain={unifiedState.sustain}
            sustainToggle={unifiedState.sustainToggle}
            pressedFrets={pressedFrets}
            onFretPress={basicMode.handleBasicFretPress}
            onFretRelease={basicMode.handleBasicFretRelease}
            onVelocityChange={setVelocity}
            onPlayNote={basicMode.handleBasicPlayNote}
            onReleaseNote={basicMode.handleBasicReleaseNote}
          />
        );
      case "melody":
        return (
          <SimpleNoteKeys
            scaleState={scaleState}
            currentOctave={currentOctave}
            velocity={velocity}
            // Pass the new string-based functions
            handleNotePress={stringBehavior.handleNotePress}
            handleNoteRelease={stringBehavior.handleNoteRelease}
            handlePlayButtonPress={stringBehavior.handlePlayButtonPress}
            handleHammerOnPress={stringBehavior.handleHammerOnPress}
            guitarState={{
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
            }}
          />
        );
      case "chord":
        return (
          <SimpleChordKeys
            scaleState={scaleState}
            chordVoicing={chordVoicing}
            pressedChords={chordLogic.pressedChords}
            chordModifiers={chordLogic.chordModifiers}
            powerChordMode={chordLogic.powerChordMode}
            onChordPress={chordLogic.handleChordPress}
            onChordRelease={chordLogic.handleChordRelease}
            onStrumChord={chordLogic.handleStrumChord}
            onChordModifierChange={chordLogic.setChordModifiers}
            onPowerChordModeChange={chordLogic.setPowerChordMode}
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
        onClick={() => setMode("melody")}
        className={`btn btn-sm join-item touch-manipulation ${mode === "melody" ? "btn-primary" : "btn-outline"}`}
      >
        Melody{" "}
        <kbd className="kbd kbd-xs">
          {getKeyDisplayName(shortcuts.toggleMode.key)}
        </kbd>
      </button>
      <button
        onClick={() => setMode("chord")}
        className={`btn btn-sm join-item touch-manipulation ${mode === "chord" ? "btn-primary" : "btn-outline"}`}
      >
        Chord{" "}
        <kbd className="kbd kbd-xs">
          {getKeyDisplayName(shortcuts.toggleMode.key)}
        </kbd>
      </button>
      <button
        onClick={() => setMode("basic")}
        className={`btn btn-sm join-item touch-manipulation ${mode === "basic" ? "btn-primary" : "btn-outline"}`}
      >
        Basic
      </button>
    </div>
  );

  // Get control configuration based on mode
  const getControlConfig = () => {
    switch (mode) {
      case "basic":
        return {
          velocity: true,
          sustain: true,
        };
      case "melody":
        return {
          velocity: true,
          octave: true,
        };
      case "chord":
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
      onStopSustainedNotes={onStopSustainedNotes}
      hasSustainedNotes={hasSustainedNotes}
      chordVoicing={chordVoicing}
      setChordVoicing={setChordVoicing}
      brushingSpeed={brushingSpeed}
      setBrushingSpeed={setBrushingSpeed}
      handleKeyDown={handleKeyDown}
      handleKeyUp={handleKeyUp}
    >
      {renderGuitarMode()}
    </BaseInstrument>
  );
}
