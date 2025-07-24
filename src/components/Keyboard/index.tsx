import { useEffect, useState } from "react";
import { useVirtualKeyboard } from "./hooks/useVirtualKeyboard";
import { useKeyboardKeysController } from "./hooks/useKeyboardKeysController";
import { useKeyboardState } from "./hooks/useKeyboardState";
import { useTouchEvents } from "../../hooks/useTouchEvents";
import { MelodyKeys } from "./components/MelodyKeys";
import { ChordKeys } from "./components/ChordKeys";
import { AdvancedKeys } from "./components/AdvancedKeys";
import { ShortcutConfig } from "./ShortcutConfig";
import { useKeyboardShortcutsStore } from "../../stores/keyboardShortcutsStore";
import type { Scale } from "../../hooks/useScaleState";

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
  const shortcuts = useKeyboardShortcutsStore((state) => state.shortcuts);
  const [showShortcutConfig, setShowShortcutConfig] = useState<boolean>(false);

  // Use the new keyboard state hook
  const keyboardStateData = useKeyboardState({
    scaleState,
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
    keyboardStateData // Pass keyboardState to respect sustain settings
  );

  const {
    mainMode,
    setMainMode,
    simpleMode,
    setSimpleMode,
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

  // Create a keyboard state object that matches the interface expected by useKeyboardKeyboard
  const keyboardState = {
    mainMode,
    simpleMode,
    currentOctave,
    velocity,
    setMainMode,
    setSimpleMode,
    setCurrentOctave,
    setVelocity,
    ...keyboardStateData,
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

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);



  const virtualKeys = virtualKeyboard.generateVirtualKeys;

  const renderVirtualKeyboard = () => {
    if (mainMode === "simple" && simpleMode === "chord") {
      return (
        <ChordKeys
          virtualKeys={virtualKeys}
          pressedKeys={keyboardStateData.pressedKeys}
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
    } else if (mainMode === "simple") {
      return (
        <MelodyKeys
          virtualKeys={virtualKeys}
          pressedKeys={keyboardStateData.pressedKeys}
          onKeyPress={handleVirtualKeyPress}
          onKeyRelease={handleVirtualKeyRelease}
        />
      );
    } else {
      return (
        <AdvancedKeys
          virtualKeys={virtualKeys}
          pressedKeys={keyboardStateData.pressedKeys}
          onKeyPress={handleVirtualKeyPress}
          onKeyRelease={handleVirtualKeyRelease}
        />
      );
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body p-3">
        <div className="flex gap-5 mb-3">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="card-title text-base">Mode Controls</h3>
              <button
                onClick={() => setShowShortcutConfig(true)}
                className="btn btn-xs touch-manipulation"
                title="Configure keyboard shortcuts"
              >
                ⚙️
              </button>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="block join">
                <button
                  onClick={() => setMainMode("simple")}
                  className={`btn btn-sm join-item touch-manipulation ${mainMode === "simple" ? "btn-primary" : "btn-outline"
                    }`}
                >
                  Simple
                </button>
                <button
                  onClick={() => setMainMode("advanced")}
                  className={`btn btn-sm join-item touch-manipulation ${mainMode === "advanced" ? "btn-primary" : "btn-outline"
                    }`}
                >
                  Basic
                </button>
              </div>

              {mainMode === "simple" && (
                <div className="block join">
                  <button
                    onClick={() => setSimpleMode("melody")}
                    className={`btn btn-sm join-item touch-manipulation ${simpleMode === "melody" ? "btn-success" : "btn-outline"
                      }`}
                  >
                    Notes{" "}
                    <kbd className="kbd kbd-xs">
                      {shortcuts.toggleMelodyChord.key.toUpperCase()}
                    </kbd>
                  </button>
                  <button
                    onClick={() => setSimpleMode("chord")}
                    className={`btn btn-sm join-item touch-manipulation ${simpleMode === "chord" ? "btn-success" : "btn-outline"
                      }`}
                  >
                    Chord{" "}
                    <kbd className="kbd kbd-xs">
                      {shortcuts.toggleMelodyChord.key.toUpperCase()}
                    </kbd>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="card-title text-base">Controls</h3>

            <div className="flex items-start gap-3 flex-wrap">

              <div className="flex items-center gap-2">
                <label className="label py-1">
                  <span className="label-text text-sm">
                    Octave: {currentOctave}
                  </span>
                </label>
                <div className="join">
                  <button
                    onClick={() =>
                      setCurrentOctave(Math.max(0, currentOctave - 1))
                    }
                    className="btn btn-sm btn-outline join-item touch-manipulation"
                  >
                    - <kbd className="kbd kbd-xs">Z</kbd>
                  </button>
                  <button
                    onClick={() =>
                      setCurrentOctave(Math.min(8, currentOctave + 1))
                    }
                    className="btn btn-sm btn-outline join-item touch-manipulation"
                  >
                    + <kbd className="kbd kbd-xs">X</kbd>
                  </button>
                </div>
              </div>

              {mainMode === "simple" && simpleMode === "chord" && (
                <div className="flex items-center gap-2">
                  <label className="label py-1">
                    <span className="label-text text-sm">
                      Voicing: {chordVoicing}
                    </span>
                  </label>
                  <div className="join">
                    <button
                      onClick={() =>
                        setChordVoicing(Math.max(-2, chordVoicing - 1))
                      }
                      className="btn btn-sm btn-outline join-item touch-manipulation"
                    >
                      - <kbd className="kbd kbd-xs">C</kbd>
                    </button>
                    <button
                      onClick={() =>
                        setChordVoicing(Math.min(4, chordVoicing + 1))
                      }
                      className="btn btn-sm btn-outline join-item touch-manipulation"
                    >
                      + <kbd className="kbd kbd-xs">V</kbd>
                    </button>
                  </div>
                </div>
              )}


              <div className="join">
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (keyboardStateData.sustainToggle) {
                      // If toggle mode is active, sustain button stops current sustained notes
                      // This creates the "inverse" behavior where tapping sustain stops sound
                      onStopSustainedNotes();
                      // Also temporarily turn off sustain to communicate with remote users
                      // then immediately turn it back on to maintain the toggle state
                      keyboardStateData.setSustain(false);
                      // Use setTimeout to ensure the sustain off message is sent before turning it back on
                      setTimeout(() => {
                        keyboardStateData.setSustain(true);
                      }, 10);
                    } else {
                      // Normal momentary sustain behavior
                      keyboardStateData.setSustain(true);
                    }
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    if (keyboardStateData.sustainToggle) {
                      // If toggle mode is active, releasing sustain should resume sustain mode
                      // This creates the "inverse" behavior where lifting sustain resumes sustain
                      keyboardStateData.setSustain(true);
                    } else {
                      // Normal momentary sustain behavior - turn off sustain
                      keyboardStateData.setSustain(false);
                      onStopSustainedNotes();
                    }
                  }}
                  onMouseLeave={() => {
                    if (!keyboardStateData.sustainToggle) {
                      keyboardStateData.setSustain(false);
                      onStopSustainedNotes();
                    }
                  }}
                  {...useTouchEvents(
                    () => {
                      if (keyboardStateData.sustainToggle) {
                        // If toggle mode is active, tapping sustain stops current sustained notes
                        onStopSustainedNotes();
                        // Also temporarily turn off sustain to communicate with remote users
                        // then immediately turn it back on to maintain the toggle state
                        keyboardStateData.setSustain(false);
                        // Use setTimeout to ensure the sustain off message is sent before turning it back on
                        setTimeout(() => {
                          keyboardStateData.setSustain(true);
                        }, 10);
                      } else {
                        keyboardStateData.setSustain(true);
                      }
                    },
                    () => {
                      if (keyboardStateData.sustainToggle) {
                        // If toggle mode is active, releasing sustain should resume sustain mode
                        keyboardStateData.setSustain(true);
                      } else {
                        keyboardStateData.setSustain(false);
                        onStopSustainedNotes();
                      }
                    }
                  )}
                  className={`btn btn-sm join-item touch-manipulation select-none ${(keyboardStateData.sustain &&
                      !keyboardStateData.sustainToggle) ||
                      (keyboardStateData.sustainToggle &&
                        keyboardStateData.hasSustainedNotes)
                      ? "btn-warning"
                      : "btn-outline"
                    }`}
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    touchAction: 'manipulation'
                  }}
                >
                  Sustain <kbd className="kbd kbd-xs">Space</kbd>
                </button>
                <button
                  onClick={() => {
                    keyboardStateData.setSustainToggle(
                      !keyboardStateData.sustainToggle
                    );
                  }}
                  className={`btn btn-sm join-item touch-manipulation ${keyboardStateData.sustainToggle
                      ? "btn-success"
                      : "btn-outline"
                    }`}
                >
                  {keyboardStateData.sustainToggle ? "🔒" : "🔓"}
                  <kbd className="kbd kbd-xs">'</kbd>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="label py-1">
                  <span className="label-text text-sm">
                    Velocity: {Math.round(velocity * 9)}
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="9"
                  value={Math.round(velocity * 9)}
                  onChange={(e) => setVelocity(parseInt(e.target.value) / 9)}
                  className="range range-sm range-primary w-20"
                />
              </div>

            </div>
          </div>
        </div>

        <div className="bg-neutral p-4 rounded-lg shadow-2xl overflow-auto">
          {renderVirtualKeyboard()}
        </div>

        <ShortcutConfig
          isOpen={showShortcutConfig}
          onClose={() => setShowShortcutConfig(false)}
        />
      </div>
    </div>
  );
}
