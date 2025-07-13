import { useCallback, useEffect, useState } from "react";
import { useVirtualKeyboard, chordTriadKeys } from "./hooks/useVirtualKeyboard";
import { useKeyboardKeyboard } from "./hooks/useKeyboardKeyboard";
import { MelodyKeys } from "./components/MelodyKeys";
import { ChordKeys } from "./components/ChordKeys";
import { AdvancedKeys } from "./components/AdvancedKeys";
import type { MainMode, SimpleMode, KeyboardKey } from "./types/keyboard";
import type { Scale } from "../../hooks/useScaleState";

export interface VirtualKeyboardProps {
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

export default function VirtualKeyboard({
  scaleState,
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
}: VirtualKeyboardProps) {
  // Internal state management
  const [mainMode, setMainMode] = useState<MainMode>("simple");
  const [simpleMode, setSimpleMode] = useState<SimpleMode>("melody");
  const [currentOctave, setCurrentOctave] = useState<number>(2);
  const [velocity, setVelocity] = useState<number>(0.7);
  const [sustain, setSustain] = useState<boolean>(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [heldKeys, setHeldKeys] = useState<Set<string>>(new Set());
  const [chordVoicing, setChordVoicing] = useState<number>(0);
  const [chordModifiers, setChordModifiers] = useState<Set<string>>(new Set());
  const [pressedTriads, setPressedTriads] = useState<Set<number>>(new Set());
  const [activeTriadChords, setActiveTriadChords] = useState<Map<number, string[]>>(new Map());

  const virtualKeyboard = useVirtualKeyboard(
    mainMode,
    simpleMode,
    scaleState.getScaleNotes,
    scaleState.rootNote,
    scaleState.scale,
    currentOctave
  );

  // Create a keyboard state object that matches the interface expected by useKeyboardKeyboard
  const keyboardState = {
    mainMode,
    simpleMode,
    currentOctave,
    velocity,
    sustain,
    pressedKeys,
    heldKeys,
    setHeldKeys,
    setMainMode,
    setSimpleMode,
    setCurrentOctave,
    setVelocity,
    setSustain: (newSustain: boolean) => {
      setSustain(newSustain);
      onSustainChange(newSustain);
    },
    setPressedKeys,
    playNote: (note: string, vel: number = velocity, isKeyHeld: boolean = false) => {
      onPlayNotes([note], vel, isKeyHeld);
      if (isKeyHeld) {
        setPressedKeys(new Set([...pressedKeys, note]));
      }
    },
    stopNote: (note: string) => {
      onStopNotes([note]);
      const newPressedKeys = new Set(pressedKeys);
      newPressedKeys.delete(note);
      setPressedKeys(newPressedKeys);
    },
    releaseKeyHeldNote: (note: string) => {
      onReleaseKeyHeldNote(note);
      const newPressedKeys = new Set(pressedKeys);
      newPressedKeys.delete(note);
      setPressedKeys(newPressedKeys);
    },
    stopSustainedNotes: () => {
      onStopSustainedNotes();
      setSustain(false);
    },
  };

  const { handleKeyDown, handleKeyUp } = useKeyboardKeyboard(keyboardState, scaleState, {
    ...virtualKeyboard,
    chordVoicing,
    setChordVoicing,
    chordModifiers,
    setChordModifiers,
    pressedTriads,
    setPressedTriads,
    activeTriadChords,
    setActiveTriadChords,
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleVirtualKeyPress = useCallback((key: KeyboardKey) => {
    if (
      mainMode === "simple" &&
      simpleMode === "chord" &&
      chordTriadKeys.some((k) => k === key.keyboardKey)
    ) {
      const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
      const chord = virtualKeyboard.getChord(
        scaleState.rootNote,
        scaleState.scale,
        keyIndex,
        3,
        chordVoicing,
        chordModifiers
      );
      onPlayNotes(chord, velocity, true); // isKeyHeld = true for chord keys
    } else {
      onPlayNotes([key.note], velocity, true); // isKeyHeld = true for virtual key presses
    }
  }, [mainMode, simpleMode, scaleState, virtualKeyboard, chordVoicing, chordModifiers, velocity, onPlayNotes]);

  const handleTriadPress = useCallback((index: number) => {
    const chord = virtualKeyboard.getChord(
      scaleState.rootNote,
      scaleState.scale,
      index,
      3,
      chordVoicing,
      chordModifiers
    );
    onPlayNotes(chord, velocity, true); // isKeyHeld = true for triad presses
  }, [scaleState, virtualKeyboard, chordVoicing, chordModifiers, velocity, onPlayNotes]);

  const virtualKeys = virtualKeyboard.generateVirtualKeys();

  const renderVirtualKeyboard = () => {
    if (mainMode === "simple" && simpleMode === "chord") {
      return (
        <ChordKeys
          virtualKeys={virtualKeys}
          pressedKeys={pressedKeys}
          pressedTriads={pressedTriads}
          chordModifiers={chordModifiers}
          scale={scaleState.scale}
          onKeyPress={handleVirtualKeyPress}
          onTriadPress={handleTriadPress}
        />
      );
    } else if (mainMode === "simple") {
      return (
        <MelodyKeys
          virtualKeys={virtualKeys}
          pressedKeys={pressedKeys}
          onKeyPress={handleVirtualKeyPress}
        />
      );
    } else {
      return (
        <AdvancedKeys
          virtualKeys={virtualKeys}
          pressedKeys={pressedKeys}
          onKeyPress={handleVirtualKeyPress}
        />
      );
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mb-6 w-full max-w-4xl">
      <div className="flex justify-around gap-6 mb-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">Mode Controls</h3>
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
                Melody (/)
              </button>
              <button
                onClick={() => setSimpleMode("chord")}
                className={`px-3 py-1 text-sm rounded ${simpleMode === "chord"
                    ? "bg-green-500 text-white"
                    : "bg-gray-200"
                  }`}
              >
                Chord (/)
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
                    onClick={() => setChordVoicing(Math.min(2, chordVoicing + 1))}
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                  >
                    V (+)
                  </button>
                </div>
              )}
            </div>
            <button
              onMouseDown={() => {
                setSustain(true);
                onSustainChange(true);
              }}
              onMouseUp={() => {
                setSustain(false);
                onSustainChange(false);
              }}
              className={`px-4 py-2 rounded ${sustain ? "bg-yellow-500 text-white" : "bg-gray-200"
                }`}
            >
              Sustain (Space)
            </button>

          </div>
        </div>

      </div>

      <div className="bg-black p-4 rounded-lg shadow-2xl">
        {renderVirtualKeyboard()}
      </div>
    </div>
  );
}
