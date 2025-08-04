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
  onStopNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
}: BassProps) {
  const {
    velocity,
    sustain,
    pressedKeys,
    setVelocity,
    setSustain,
    playNote,
    stopNote,
  } = useInstrumentState({
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes: () => {}, // Bass doesn't use sustained notes
    onReleaseKeyHeldNote,
    onSustainChange,
  });

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

  // Convert pressedKeys to pressedFrets format for FretboardBase
  const pressedFrets = useMemo(() => {
    const fretSet = new Set<string>();
    pressedKeys.forEach(key => {
      // Convert note to fret format if needed
      // For now, we'll use the key as-is since FretboardBase expects string-fret format
      fretSet.add(key);
    });
    return fretSet;
  }, [pressedKeys]);

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

  const handleFretPressWithNote = useCallback(async (_stringIndex: number, _fret: number, note: string) => {
    if (octaveMode) {
      // Play octave (root + octave above)
      const octaveNote = note.slice(0, -1) + (parseInt(note.slice(-1)) + 1);
      await playNote(note, velocity, true);
      await playNote(octaveNote, velocity, true);
    } else {
      await playNote(note, velocity, true);
    }
  }, [octaveMode, velocity, playNote]);

  const handleFretReleaseWithNote = useCallback((_stringIndex: number, _fret: number, note: string) => {
    stopNote(note);
    onReleaseKeyHeldNote(note);
    
    if (octaveMode) {
      const octaveNote = note.slice(0, -1) + (parseInt(note.slice(-1)) + 1);
      stopNote(octaveNote);
      onReleaseKeyHeldNote(octaveNote);
    }
  }, [octaveMode, onReleaseKeyHeldNote, stopNote]);

  const handleSustainChange = useCallback((newSustain: boolean) => {
    setSustain(newSustain);
  }, [setSustain]);

  const handleVelocityChange = useCallback((newVelocity: number) => {
    setVelocity(newVelocity);
  }, [setVelocity]);

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
          className="bass-fretboard"
        />
      </div>
    </div>
  );
} 