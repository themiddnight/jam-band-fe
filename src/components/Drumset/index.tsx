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
  availableSamples: string[];
}

export default function Drumset({
  onPlayNotes,
  onReleaseKeyHeldNote,
  availableSamples,
}: DrumsetProps) {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [pressedDrums, setPressedDrums] = useState<Set<string>>(new Set());

  // Map available samples to drum positions
  const mapSamplesToDrums = () => {
    const sampleMap: { [key: string]: string } = {};
    
    availableSamples.forEach(sample => {
      const lowerSample = sample.toLowerCase();
      if (lowerSample.includes('kick') || lowerSample.includes('bd')) {
        sampleMap.kick = sample;
      } else if (lowerSample.includes('snare') || lowerSample.includes('sd')) {
        sampleMap.snare = sample;
      } else if (lowerSample.includes('hihat') || lowerSample.includes('hh')) {
        sampleMap.hihat = sample;
      } else if (lowerSample.includes('crash') || lowerSample.includes('cr')) {
        sampleMap.crash = sample;
      } else if (lowerSample.includes('ride') || lowerSample.includes('rd')) {
        sampleMap.ride = sample;
      } else if (lowerSample.includes('tom') || lowerSample.includes('mt') || lowerSample.includes('ht') || lowerSample.includes('lt')) {
        if (!sampleMap.tom1) sampleMap.tom1 = sample;
        else if (!sampleMap.tom2) sampleMap.tom2 = sample;
        else if (!sampleMap.tom3) sampleMap.tom3 = sample;
      }
    });
    
    return sampleMap;
  };

  const drumMapping = mapSamplesToDrums();

  const handleDrumPress = async (drumId: string) => {
    const actualSample = drumMapping[drumId] || drumId;
    if (actualSample) {
      setPressedDrums(new Set([...pressedDrums, drumId]));
      // Use the mapped sample name for drum machines
      await onPlayNotes([actualSample], velocity, true);
    }
  };

  const handleDrumRelease = (drumId: string) => {
    const actualSample = drumMapping[drumId] || drumId;
    if (actualSample) {
      const newPressedDrums = new Set(pressedDrums);
      newPressedDrums.delete(drumId);
      setPressedDrums(newPressedDrums);
      // Use the mapped sample name for drum machines
      onReleaseKeyHeldNote(actualSample);
    }
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
            onMouseDown={() => handleDrumPress("crash")}
            onMouseUp={() => handleDrumRelease("crash")}
            onMouseLeave={() => handleDrumRelease("crash")}
            disabled={!drumMapping.crash}
            className={`w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              !drumMapping.crash 
                ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                : pressedDrums.has("crash") 
                ? "bg-orange-500 text-white scale-95" 
                : "bg-orange-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Crash</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("ride")}
            onMouseUp={() => handleDrumRelease("ride")}
            onMouseLeave={() => handleDrumRelease("ride")}
            className={`w-20 h-20 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("ride") 
                ? "bg-indigo-500 text-white scale-95" 
                : "bg-indigo-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Ride</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("splash")}
            onMouseUp={() => handleDrumRelease("splash")}
            onMouseLeave={() => handleDrumRelease("splash")}
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
            onMouseDown={() => handleDrumPress("tom1")}
            onMouseUp={() => handleDrumRelease("tom1")}
            onMouseLeave={() => handleDrumRelease("tom1")}
            className={`w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("tom1") 
                ? "bg-green-500 text-white scale-95" 
                : "bg-green-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Tom 1</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("tom2")}
            onMouseUp={() => handleDrumRelease("tom2")}
            onMouseLeave={() => handleDrumRelease("tom2")}
            className={`w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("tom2") 
                ? "bg-purple-500 text-white scale-95" 
                : "bg-purple-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Tom 2</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("tom3")}
            onMouseUp={() => handleDrumRelease("tom3")}
            onMouseLeave={() => handleDrumRelease("tom3")}
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
            onMouseDown={() => handleDrumPress("snare")}
            onMouseUp={() => handleDrumRelease("snare")}
            onMouseLeave={() => handleDrumRelease("snare")}
            className={`w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("snare") 
                ? "bg-blue-600 text-white scale-95" 
                : "bg-blue-600 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Snare</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("kick")}
            onMouseUp={() => handleDrumRelease("kick")}
            onMouseLeave={() => handleDrumRelease("kick")}
            className={`w-20 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all ${
              pressedDrums.has("kick") 
                ? "bg-red-500 text-white scale-95" 
                : "bg-red-500 text-white hover:scale-105"
            }`}
          >
            <span className="text-xs font-bold">Kick</span>
          </button>
          
          <button
            onMouseDown={() => handleDrumPress("hihat")}
            onMouseUp={() => handleDrumRelease("hihat")}
            onMouseLeave={() => handleDrumRelease("hihat")}
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