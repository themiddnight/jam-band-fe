import type { Scale } from "@/features/ui";
import { useTouchEvents } from "@/features/ui";
import { useState } from "react";

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

// Separate component for drum button to use hooks properly
const DrumButton: React.FC<{
  label: string;
  className: string;
  disabled?: boolean;
  onPress: () => void;
  onRelease: () => void;
}> = ({ label, className, disabled, onPress, onRelease }) => {
  const touchHandlers = useTouchEvents({ onPress, onRelease });

  return (
    <button
      ref={touchHandlers.ref as React.RefObject<HTMLButtonElement>}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      disabled={disabled}
      className={`${className} touch-manipulation`}
    >
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
};

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

    availableSamples.forEach((sample) => {
      const lowerSample = sample.toLowerCase();
      if (lowerSample.includes("kick") || lowerSample.includes("bd")) {
        sampleMap.kick = sample;
      } else if (lowerSample.includes("snare") || lowerSample.includes("sd")) {
        sampleMap.snare = sample;
      } else if (lowerSample.includes("hihat") || lowerSample.includes("hh")) {
        sampleMap.hihat = sample;
      } else if (lowerSample.includes("crash") || lowerSample.includes("cr")) {
        sampleMap.crash = sample;
      } else if (lowerSample.includes("ride") || lowerSample.includes("rd")) {
        sampleMap.ride = sample;
      } else if (
        lowerSample.includes("tom") ||
        lowerSample.includes("mt") ||
        lowerSample.includes("ht") ||
        lowerSample.includes("lt")
      ) {
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
    <div className="card bg-base-100 shadow-xl w-full ">
      <div className="card-body p-3">
        <div className="flex justify-around gap-3 mb-3 flex-wrap">
          <div className="space-y-4">
            <h3 className="card-title">Drum Kit Controls</h3>
            <div className="flex items-center gap-2">
              <label className="label">
                <span className="label-text">
                  Velocity: {Math.round(velocity * 9)}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="9"
                value={Math.round(velocity * 9)}
                onChange={(e) => setVelocity(parseInt(e.target.value) / 9)}
                className="range range-primary w-20"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* Cymbals Row */}
          <div className="flex gap-4 items-center">
            <DrumButton
              label="Crash"
              className={`btn btn-circle w-16 h-16 ${
                !drumMapping.crash
                  ? "btn-disabled"
                  : pressedDrums.has("crash")
                    ? "btn-warning scale-95"
                    : "btn-warning hover:scale-105"
              }`}
              disabled={!drumMapping.crash}
              onPress={() => handleDrumPress("crash")}
              onRelease={() => handleDrumRelease("crash")}
            />

            <DrumButton
              label="Ride"
              className={`btn btn-circle w-20 h-20 ${
                pressedDrums.has("ride")
                  ? "btn-primary scale-95"
                  : "btn-primary hover:scale-105"
              }`}
              onPress={() => handleDrumPress("ride")}
              onRelease={() => handleDrumRelease("ride")}
            />

            <DrumButton
              label="Splash"
              className={`btn btn-circle w-12 h-12 ${
                pressedDrums.has("splash")
                  ? "btn-accent scale-95"
                  : "btn-accent hover:scale-105"
              }`}
              onPress={() => handleDrumPress("splash")}
              onRelease={() => handleDrumRelease("splash")}
            />
          </div>

          {/* Toms Row */}
          <div className="flex gap-4 items-center">
            <DrumButton
              label="Tom 1"
              className={`btn btn-circle w-14 h-14 ${
                pressedDrums.has("tom1")
                  ? "btn-success scale-95"
                  : "btn-success hover:scale-105"
              }`}
              onPress={() => handleDrumPress("tom1")}
              onRelease={() => handleDrumRelease("tom1")}
            />

            <DrumButton
              label="Tom 2"
              className={`btn btn-circle w-14 h-14 ${
                pressedDrums.has("tom2")
                  ? "btn-secondary scale-95"
                  : "btn-secondary hover:scale-105"
              }`}
              onPress={() => handleDrumPress("tom2")}
              onRelease={() => handleDrumRelease("tom2")}
            />

            <DrumButton
              label="Tom 3"
              className={`btn btn-circle w-14 h-14 ${
                pressedDrums.has("tom3")
                  ? "btn-info scale-95"
                  : "btn-info hover:scale-105"
              }`}
              onPress={() => handleDrumPress("tom3")}
              onRelease={() => handleDrumRelease("tom3")}
            />
          </div>

          {/* Main Drums Row */}
          <div className="flex gap-8 items-center">
            {/* Hi-Hat */}
            <DrumButton
              label="Hi-Hat"
              className={`btn btn-circle w-12 h-12 ${
                pressedDrums.has("hihat")
                  ? "btn-neutral scale-95"
                  : "btn-neutral hover:scale-105"
              }`}
              onPress={() => handleDrumPress("hihat")}
              onRelease={() => handleDrumRelease("hihat")}
            />

            {/* Snare */}
            <DrumButton
              label="Snare"
              className={`btn btn-circle w-20 h-20 ${
                pressedDrums.has("snare")
                  ? "btn-error scale-95"
                  : "btn-error hover:scale-105"
              }`}
              onPress={() => handleDrumPress("snare")}
              onRelease={() => handleDrumRelease("snare")}
            />

            {/* Kick */}
            <DrumButton
              label="Kick"
              className={`btn btn-circle w-24 h-24 ${
                pressedDrums.has("kick")
                  ? "btn-neutral scale-95"
                  : "btn-neutral hover:scale-105"
              }`}
              onPress={() => handleDrumPress("kick")}
              onRelease={() => handleDrumRelease("kick")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
