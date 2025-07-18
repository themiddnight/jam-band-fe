import { memo } from 'react';
import type { MainMode, SimpleMode } from '../types/keyboard';

interface KeyboardControlsProps {
  mainMode: MainMode;
  setMainMode: (mode: MainMode) => void;
  simpleMode: SimpleMode;
  setSimpleMode: (mode: SimpleMode) => void;
  currentOctave: number;
  setCurrentOctave: (octave: number) => void;
  velocity: number;
  setVelocity: (velocity: number) => void;
  chordVoicing: number;
  setChordVoicing: (voicing: number) => void;
  sustain: boolean;
  sustainToggle: boolean;
  hasSustainedNotes: boolean;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (toggle: boolean) => void;
  onStopSustainedNotes: () => void;
  onShowShortcutConfig: () => void;
}

export const KeyboardControls = memo<KeyboardControlsProps>(({
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
  sustain,
  sustainToggle,
  hasSustainedNotes,
  setSustain,
  setSustainToggle,
  onStopSustainedNotes,
  onShowShortcutConfig,
}) => {
  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Keyboard</h2>
        <button
          onClick={onShowShortcutConfig}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Shortcuts
        </button>
      </div>

      <div className="space-y-4">
        {/* Mode Selection */}
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-700">Mode</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setMainMode("simple")}
              className={`px-4 py-2 rounded ${
                mainMode === "simple"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              Simple
            </button>
            <button
              onClick={() => setMainMode("advanced")}
              className={`px-4 py-2 rounded ${
                mainMode === "advanced"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              Advanced
            </button>
          </div>

          {mainMode === "simple" && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setSimpleMode("melody")}
                className={`px-3 py-1 rounded text-sm ${
                  simpleMode === "melody"
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                Melody
              </button>
              <button
                onClick={() => setSimpleMode("chord")}
                className={`px-3 py-1 rounded text-sm ${
                  simpleMode === "chord"
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                Chord
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">Controls</h3>
          <div className="flex items-start gap-4">
            <div className="space-y-2">
              {/* Velocity Control */}
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

              {/* Octave Control */}
              <div className="flex items-center gap-2">
                <span className="text-sm">Octave: {currentOctave}</span>
                <button
                  onClick={() => setCurrentOctave(Math.max(0, currentOctave - 1))}
                  className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                >
                  Z (-)
                </button>
                <button
                  onClick={() => setCurrentOctave(Math.min(8, currentOctave + 1))}
                  className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                >
                  X (+)
                </button>
              </div>

              {/* Chord Voicing Control */}
              {mainMode === "simple" && simpleMode === "chord" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Voicing: {chordVoicing}</span>
                  <button
                    onClick={() => setChordVoicing(Math.max(-2, chordVoicing - 1))}
                    className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                  >
                    C (-)
                  </button>
                  <button
                    onClick={() => setChordVoicing(Math.min(4, chordVoicing + 1))}
                    className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                  >
                    V (+)
                  </button>
                </div>
              )}
            </div>

            {/* Sustain Controls */}
            <div className="flex gap-2">
              <button
                onMouseDown={() => {
                  if (sustainToggle) {
                    // If toggle mode is active, sustain button only stops current sustained notes
                    onStopSustainedNotes();
                  } else {
                    // Normal momentary sustain behavior
                    setSustain(true);
                  }
                }}
                onMouseUp={() => {
                  if (!sustainToggle) {
                    // Only stop sustain on button release if not in toggle mode
                    setSustain(false);
                  }
                }}
                className={`px-4 py-2 rounded transition-colors ${
                  (sustain && !sustainToggle) || (sustainToggle && hasSustainedNotes)
                    ? "bg-yellow-500 text-white" 
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                Sustain (Space)
              </button>
              <button
                onClick={() => setSustainToggle(!sustainToggle)}
                className={`px-4 py-2 rounded transition-colors ${
                  sustainToggle 
                    ? "bg-green-500 text-white" 
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                Toggle Sustain (')
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

KeyboardControls.displayName = 'KeyboardControls'; 