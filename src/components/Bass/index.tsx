import { useCallback, useMemo, useState } from "react";
import { FretboardBase, type FretboardConfig } from "../shared/FretboardBase";
import { generateFretPositions, getScaleNotes, type Scale } from "../../utils/musicUtils";
import { useInstrumentState } from "../../hooks/useInstrumentState";

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
  const {
    velocity,
    sustain,
    pressedFrets,
    handleVelocityChange,
    handleFretPress,
    handleFretRelease,
  } = useInstrumentState();

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

  const handleFretPressWithNote = useCallback(async (stringIndex: number, fret: number, note: string) => {
    handleFretPress(stringIndex, fret);
    
    if (octaveMode) {
      // Play octave (root + octave above)
      const octaveNote = note.slice(0, -1) + (parseInt(note.slice(-1)) + 1);
      await onPlayNotes([note, octaveNote], velocity, true);
    } else {
      await onPlayNotes([note], velocity, true);
    }
  }, [octaveMode, velocity, onPlayNotes, handleFretPress]);

  const handleFretReleaseWithNote = useCallback((stringIndex: number, fret: number, note: string) => {
    handleFretRelease(stringIndex, fret);
    onReleaseKeyHeldNote(note);
    
    if (octaveMode) {
      const octaveNote = note.slice(0, -1) + (parseInt(note.slice(-1)) + 1);
      onReleaseKeyHeldNote(octaveNote);
    }
  }, [octaveMode, onReleaseKeyHeldNote, handleFretRelease]);

  const handleSustainChange = useCallback((newSustain: boolean) => {
    // This state is now managed by useInstrumentState
    // setSustain(newSustain); 
    onSustainChange(newSustain);
  }, [onSustainChange]);

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body">
        <h3 className="card-title text-xl mb-4">Bass</h3>
        
        {/* Bass-specific Controls */}
        <div className="flex items-center gap-4 mb-4">
          <div className="join">
            <button
              onClick={() => setOctaveMode(false)}
              className={`btn btn-sm ${
                !octaveMode
                  ? 'btn-success'
                  : 'btn-outline'
              }`}
            >
              Single Note
            </button>
            <button
              onClick={() => setOctaveMode(true)}
              className={`btn btn-sm ${
                octaveMode
                  ? 'btn-success'
                  : 'btn-outline'
              }`}
            >
              Octave Mode
            </button>
          </div>
          
          {/* Sustain Toggle */}
          <div className="flex items-center gap-2">
            <label className="label cursor-pointer">
              <input
                type="checkbox"
                checked={sustain}
                onChange={(e) => handleSustainChange(e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="label-text ml-2">Sustain</span>
            </label>
          </div>
        </div>
        
        {/* Velocity Control */}
        <div className="flex items-center gap-2 mb-4">
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

        <FretboardBase
          config={config}
          positions={positions}
          onFretPress={handleFretPressWithNote}
          onFretRelease={handleFretReleaseWithNote}
          velocity={velocity}
          onVelocityChange={handleVelocityChange}
          className="bass-fretboard"
        />
      </div>
    </div>
  );
} 