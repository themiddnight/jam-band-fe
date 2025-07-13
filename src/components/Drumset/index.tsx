import { useState } from "react";
import type { Scale } from "../../hooks/useScaleState";

export interface DrumsetProps {
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
}

export default function Drumset({
  onPlayNotes,
  onReleaseKeyHeldNote,
}: DrumsetProps) {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [pressedDrums, setPressedDrums] = useState<Set<string>>(new Set());

  const drumKit = [
    // Cymbals (top row)
    { id: "crash", note: "C#3", label: "Crash", color: "bg-orange-500", size: "w-16 h-16" },
    { id: "ride", note: "D#3", label: "Ride", color: "bg-indigo-500", size: "w-20 h-20" },
    { id: "splash", note: "F#3", label: "Splash", color: "bg-yellow-400", size: "w-12 h-12" },
    
    // Toms (middle row)
    { id: "tom1", note: "E2", label: "Tom 1", color: "bg-green-500", size: "w-14 h-14" },
    { id: "tom2", note: "G2", label: "Tom 2", color: "bg-purple-500", size: "w-14 h-14" },
    { id: "tom3", note: "A2", label: "Tom 3", color: "bg-blue-500", size: "w-14 h-14" },
    
    // Snare and Hi-Hat (bottom row)
    { id: "snare", note: "D2", label: "Snare", color: "bg-blue-600", size: "w-16 h-16" },
    { id: "hihat", note: "F#2", label: "Hi-Hat", color: "bg-yellow-500", size: "w-14 h-14" },
    
    // Bass drum (bottom center)
    { id: "kick", note: "C2", label: "Kick", color: "bg-red-500", size: "w-20 h-12" },
  ];

  const handleDrumPress = (drumId: string, note: string) => {
    setPressedDrums(new Set([...pressedDrums, drumId]));
    onPlayNotes([note], velocity, true);
  };

  const handleDrumRelease = (drumId: string, note: string) => {
    const newPressedDrums = new Set(pressedDrums);
    newPressedDrums.delete(drumId);
    setPressedDrums(newPressedDrums);
    onReleaseKeyHeldNote(note);
  };

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-4xl">
      <div className="flex justify-around gap-3 mb-3 flex-wrap">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">Drum Kit Controls</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm">Velocity: {Math.round(velocity * 9)}</span>
            <input
              type="range"
              min="1"
              max="9"
              value={Math.round(velocity * 9)}
              onChange={(e) => setVelocity(parseInt(e.target.value) / 9)}
              className="w-20"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* Cymbals Row */}
        <div className="flex gap-4 items-center">
          <button
            onMouseDown={() => handleDrumPress("crash", "C#3")}
            onMouseUp={() => handleDrumRelease("crash", "C#3")}
            onMouseLeave={() => handleDrumRelease("crash", "C#3")}
            className={`w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("crash") 
                ? "bg-orange-500 text-white scale-95" 
                : "bg-orange-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Crash</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("ride", "D#3")}
            onMouseUp={() => handleDrumRelease("ride", "D#3")}
            onMouseLeave={() => handleDrumRelease("ride", "D#3")}
            className={`w-20 h-20 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("ride") 
                ? "bg-indigo-500 text-white scale-95" 
                : "bg-indigo-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Ride</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("splash", "F#3")}
            onMouseUp={() => handleDrumRelease("splash", "F#3")}
            onMouseLeave={() => handleDrumRelease("splash", "F#3")}
            className={`w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("splash") 
                ? "bg-yellow-400 text-white scale-95" 
                : "bg-yellow-400 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Splash</span>
          </button>
        </div>

        {/* Toms Row */}
        <div className="flex gap-4 items-center">
          <button
            onMouseDown={() => handleDrumPress("tom1", "E2")}
            onMouseUp={() => handleDrumRelease("tom1", "E2")}
            onMouseLeave={() => handleDrumRelease("tom1", "E2")}
            className={`w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("tom1") 
                ? "bg-green-500 text-white scale-95" 
                : "bg-green-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Tom 1</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("tom2", "G2")}
            onMouseUp={() => handleDrumRelease("tom2", "G2")}
            onMouseLeave={() => handleDrumRelease("tom2", "G2")}
            className={`w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("tom2") 
                ? "bg-purple-500 text-white scale-95" 
                : "bg-purple-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Tom 2</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("tom3", "A2")}
            onMouseUp={() => handleDrumRelease("tom3", "A2")}
            onMouseLeave={() => handleDrumRelease("tom3", "A2")}
            className={`w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("tom3") 
                ? "bg-blue-500 text-white scale-95" 
                : "bg-blue-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Tom 3</span>
          </button>
        </div>

        {/* Snare, Hi-Hat, and Kick Row */}
        <div className="flex gap-4 items-center">
          <button
            onMouseDown={() => handleDrumPress("snare", "D2")}
            onMouseUp={() => handleDrumRelease("snare", "D2")}
            onMouseLeave={() => handleDrumRelease("snare", "D2")}
            className={`w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("snare") 
                ? "bg-blue-600 text-white scale-95" 
                : "bg-blue-600 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Snare</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("kick", "C2")}
            onMouseUp={() => handleDrumRelease("kick", "C2")}
            onMouseLeave={() => handleDrumRelease("kick", "C2")}
            className={`w-20 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("kick") 
                ? "bg-red-500 text-white scale-95" 
                : "bg-red-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Kick</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("hihat", "F#2")}
            onMouseUp={() => handleDrumRelease("hihat", "F#2")}
            onMouseLeave={() => handleDrumRelease("hihat", "F#2")}
            className={`w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("hihat") 
                ? "bg-yellow-500 text-white scale-95" 
                : "bg-yellow-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Hi-Hat</span>
          </button>
        </div>
      </div>

      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Click on drum pieces to play drum kit sounds.</p>
      </div>
    </div>
  );
} 