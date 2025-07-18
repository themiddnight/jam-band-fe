import { useState, useMemo, useCallback } from "react";
import { FretboardBase, type FretboardConfig } from "../shared/FretboardBase";
import { generateFretPositions, getScaleNotes, type Scale } from "../../utils/musicUtils";

export interface GuitarProps {
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

export default function Guitar({
  scaleState,
  onPlayNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
}: GuitarProps) {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [sustain, setSustain] = useState<boolean>(false);
  const [pressedFrets, setPressedFrets] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'melody' | 'chord'>('melody');

  // Guitar configuration
  const config: FretboardConfig = {
    strings: ["E", "A", "D", "G", "B", "E"],
    frets: 12,
    openNotes: ["E2", "A2", "D3", "G3", "B3", "E4"],
    mode: mode,
    showNoteNames: true,
    showFretNumbers: true,
    highlightScaleNotes: true,
  };

  // Generate scale notes for highlighting
  const scaleNotes = useMemo(() => 
    getScaleNotes(scaleState.rootNote, scaleState.scale, 3)
      .map(note => note.slice(0, -1)), // Remove octave for highlighting
    [scaleState.rootNote, scaleState.scale]
  );

  // Generate fret positions using pure utility function
  const positions = useMemo(() => 
    generateFretPositions(
      config.strings,
      config.openNotes,
      config.frets,
      pressedFrets,
      scaleNotes
    ),
    [config.strings, config.openNotes, config.frets, pressedFrets, scaleNotes]
  );

  const handleFretPress = useCallback(async (stringIndex: number, fret: number, note: string) => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(prev => new Set(prev).add(fretKey));
    
    if (mode === 'melody') {
      // Single note playing
      await onPlayNotes([note], velocity, true);
    } else {
      // Chord mode - this will be expanded in future
      // For now, just play the single note
      await onPlayNotes([note], velocity, true);
    }
  }, [mode, velocity, onPlayNotes]);

  const handleFretRelease = useCallback((stringIndex: number, fret: number, note: string) => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(prev => {
      const newSet = new Set(prev);
      newSet.delete(fretKey);
      return newSet;
    });
    
    onReleaseKeyHeldNote(note);
  }, [onReleaseKeyHeldNote]);

  const handleSustainChange = useCallback((newSustain: boolean) => {
    setSustain(newSustain);
    onSustainChange(newSustain);
  }, [onSustainChange]);

  const handleVelocityChange = useCallback((newVelocity: number) => {
    setVelocity(newVelocity);
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-6xl">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Guitar</h3>
        
        {/* Mode Selection */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('melody')}
              className={`px-3 py-1 rounded text-sm ${
                mode === 'melody'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Melody
            </button>
            <button
              onClick={() => setMode('chord')}
              className={`px-3 py-1 rounded text-sm ${
                mode === 'chord'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Chord (Coming Soon)
            </button>
          </div>
          
          {/* Sustain Toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sustain}
              onChange={(e) => handleSustainChange(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Sustain</span>
          </label>
        </div>
        
        {/* Scale Info */}
        <div className="text-sm text-gray-600 mb-4">
          Scale: {scaleState.rootNote} {scaleState.scale}
          {mode === 'chord' && (
            <span className="ml-4 text-orange-600">
              • Chord mode will support strumming patterns and chord shapes
            </span>
          )}
        </div>
      </div>

      {/* Pure Fretboard Component */}
      <FretboardBase
        config={config}
        positions={positions}
        onFretPress={handleFretPress}
        onFretRelease={handleFretRelease}
        velocity={velocity}
        onVelocityChange={handleVelocityChange}
        className="guitar-fretboard"
      />

      {/* Future Features Info */}
      <div className="mt-4 text-xs text-gray-500">
        <p>🎸 <strong>Coming Soon:</strong></p>
        <ul className="ml-4 mt-1">
          <li>• Chord mode with strumming patterns</li>
          <li>• Keyboard shortcuts for chord shapes</li>
          <li>• Scale highlighting and chord suggestions</li>
          <li>• Capo simulation</li>
        </ul>
      </div>
    </div>
  );
} 