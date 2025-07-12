import { useCallback, useEffect } from "react";
import { NOTE_NAMES, useScaleState } from "../../hooks/useScaleState";
import { useKeyboardState } from "./hooks/useKeyboardState";
import { useVirtualKeyboard, chordTriadKeys } from "./hooks/useVirtualKeyboard";
import { useKeyboardKeyboard } from "./hooks/useKeyboardKeyboard";
import { MelodyKeys } from "./components/MelodyKeys";
import { ChordKeys } from "./components/ChordKeys";
import { AdvancedKeys } from "./components/AdvancedKeys";

export default function Keyboard() {
  const keyboardState = useKeyboardState();
  const scaleState = useScaleState();
  const virtualKeyboard = useVirtualKeyboard(
    keyboardState.mainMode,
    keyboardState.simpleMode,
    scaleState.getScaleNotes,
    scaleState.rootNote,
    scaleState.scale,
    keyboardState.currentOctave
  );

  const { handleKeyDown, handleKeyUp } = useKeyboardKeyboard(keyboardState, scaleState, virtualKeyboard);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleVirtualKeyPress = useCallback((key: any) => {
    if (
      keyboardState.mainMode === "simple" &&
      keyboardState.simpleMode === "chord" &&
      chordTriadKeys.some((k) => k === key.keyboardKey)
    ) {
      const keyIndex = chordTriadKeys.indexOf(key.keyboardKey!);
      const chord = virtualKeyboard.getChord(
        scaleState.rootNote,
        scaleState.scale,
        keyIndex,
        3,
        virtualKeyboard.chordVoicing,
        virtualKeyboard.chordModifiers
      );
      chord.forEach((note) => keyboardState.playNote(note, keyboardState.velocity, keyboardState.sustain));
    } else {
      keyboardState.playNote(key.note, keyboardState.velocity, keyboardState.sustain);
    }
  }, [keyboardState, scaleState, virtualKeyboard]);

  const handleTriadPress = useCallback((index: number) => {
    const chord = virtualKeyboard.getChord(
      scaleState.rootNote,
      scaleState.scale,
      index,
      3,
      virtualKeyboard.chordVoicing,
      virtualKeyboard.chordModifiers
    );
    chord.forEach((note) => keyboardState.playNote(note, keyboardState.velocity, keyboardState.sustain));
  }, [keyboardState, scaleState, virtualKeyboard]);

  const virtualKeys = virtualKeyboard.generateVirtualKeys();

  const renderVirtualKeyboard = () => {
    if (keyboardState.mainMode === "simple" && keyboardState.simpleMode === "chord") {
      return (
        <ChordKeys
          virtualKeys={virtualKeys}
          pressedKeys={keyboardState.pressedKeys}
          pressedTriads={virtualKeyboard.pressedTriads}
          chordModifiers={virtualKeyboard.chordModifiers}
          scale={scaleState.scale}
          onKeyPress={handleVirtualKeyPress}
          onTriadPress={handleTriadPress}
        />
      );
    } else if (keyboardState.mainMode === "simple") {
      return (
        <MelodyKeys
          virtualKeys={virtualKeys}
          pressedKeys={keyboardState.pressedKeys}
          onKeyPress={handleVirtualKeyPress}
        />
      );
    } else {
      return (
        <AdvancedKeys
          virtualKeys={virtualKeys}
          pressedKeys={keyboardState.pressedKeys}
          onKeyPress={handleVirtualKeyPress}
        />
      );
    }
  };

  return (
    <div className="flex flex-col items-center p-8 bg-gray-100 min-h-screen">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">Keyboard Player</h2>

      <div className="bg-white p-6 rounded-lg shadow-lg mb-6 w-full max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Mode Controls</h3>
            <div className="flex gap-2">
              <button
                onClick={() => keyboardState.setMainMode("simple")}
                className={`px-4 py-2 rounded ${
                  keyboardState.mainMode === "simple"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => keyboardState.setMainMode("advanced")}
                className={`px-4 py-2 rounded ${
                  keyboardState.mainMode === "advanced"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                Advanced
              </button>
            </div>

            {keyboardState.mainMode === "simple" && (
              <div className="flex gap-2">
                <button
                  onClick={() => keyboardState.setSimpleMode("melody")}
                  className={`px-3 py-1 text-sm rounded ${
                    keyboardState.simpleMode === "melody"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Melody (/)
                </button>
                <button
                  onClick={() => keyboardState.setSimpleMode("chord")}
                  className={`px-3 py-1 text-sm rounded ${
                    keyboardState.simpleMode === "chord"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Chord (/)
                </button>
              </div>
            )}
          </div>

          {keyboardState.mainMode === "simple" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700">Scale</h3>
              <div className="flex gap-2">
                <select
                  value={scaleState.rootNote}
                  onChange={(e) => scaleState.setRootNote(e.target.value)}
                  className="px-3 py-2 border rounded"
                >
                  {NOTE_NAMES.map((note) => (
                    <option key={note} value={note}>
                      {note}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => scaleState.setScale("major")}
                  className={`px-4 py-2 rounded ${
                    scaleState.scale === "major"
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Major
                </button>
                <button
                  onClick={() => scaleState.setScale("minor")}
                  className={`px-4 py-2 rounded ${
                    scaleState.scale === "minor"
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Minor
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Controls</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Octave: {keyboardState.currentOctave}</span>
                <button
                  onClick={() =>
                    keyboardState.setCurrentOctave((prev) => Math.max(0, prev - 1))
                  }
                  className="px-2 py-1 bg-gray-200 rounded text-sm"
                >
                  Z (-)
                </button>
                <button
                  onClick={() =>
                    keyboardState.setCurrentOctave((prev) => Math.min(8, prev + 1))
                  }
                  className="px-2 py-1 bg-gray-200 rounded text-sm"
                >
                  X (+)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">
                  Velocity: {Math.round(keyboardState.velocity * 9)}
                </span>
                <input
                  type="range"
                  min="1"
                  max="9"
                  value={Math.round(keyboardState.velocity * 9)}
                  onChange={(e) => keyboardState.setVelocity(parseInt(e.target.value) / 9)}
                  className="w-20"
                />
              </div>

              <button
                onMouseDown={() => keyboardState.setSustain(true)}
                onMouseUp={() => {
                  keyboardState.setSustain(false);
                  keyboardState.stopSustainedNotes();
                }}
                className={`px-4 py-2 rounded ${
                  keyboardState.sustain ? "bg-yellow-500 text-white" : "bg-gray-200"
                }`}
              >
                Sustain (Space)
              </button>

              {keyboardState.mainMode === "simple" && keyboardState.simpleMode === "chord" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Voicing: {virtualKeyboard.chordVoicing}</span>
                  <button
                    onClick={() =>
                      virtualKeyboard.setChordVoicing((prev) => Math.max(-2, prev - 1))
                    }
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                  >
                    C (-)
                  </button>
                  <button
                    onClick={() =>
                      virtualKeyboard.setChordVoicing((prev) => Math.min(2, prev + 1))
                    }
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                  >
                    V (+)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black p-4 rounded-lg shadow-2xl">
        {renderVirtualKeyboard()}

        <div className="mt-4 text-center">
          <p className="text-white text-sm">
            {keyboardState.mainMode === "simple"
              ? keyboardState.simpleMode === "melody"
                ? "Play melody notes"
                : "Play root notes and chords"
              : "Play chromatic notes"}
          </p>
        </div>
      </div>
    </div>
  );
}
