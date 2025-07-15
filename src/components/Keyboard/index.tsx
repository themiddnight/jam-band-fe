import { useEffect, useState } from "react";
import { useVirtualKeyboard } from "./hooks/useVirtualKeyboard";
import { useKeyboardKeysController } from "./hooks/useKeyboardKeysController";
import { useKeyboardState } from "./hooks/useKeyboardState";
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
}

export default function Keyboard({
  scaleState,
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
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
  });

  const virtualKeyboard = useVirtualKeyboard(
    scaleState.getScaleNotes,
    scaleState.rootNote,
    scaleState.scale,
    onPlayNotes,
    onReleaseKeyHeldNote
  );

  const {
    mainMode, setMainMode,
    simpleMode, setSimpleMode,
    currentOctave, setCurrentOctave,
    velocity, setVelocity,
    chordVoicing, setChordVoicing,
    chordModifiers, setChordModifiers,
    pressedTriads, setPressedTriads,
    activeTriadChords, setActiveTriadChords,
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

  const virtualKeys = virtualKeyboard.generateVirtualKeys();

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
    <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-4xl">
      <div className="flex justify-around gap-3 mb-3 flex-wrap">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Mode Controls</h3>
            <button
              onClick={() => setShowShortcutConfig(true)}
              className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
              title="Configure keyboard shortcuts"
            >
              ⚙️ Settings
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMainMode("simple")}
              className={`px-4 py-2 rounded ${mainMode === "simple"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
                }`}
            >
              Simple
            </button>
            <button
              onClick={() => setMainMode("advanced")}
              className={`px-4 py-2 rounded ${mainMode === "advanced"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
                }`}
            >
              Advanced
            </button>
          </div>

          {mainMode === "simple" && (
            <div className="flex gap-2">
              <button
                onClick={() => setSimpleMode("melody")}
                className={`px-3 py-1 text-sm rounded ${simpleMode === "melody"
                    ? "bg-green-500 text-white"
                    : "bg-gray-200"
                  }`}
              >
                Melody ({shortcuts.toggleMelodyChord.key.toUpperCase()})
              </button>
              <button
                onClick={() => setSimpleMode("chord")}
                className={`px-3 py-1 text-sm rounded ${simpleMode === "chord"
                    ? "bg-green-500 text-white"
                    : "bg-gray-200"
                  }`}
              >
                Chord ({shortcuts.toggleMelodyChord.key.toUpperCase()})
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">Controls</h3>
          <div className="flex items-start gap-4">
            <div className="space-y-2">

              <div className="flex items-center gap-2">
                <span className="text-sm">
                  Velocity: {Math.round(velocity * 9)}
                </span>
                <input
                  type="range"
                  min="1"
                  max="9"
                  value={Math.round(velocity * 9)}
                  onChange={(e) => setVelocity(parseInt(e.target.value) / 9)}
                  className="w-20"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">Octave: {currentOctave}</span>
                <button
                  onClick={() => setCurrentOctave(Math.max(0, currentOctave - 1))}
                  className="px-2 py-1 bg-gray-200 rounded text-sm"
                >
                  Z (-)
                </button>
                <button
                  onClick={() => setCurrentOctave(Math.min(8, currentOctave + 1))}
                  className="px-2 py-1 bg-gray-200 rounded text-sm"
                >
                  X (+)
                </button>
              </div>

              {mainMode === "simple" && simpleMode === "chord" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Voicing: {chordVoicing}</span>
                  <button
                    onClick={() => setChordVoicing(Math.max(-2, chordVoicing - 1))}
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                  >
                    C (-)
                  </button>
                  <button
                    onClick={() => setChordVoicing(Math.min(4, chordVoicing + 1))}
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                  >
                    V (+)
                  </button>
                </div>
              )}
            </div>
            <button
              onMouseDown={() => {
                if (keyboardStateData.sustainToggle) {
                  // If toggle mode is active, sustain button only stops current sustained notes
                  onStopSustainedNotes();
                } else {
                  // Normal momentary sustain behavior
                  keyboardStateData.setSustain(true);
                }
              }}
              onMouseUp={() => {
                if (!keyboardStateData.sustainToggle) {
                  // Only stop sustain on button release if not in toggle mode
                  keyboardStateData.setSustain(false);
                }
              }}
              className={`px-4 py-2 rounded ${(keyboardStateData.sustain && !keyboardStateData.sustainToggle) || (keyboardStateData.sustainToggle && keyboardStateData.hasSustainedNotes) ? "bg-yellow-500 text-white" : "bg-gray-200"
                }`}
            >
              Sustain (Space)
            </button>
            <button
              onClick={() => {
                keyboardStateData.setSustainToggle(!keyboardStateData.sustainToggle);
              }}
              className={`px-4 py-2 rounded ${keyboardStateData.sustainToggle ? "bg-green-500 text-white" : "bg-gray-200"
                }`}
            >
              Toggle Sustain (')
            </button>

          </div>
        </div>

      </div>

      <div className="bg-black p-4 rounded-lg shadow-2xl">
        {renderVirtualKeyboard()}
      </div>
      
      <ShortcutConfig 
        isOpen={showShortcutConfig}
        onClose={() => setShowShortcutConfig(false)}
      />
    </div>
  );
}
