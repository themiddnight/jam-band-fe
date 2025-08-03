import { useEffect } from "react";
import { useVirtualKeyboard } from "./hooks/useVirtualKeyboard";
import { useKeyboardKeysController } from "./hooks/useKeyboardKeysController";
import { useKeyboardState } from "./hooks/useKeyboardState";
import { MelodyKeys } from "./components/MelodyKeys";
import { ChordKeys } from "./components/ChordKeys";
import { AdvancedKeys } from "./components/AdvancedKeys";
import { getKeyDisplayName, DEFAULT_KEYBOARD_SHORTCUTS } from "../../constants/keyboardShortcuts";
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
  const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;

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

  // Create a keyboard state object that matches the interface expected by useKeyboardKeysController
  const keyboardState = {
    mainMode,
    simpleMode,
    currentOctave,
    velocity,
    sustain: keyboardStateData.sustain,
    sustainToggle: keyboardStateData.sustainToggle,
    hasSustainedNotes: keyboardStateData.hasSustainedNotes,
    heldKeys: keyboardStateData.heldKeys,
    setSustain: keyboardStateData.setSustain,
    setSustainToggle: keyboardStateData.setSustainToggle,
    setHeldKeys: keyboardStateData.setHeldKeys,
    setSimpleMode,
    setCurrentOctave,
    setVelocity,
    playNote: keyboardStateData.playNote,
    releaseKeyHeldNote: keyboardStateData.releaseKeyHeldNote,
    stopSustainedNotes: keyboardStateData.stopSustainedNotes,
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
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <h3 className="card-title text-base">Mode Controls</h3>
          </div>

          <div className="flex gap-3 flex-wrap justify-end">
            {mainMode === "simple" && (
              <div className="block join">
                <button
                  onClick={() => setSimpleMode("melody")}
                  className={`btn btn-sm join-item touch-manipulation ${simpleMode === "melody" ? "btn-success" : "btn-outline"
                    }`}
                >
                  Notes{" "}
                  <kbd className="kbd kbd-xs">
                    {getKeyDisplayName(shortcuts.toggleMelodyChord.key)}
                  </kbd>
                </button>
                <button
                  onClick={() => setSimpleMode("chord")}
                  className={`btn btn-sm join-item touch-manipulation ${simpleMode === "chord" ? "btn-success" : "btn-outline"
                    }`}
                >
                  Chord{" "}
                  <kbd className="kbd kbd-xs">
                    {getKeyDisplayName(shortcuts.toggleMelodyChord.key)}
                  </kbd>
                </button>
              </div>
            )}
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
          </div>
        </div>

        <div className="bg-neutral p-4 rounded-lg shadow-2xl overflow-auto">
          {renderVirtualKeyboard()}
        </div>

        <div className="flex justify-center items-center gap-3 flex-wrap mt-1">
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
              onTouchStart={(e) => {
                e.preventDefault();
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
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (keyboardStateData.sustainToggle) {
                  // If toggle mode is active, releasing sustain should resume sustain mode
                  keyboardStateData.setSustain(true);
                } else {
                  keyboardStateData.setSustain(false);
                  onStopSustainedNotes();
                }
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                if (keyboardStateData.sustainToggle) {
                  // If toggle mode is active, releasing sustain should resume sustain mode
                  keyboardStateData.setSustain(true);
                } else {
                  keyboardStateData.setSustain(false);
                  onStopSustainedNotes();
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
              }}
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
              Sustain <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.sustain.key)}</kbd>
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
              <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.sustainToggle.key)}</kbd>
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
                - <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.octaveDown.key)}</kbd>
              </button>
              <button
                onClick={() =>
                  setCurrentOctave(Math.min(8, currentOctave + 1))
                }
                className="btn btn-sm btn-outline join-item touch-manipulation"
              >
                + <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.octaveUp.key)}</kbd>
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
                  - <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.voicingDown.key)}</kbd>
                </button>
                <button
                  onClick={() =>
                    setChordVoicing(Math.min(4, chordVoicing + 1))
                  }
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  + <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.voicingUp.key)}</kbd>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
