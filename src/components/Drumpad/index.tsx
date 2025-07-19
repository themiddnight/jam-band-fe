import { useState, useMemo, useCallback } from "react";
import { DrumPadBase } from "../shared/DrumPadBase";
import { generateDrumPads, type Scale } from "../../utils/musicUtils";

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
  availableSamples,
}: DrumpadProps) {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());
  const [padAssignments, setPadAssignments] = useState<Record<string, string>>({});
  const [maxPads, setMaxPads] = useState<number>(16);

  // Generate drum pads using pure utility function
  const pads = useMemo(() => 
    generateDrumPads(availableSamples, maxPads, pressedPads, padAssignments),
    [availableSamples, maxPads, pressedPads, padAssignments]
  );

  const handlePadPress = useCallback(async (padId: string, sound?: string) => {
    setPressedPads(prev => new Set(prev).add(padId));
    
    if (sound) {
      // Play the assigned sound
      await onPlayNotes([sound], velocity, false);
    }
  }, [onPlayNotes, velocity]);

  const handlePadRelease = useCallback((padId: string) => {
    setPressedPads(prev => {
      const newSet = new Set(prev);
      newSet.delete(padId);
      return newSet;
    });
    
    // For drum pads, we typically don't need to release samples
    // They are usually one-shot sounds
  }, []);

  const handlePadAssign = useCallback((padId: string, sound: string) => {
    setPadAssignments(prev => ({
      ...prev,
      [padId]: sound
    }));
  }, []);

  const handleVelocityChange = useCallback((newVelocity: number) => {
    setVelocity(newVelocity);
  }, []);

  const resetAssignments = useCallback(() => {
    setPadAssignments({});
  }, []);

  const presetLayouts = {
    '8-pad': 8,
    '12-pad': 12,
    '16-pad': 16,
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body">
        <h3 className="card-title text-xl mb-4">Drum Pad</h3>
        
        {/* Drum Pad Controls */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {/* Pad Count Selection */}
          <div className="flex items-center gap-2">
            <label className="label">
              <span className="label-text">Layout:</span>
            </label>
            <div className="join">
              {Object.entries(presetLayouts).map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setMaxPads(count)}
                  className={`btn btn-sm ${
                    maxPads === count
                      ? 'btn-primary'
                      : 'btn-outline'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Velocity Control */}
          <div className="flex items-center gap-2">
            <label className="label">
              <span className="label-text">Velocity: {Math.round(velocity * 9)}</span>
            </label>
            <input
              type="range"
              min="1"
              max="9"
              value={Math.round(velocity * 9)}
              onChange={(e) => handleVelocityChange(parseInt(e.target.value) / 9)}
              className="range range-primary w-32"
            />
          </div>

          {/* Reset Button */}
          <button
            onClick={resetAssignments}
            className="btn btn-warning btn-sm"
          >
            Reset Assignments
          </button>
        </div>

        <DrumPadBase
          pads={pads}
          onPadPress={handlePadPress}
          onPadRelease={handlePadRelease}
          onPadAssign={handlePadAssign}
          velocity={velocity}
          onVelocityChange={handleVelocityChange}
          maxPads={maxPads}
          allowAssignment={true}
          availableSounds={availableSamples}
          className="drum-pad-grid"
        />
      </div>
    </div>
  );
} 