import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  ARPEGGIO_TIME_STEPS,
  ARPEGGIO_TIME_LABELS,
} from "../../constants/keyboardShortcuts";
import { useInstrumentState } from "../../hooks/useInstrumentState";
import { useKeyboardStore } from "../../stores/keyboardStore";
import { BasicKeyboard } from "./components/BasicKeyboard";
import { ChordKeyboard } from "./components/ChordKeyboard";
import { MelodyKeyboard } from "./components/MelodyKeyboard";
import { useKeyboardKeysController } from "./hooks/useKeyboardKeysController";
import { useVirtualKeyboard } from "./hooks/useVirtualKeyboard";
import { useSustainSync } from "@/features/audio";
import type { Scale } from "@/features/ui";
import { BaseInstrument } from "@/features/ui";

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
    arpeggioSpeed,
    setArpeggioSpeed,
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

  // Use shared sustain sync hook to eliminate duplicate useEffect blocks
  useSustainSync({
    unifiedSustain: unifiedState.sustain,
    localSustain: sustain,
    setLocalSustain: setSustain,
    unifiedSustainToggle: unifiedState.sustainToggle,
    localSustainToggle: sustainToggle,
    setLocalSustainToggle: setSustainToggle,
  });

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
          rootNote={scaleState.rootNote}
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
        className={`btn btn-xs sm:btn-sm join-item touch-manipulation ${mode === "simple-melody" ? "btn-primary" : "btn-outline"}`}
      >
        Melody{" "}
        <kbd className="kbd kbd-xs hidden sm:inline">{shortcuts.toggleMode.key}</kbd>
      </button>
      <button
        onClick={() => setMode("simple-chord")}
        className={`btn btn-xs sm:btn-sm join-item touch-manipulation ${mode === "simple-chord" ? "btn-primary" : "btn-outline"}`}
      >
        Chord{" "}
        <kbd className="kbd kbd-xs hidden sm:inline">{shortcuts.toggleMode.key}</kbd>
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

  // Additional controls: Arpeggio (only in simple-chord mode)
  const additionalControls =
    mode === "simple-chord" ? (
      <div className="flex items-center gap-1 sm:gap-2">
        <label className="label py-1">
          <span className="label-text text-xs sm:text-sm">
            <span className="hidden sm:inline">
              Arpeggio:{" "}
              {
                ARPEGGIO_TIME_LABELS[
                  arpeggioSpeed as keyof typeof ARPEGGIO_TIME_LABELS
                ]
              }{" "}
              ({arpeggioSpeed}ms)
            </span>
            <span className="sm:hidden">
              Arp: {arpeggioSpeed}ms
            </span>
          </span>
        </label>
        <div className="join">
          <button
            onClick={() => {
              const currentStep = ARPEGGIO_TIME_STEPS.indexOf(
                arpeggioSpeed as any,
              );
              if (currentStep > 0) {
                const newSpeed = ARPEGGIO_TIME_STEPS[currentStep - 1];
                setArpeggioSpeed(newSpeed as any);
              }
            }}
            className="btn btn-xs sm:btn-sm btn-outline join-item touch-manipulation"
          >
            -{" "}
            <kbd className="kbd kbd-xs hidden sm:inline">
              {DEFAULT_KEYBOARD_SHORTCUTS.arpeggioSpeedDown.key.toUpperCase()}
            </kbd>
          </button>
          <button
            onClick={() => {
              const currentStep = ARPEGGIO_TIME_STEPS.indexOf(
                arpeggioSpeed as any,
              );
              if (currentStep < ARPEGGIO_TIME_STEPS.length - 1) {
                const newSpeed = ARPEGGIO_TIME_STEPS[currentStep + 1];
                setArpeggioSpeed(newSpeed as any);
              }
            }}
            className="btn btn-xs sm:btn-sm btn-outline join-item touch-manipulation"
          >
            +{" "}
            <kbd className="kbd kbd-xs hidden sm:inline">
              {DEFAULT_KEYBOARD_SHORTCUTS.arpeggioSpeedUp.key.toUpperCase()}
            </kbd>
          </button>
        </div>
      </div>
    ) : undefined;

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
      additionalControls={additionalControls}
    >
      {renderVirtualKeyboard()}
    </BaseInstrument>
  );
}
