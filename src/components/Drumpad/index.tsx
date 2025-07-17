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
  availableSamples: string[];
}

export default function Drumpad({
  onPlayNotes,
  onReleaseKeyHeldNote,
  availableSamples,
}: DrumpadProps) {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());

  // Create drum pads based on available samples
  const createDrumPads = () => {
    const colors = [
      "bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-orange-500", 
      "bg-green-500", "bg-purple-500", "bg-indigo-500", "bg-pink-500",
      "bg-teal-500", "bg-cyan-500", "bg-lime-500", "bg-amber-500"
    ];
    
    return availableSamples.map((sample, index) => {
      // Create a display label from the sample name
      const label = sample.replace(/-/g, ' ').replace(/\d+/g, '').trim();
      const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
      
      return {
        id: sample,
        label: displayLabel || sample,
        color: colors[index % colors.length],
      };
    });
  };

  const drumPads = createDrumPads();

  // Show message if no samples are available
  if (availableSamples.length === 0) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-4xl text-center">
        <h3 className="font-semibold text-gray-700 mb-2">Loading drum samples...</h3>
        <p className="text-gray-500 text-sm">Please wait while the drum machine loads.</p>
      </div>
    );
  }

  const handlePadPress = async (padId: string) => {
    setPressedPads(new Set([...pressedPads, padId]));
    // Use drum sample name (padId) for drum machines
    await onPlayNotes([padId], velocity, true);
  };

  const handlePadRelease = (padId: string) => {
    const newPressedPads = new Set(pressedPads);
    newPressedPads.delete(padId);
    setPressedPads(newPressedPads);
    // Use drum sample name (padId) for drum machines
    onReleaseKeyHeldNote(padId);
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
          <div className="text-xs text-gray-500">
            {availableSamples.length} samples available
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {drumPads.map((pad) => {
          const isPressed = pressedPads.has(pad.id);
          
          return (
            <button
              key={pad.id}
              onMouseDown={() => handlePadPress(pad.id)}
              onMouseUp={() => handlePadRelease(pad.id)}
              onMouseLeave={() => handlePadRelease(pad.id)}
              className={`h-24 rounded-lg border-2 border-gray-300 flex flex-col items-center justify-center transition-all ${
                isPressed 
                  ? `${pad.color} text-white scale-95` 
                  : `${pad.color.replace('bg-', 'bg-')} text-white hover:scale-105`
              }`}
            >
              <span className="font-bold text-lg">{pad.label}</span>
              <span className="text-xs opacity-75">{pad.id}</span>
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