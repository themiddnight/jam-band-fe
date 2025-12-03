import { DEFAULT_GUITAR_SHORTCUTS } from "../../index";
import { BasicFretboard } from "./components/BasicFretboard";
import { SimpleChordKeys } from "./components/ChordGuitar";
import { MelodyGuitar } from "./components/MelodyGuitar";
import { useGuitarKeysController } from "./hooks/useGuitarKeysController";
import { useGuitarState } from "./hooks/useGuitarState";
import { useSustainSync } from "@/features/audio";
import type { Scale } from "@/features/ui";
import { BaseInstrument } from "@/features/ui";
import { useMemo, useRef, useState } from "react";

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
  onSelectionActiveChange?: (isActive: boolean) => void;
}

export default function Guitar({
  scaleState,
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
  onSustainToggleChange,
  onSelectionActiveChange,
}: GuitarProps) {
  // Sharp modifier state for +1 semitone feature (must be before useGuitarState)
  const sharpModifierRef = useRef(false);
  const [sharpModifierActive, setSharpModifierActive] = useState(false);

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
    sustain,
    setSustain,
    sustainToggle,
    setSustainToggle,
  } = useGuitarState(
    scaleState,
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
    onSustainToggleChange,
    onSelectionActiveChange,
    sharpModifierRef, // Pass sharp modifier ref for chord transposition
  );

  // Use shared sustain sync hook to eliminate duplicate useEffect blocks
  useSustainSync({
    unifiedSustain: unifiedState.sustain,
    localSustain: sustain,
    setLocalSustain: setSustain,
    unifiedSustainToggle: unifiedState.sustainToggle,
    localSustainToggle: sustainToggle,
    setLocalSustainToggle: setSustainToggle,
  });

  const { handleKeyDown, handleKeyUp } = useGuitarKeysController({
    guitarState,
    scaleState,
    guitarControls,
    sharpModifierRef,
    setSharpModifierActive,
  });

  // Get shortcuts
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  // Check if there are sustained notes
  const hasSustainedNotes = false; // Guitar doesn't use sustained notes in the same way as keyboard

  // Convert pressedKeys to pressedFrets format for BasicFretboard
  const pressedFrets = useMemo(() => {
    const fretSet = new Set<string>();
    unifiedState.pressedKeys.forEach((key: string) => {
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
            pressedFrets={pressedFrets}
            onFretPress={(stringIndex: number, fret: number) =>
              basicMode.handleBasicFretPress(stringIndex, fret)
            }
            onFretRelease={(stringIndex: number, fret: number) =>
              basicMode.handleBasicFretRelease(stringIndex, fret)
            }
            onVelocityChange={setVelocity}
            unifiedState={unifiedState}
          />
        );
      case "melody":
        return (
          <MelodyGuitar
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
              sustain,
              sustainToggle,
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
            sustain={sustain}
            sustainToggle={sustainToggle}
          />
        );
      default:
        return null;
    }
  };

  // Mode controls JSX (no shortcut key - use buttons only)
  const modeControls = (
    <div className="block join">
      <button
        onClick={() => setMode("melody")}
        className={`btn btn-xs sm:btn-sm join-item touch-manipulation ${mode === "melody" ? "btn-primary" : "btn-outline"}`}
      >
        Melody
      </button>
      <button
        onClick={() => setMode("chord")}
        className={`btn btn-xs sm:btn-sm join-item touch-manipulation ${mode === "chord" ? "btn-primary" : "btn-outline"}`}
      >
        Chord
      </button>
      <button
        onClick={() => setMode("basic")}
        className={`btn btn-xs sm:btn-sm join-item touch-manipulation ${mode === "basic" ? "btn-primary" : "btn-outline"}`}
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
          sharpModifier: false,
        };
      case "melody":
        return {
          velocity: true,
          octave: true,
          sharpModifier: true,
        };
      case "chord":
        return {
          velocity: true,
          chordVoicing: true,
          brushingSpeed: true,
          sharpModifier: true,
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
      sustain={sustain}
      setSustain={setSustain}
      sustainToggle={sustainToggle}
      setSustainToggle={setSustainToggle}
      onStopSustainedNotes={onStopSustainedNotes}
      hasSustainedNotes={hasSustainedNotes}
      chordVoicing={chordVoicing}
      setChordVoicing={setChordVoicing}
      brushingSpeed={brushingSpeed}
      setBrushingSpeed={setBrushingSpeed}
      sharpModifierActive={sharpModifierActive}
      setSharpModifierActive={(active) => {
        sharpModifierRef.current = active;
        setSharpModifierActive(active);
      }}
      handleKeyDown={handleKeyDown}
      handleKeyUp={handleKeyUp}
    >
      {renderGuitarMode()}
    </BaseInstrument>
  );
}
