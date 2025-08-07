import { DEFAULT_KEYBOARD_SHORTCUTS } from "../../constants/keyboardShortcuts";
import { getKeyDisplayName } from "../../constants/utils/displayUtils";
import { useInstrumentState } from "../../hooks/useInstrumentState";
import type { Scale } from "../../hooks/useScaleState";
import { useKeyboardStore } from "../../stores/keyboardStore";
import BaseInstrument from "../shared/BaseInstrument";
import { BasicKeyboard } from "./components/BasicKeyboard";
import { ChordKeyboard } from "./components/ChordKeyboard";
import { MelodyKeyboard } from "./components/MelodyKeyboard";
import { useKeyboardKeysController } from "./hooks/useKeyboardKeysController";
import { useVirtualKeyboard } from "./hooks/useVirtualKeyboard";
import { useEffect } from "react";

export interface Props {
  // Scale state - the core functionality
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };

  // Audio control - the core functionality
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onStopSustainedNotes: () => void;
  onReleaseKeyHeldNote: (note: string) => void;
  onSustainChange: (sustain: boolean) => void;
  onSustainToggleChange?: (sustainToggle: boolean) => void;
}

export default function Keyboard({
  scaleState,
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
  onSustainToggleChange,
}: Props) {
  const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;

  // Use keyboard store for persistent state
  const {
    mode,
    setMode,
    currentOctave,
    setCurrentOctave,
    velocity,
    setVelocity,
    chordVoicing,
    setChordVoicing,
    sustain,
    setSustain,
    sustainToggle,
    setSustainToggle,
  } = useKeyboardStore();

  // Use the unified instrument state hook for held keys and pressed keys
  const unifiedState = useInstrumentState({
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
    onSustainToggleChange,
  });

  // Synchronize keyboard store state with unified state
  useEffect(() => {
    if (unifiedState.sustainToggle !== sustainToggle) {
      setSustainToggle(unifiedState.sustainToggle);
    }
  }, [unifiedState.sustainToggle, sustainToggle, setSustainToggle]);

  useEffect(() => {
    if (unifiedState.sustain !== sustain) {
      setSustain(unifiedState.sustain);
    }
  }, [unifiedState.sustain, sustain, setSustain]);

  const virtualKeyboard = useVirtualKeyboard(
    scaleState.getScaleNotes,
    scaleState.rootNote,
    scaleState.scale,
    onPlayNotes,
    onReleaseKeyHeldNote,
    unifiedState, // Pass unified state to respect sustain settings
  );

  const {
    chordModifiers,
    setChordModifiers,
    pressedTriads,
    setPressedTriads,
    activeTriadChords,
    setActiveTriadChords,
    handleVirtualKeyPress,
    handleVirtualKeyRelease,
    handleTriadPress,
    handleTriadRelease,
    handleModifierPress,
    handleModifierRelease,
  } = virtualKeyboard;

  // Create a keyboard state object that matches the interface expected by useKeyboardKeysController
  const keyboardState = {
    mode,
    currentOctave,
    velocity,
    sustain,
    sustainToggle,
    hasSustainedNotes: unifiedState.hasSustainedNotes,
    heldKeys: unifiedState.heldKeys,
    setSustain: unifiedState.setSustain,
    setSustainToggle: unifiedState.setSustainToggle,
    setHeldKeys: unifiedState.setHeldKeys,
    setMode,
    setCurrentOctave,
    setVelocity,
    playNote: unifiedState.playNote,
    releaseKeyHeldNote: unifiedState.releaseKeyHeldNote,
    stopSustainedNotes: unifiedState.stopSustainedNotes,
  };

  const { handleKeyDown, handleKeyUp } = useKeyboardKeysController(
    keyboardState,
    scaleState,
    {
      ...virtualKeyboard,
      chordVoicing,
      setChordVoicing,
      chordModifiers,
      setChordModifiers,
      pressedTriads,
      setPressedTriads,
      activeTriadChords,
      setActiveTriadChords,
    },
  );

  const virtualKeys = virtualKeyboard.generateVirtualKeys;

  const renderVirtualKeyboard = () => {
    if (mode === "simple-chord") {
      return (
        <ChordKeyboard
          virtualKeys={virtualKeys}
          pressedKeys={unifiedState.pressedKeys}
          pressedTriads={pressedTriads}
          chordModifiers={chordModifiers}
          scale={scaleState.scale}
          rootNote={scaleState.rootNote}
          onKeyPress={handleVirtualKeyPress}
          onKeyRelease={handleVirtualKeyRelease}
          onTriadPress={handleTriadPress}
          onTriadRelease={handleTriadRelease}
          onModifierPress={handleModifierPress}
          onModifierRelease={handleModifierRelease}
          sustain={sustain}
          sustainToggle={sustainToggle}
        />
      );
    } else if (mode === "simple-melody") {
      return (
        <MelodyKeyboard
          virtualKeys={virtualKeys}
          pressedKeys={unifiedState.pressedKeys}
          onKeyPress={handleVirtualKeyPress}
          onKeyRelease={handleVirtualKeyRelease}
          sustain={sustain}
          sustainToggle={sustainToggle}
        />
      );
    } else {
      return (
        <BasicKeyboard
          virtualKeys={virtualKeys}
          pressedKeys={unifiedState.pressedKeys}
          onKeyPress={handleVirtualKeyPress}
          onKeyRelease={handleVirtualKeyRelease}
          sustain={sustain}
          sustainToggle={sustainToggle}
        />
      );
    }
  };

  // Mode controls JSX
  const modeControls = (
    <div className="block join">
      <button
        onClick={() => setMode("simple-melody")}
        className={`btn btn-sm join-item touch-manipulation ${mode === "simple-melody" ? "btn-primary" : "btn-outline"}`}
      >
        Melody{" "}
        <kbd className="kbd kbd-xs">
          {getKeyDisplayName(shortcuts.toggleMode.key)}
        </kbd>
      </button>
      <button
        onClick={() => setMode("simple-chord")}
        className={`btn btn-sm join-item touch-manipulation ${mode === "simple-chord" ? "btn-primary" : "btn-outline"}`}
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
    if (mode === "simple-melody") {
      return {
        velocity: true,
        octave: true,
        sustain: true,
      };
    } else if (mode === "simple-chord") {
      return {
        velocity: true,
        octave: true,
        sustain: true,
        chordVoicing: true,
      };
    } else if (mode === "basic") {
      return {
        velocity: true,
        octave: true,
        sustain: true,
      };
    }
    return {};
  };

  return (
    <BaseInstrument
      title="Keyboard"
      shortcuts={shortcuts}
      modeControls={modeControls}
      controlConfig={getControlConfig()}
      velocity={velocity}
      setVelocity={setVelocity}
      currentOctave={currentOctave}
      setCurrentOctave={setCurrentOctave}
      sustain={sustain}
      setSustain={unifiedState.setSustain}
      sustainToggle={sustainToggle}
      setSustainToggle={unifiedState.setSustainToggle}
      onStopSustainedNotes={onStopSustainedNotes}
      hasSustainedNotes={unifiedState.hasSustainedNotes}
      chordVoicing={chordVoicing}
      setChordVoicing={setChordVoicing}
      handleKeyDown={handleKeyDown}
      handleKeyUp={handleKeyUp}
    >
      {renderVirtualKeyboard()}
    </BaseInstrument>
  );
}
