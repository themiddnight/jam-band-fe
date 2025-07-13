import { useState } from "react";
import type { Scale } from "../../hooks/useScaleState";

export interface DrumpadProps {
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

export default function Drumpad({
  onPlayNotes,
  onReleaseKeyHeldNote,
}: DrumpadProps) {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());

  const drumPads = [
    { id: "kick", note: "C2", label: "Kick", color: "bg-red-500" },
    { id: "snare", note: "D2", label: "Snare", color: "bg-blue-500" },
    { id: "hihat", note: "F#2", label: "Hi-Hat", color: "bg-yellow-500" },
    { id: "crash", note: "C#3", label: "Crash", color: "bg-orange-500" },
    { id: "tom1", note: "E2", label: "Tom 1", color: "bg-green-500" },
    { id: "tom2", note: "G2", label: "Tom 2", color: "bg-purple-500" },
    { id: "ride", note: "D#3", label: "Ride", color: "bg-indigo-500" },
    { id: "floor", note: "A2", label: "Floor", color: "bg-pink-500" },
  ];

  const handlePadPress = (padId: string, note: string) => {
    setPressedPads(new Set([...pressedPads, padId]));
    onPlayNotes([note], velocity, true);
  };

  const handlePadRelease = (padId: string, note: string) => {
    const newPressedPads = new Set(pressedPads);
    newPressedPads.delete(padId);
    setPressedPads(newPressedPads);
    onReleaseKeyHeldNote(note);
  };

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-4xl">
      <div className="flex justify-around gap-3 mb-3 flex-wrap">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">Drum Pad Controls</h3>
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

      <div className="grid grid-cols-4 gap-3">
        {drumPads.map((pad) => {
          const isPressed = pressedPads.has(pad.id);
          
          return (
            <button
              key={pad.id}
              onMouseDown={() => handlePadPress(pad.id, pad.note)}
              onMouseUp={() => handlePadRelease(pad.id, pad.note)}
              onMouseLeave={() => handlePadRelease(pad.id, pad.note)}
              className={`h-24 rounded-lg border-2 border-gray-300 flex flex-col items-center justify-center transition-all ${
                isPressed 
                  ? `${pad.color} text-white scale-95` 
                  : `${pad.color.replace('bg-', 'bg-')} text-white hover:scale-105`
              }`}
            >
              <span className="font-bold text-lg">{pad.label}</span>
              <span className="text-xs opacity-75">{pad.note}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Click on drum pads to play percussive sounds.</p>
      </div>
    </div>
  );
} 