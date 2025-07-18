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
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-6xl">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Drum Pad</h3>
        
        {/* Drum Pad Controls */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {/* Pad Count Selection */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Layout:</span>
            <div className="flex gap-1">
              {Object.entries(presetLayouts).map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setMaxPads(count)}
                  className={`px-3 py-1 rounded text-sm ${
                    maxPads === count
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetAssignments}
            className="px-3 py-1 rounded text-sm bg-red-100 text-red-700 hover:bg-red-200"
          >
            Reset Assignments
          </button>
        </div>

        {/* Available Samples Info */}
        <div className="text-sm text-gray-600 mb-4">
          <div>Available Samples: {availableSamples.length}</div>
          <div className="text-xs text-gray-500 mt-1">
            Right-click pads to assign different sounds
          </div>
        </div>
      </div>

      {/* Pure Drum Pad Component */}
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

      {/* Drum Pad Features Info */}
      <div className="mt-4 text-xs text-gray-500">
        <p>🥁 <strong>Drum Pad Features:</strong></p>
        <ul className="ml-4 mt-1">
          <li>• Configurable pad count (8, 12, or 16 pads)</li>
          <li>• User-assignable sounds per pad</li>
          <li>• Right-click to assign sounds</li>
          <li>• Velocity-sensitive playback</li>
        </ul>
      </div>

      {/* Future Features Info */}
      <div className="mt-2 text-xs text-gray-400">
        <p><strong>Coming Soon:</strong></p>
        <ul className="ml-4 mt-1">
          <li>• Keyboard shortcuts for each pad</li>
          <li>• Pad sensitivity settings</li>
          <li>• Pattern recording and playback</li>
          <li>• Custom pad colors and labels</li>
          <li>• MIDI mapping support</li>
        </ul>
      </div>

      {/* Sample List */}
      {availableSamples.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <p className="text-sm font-medium text-gray-700 mb-2">Available Samples:</p>
          <div className="flex flex-wrap gap-1">
            {availableSamples.map((sample, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-white rounded text-xs text-gray-600 border"
              >
                {sample}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 