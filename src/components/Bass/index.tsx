import { useState, useMemo, useCallback } from "react";
import { FretboardBase, type FretboardConfig } from "../shared/FretboardBase";
import { generateFretPositions, getScaleNotes, type Scale } from "../../utils/musicUtils";

export interface BassProps {
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

export default function Bass({
  scaleState,
  onPlayNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
}: BassProps) {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [sustain, setSustain] = useState<boolean>(false);
  const [pressedFrets, setPressedFrets] = useState<Set<string>>(new Set());
  const [octaveMode, setOctaveMode] = useState<boolean>(false);

  // Bass configuration
  const config: FretboardConfig = {
    strings: ["E", "A", "D", "G"],
    frets: 12,
    openNotes: ["E1", "A1", "D2", "G2"],
    mode: octaveMode ? 'octave' : 'melody',
    showNoteNames: true,
    showFretNumbers: true,
    highlightScaleNotes: true,
  };

  // Generate scale notes for highlighting (bass typically uses lower octaves)
  const scaleNotes = useMemo(() => 
    getScaleNotes(scaleState.rootNote, scaleState.scale, 2)
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
    
    if (octaveMode) {
      // In octave mode, play the note and its octave
      const baseNote = note.slice(0, -1); // Remove octave
      const octave = parseInt(note.slice(-1));
      const octaveNote = `${baseNote}${octave + 1}`;
      
      await onPlayNotes([note, octaveNote], velocity, true);
    } else {
      // Regular single note playing
      await onPlayNotes([note], velocity, true);
    }
  }, [octaveMode, velocity, onPlayNotes]);

  const handleFretRelease = useCallback((stringIndex: number, fret: number, note: string) => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(prev => {
      const newSet = new Set(prev);
      newSet.delete(fretKey);
      return newSet;
    });
    
    if (octaveMode) {
      // Release both the note and its octave
      const baseNote = note.slice(0, -1);
      const octave = parseInt(note.slice(-1));
      const octaveNote = `${baseNote}${octave + 1}`;
      
      onReleaseKeyHeldNote(note);
      onReleaseKeyHeldNote(octaveNote);
    } else {
      onReleaseKeyHeldNote(note);
    }
  }, [octaveMode, onReleaseKeyHeldNote]);

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
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Bass</h3>
        
        {/* Bass-specific Controls */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setOctaveMode(false)}
              className={`px-3 py-1 rounded text-sm ${
                !octaveMode
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Single Note
            </button>
            <button
              onClick={() => setOctaveMode(true)}
              className={`px-3 py-1 rounded text-sm ${
                octaveMode
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Octave Mode
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
        
        {/* Scale Info and Mode Description */}
        <div className="text-sm text-gray-600 mb-4">
          <div>Scale: {scaleState.rootNote} {scaleState.scale}</div>
          {octaveMode && (
            <div className="text-green-600 mt-1">
              • Octave mode: Each fret plays the note + its octave
            </div>
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
        className="bass-fretboard"
      />

      {/* Bass-specific Features Info */}
      <div className="mt-4 text-xs text-gray-500">
        <p>🎸 <strong>Bass Features:</strong></p>
        <ul className="ml-4 mt-1">
          <li>• Octave mode for fuller bass sound</li>
          <li>• Scale highlighting for bass lines</li>
          <li>• Lower register tuning (E1-A1-D2-G2)</li>
          <li>• <strong>Coming Soon:</strong> Keyboard shortcuts for quick octave access</li>
        </ul>
      </div>

      {/* Future Keyboard Shortcuts Info */}
      <div className="mt-2 text-xs text-gray-400">
        <p><strong>Planned Keyboard Shortcuts:</strong></p>
        <ul className="ml-4 mt-1">
          <li>• <kbd>Shift</kbd> + fret = Play octave</li>
          <li>• <kbd>Ctrl</kbd> + fret = Play root + fifth</li>
          <li>• <kbd>Alt</kbd> + fret = Play walking bass pattern</li>
        </ul>
      </div>
    </div>
  );
} 