import { useVirtualKeyboard } from "./hooks/useVirtualKeyboard";
import { useKeyboardKeysController } from "./hooks/useKeyboardKeysController";
import { MelodyKeys } from "./components/MelodyKeys";
import { ChordKeys } from "./components/ChordKeys";
import { AdvancedKeys } from "./components/AdvancedKeys";
import { getKeyDisplayName, DEFAULT_KEYBOARD_SHORTCUTS } from "../../constants/keyboardShortcuts";
import type { Scale } from "../../hooks/useScaleState";
import BaseInstrument from "../shared/BaseInstrument";
import { useInstrumentState } from "../../hooks/useInstrumentState";

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

  // Use the unified instrument state hook
  const unifiedState = useInstrumentState({
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
    onSustainToggleChange,
  });

  const virtualKeyboard = useVirtualKeyboard(
    scaleState.getScaleNotes,
    scaleState.rootNote,
    scaleState.scale,
    onPlayNotes,
    onReleaseKeyHeldNote,
    unifiedState // Pass unified state to respect sustain settings
  );

  const {
    mode,
    setMode,
    currentOctave,
    setCurrentOctave,
    velocity,
    setVelocity,
    chordVoicing,
    setChordVoicing,
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
    sustain: unifiedState.sustain,
    sustainToggle: unifiedState.sustainToggle,
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
    }
  );

  const virtualKeys = virtualKeyboard.generateVirtualKeys;

  const renderVirtualKeyboard = () => {
    if (mode === "simple-chord") {
      return (
        <ChordKeys
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
        />
      );
    } else if (mode === "simple-melody") {
      return (
        <MelodyKeys
          virtualKeys={virtualKeys}
          pressedKeys={unifiedState.pressedKeys}
          onKeyPress={handleVirtualKeyPress}
          onKeyRelease={handleVirtualKeyRelease}
        />
      );
    } else {
      return (
        <AdvancedKeys
          virtualKeys={virtualKeys}
          pressedKeys={unifiedState.pressedKeys}
          onKeyPress={handleVirtualKeyPress}
          onKeyRelease={handleVirtualKeyRelease}
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
      sustain={unifiedState.sustain}
      setSustain={unifiedState.setSustain}
      sustainToggle={unifiedState.sustainToggle}
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
