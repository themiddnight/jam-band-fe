import { useCallback, useMemo, useState } from "react";
import { FretboardBase, type FretboardConfig } from "../shared/FretboardBase";
import { generateFretPositions, getScaleNotes, type Scale } from "../../utils/musicUtils";
import { useInstrumentState } from "../../hooks/useInstrumentState";

export interface GuitarProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onReleaseKeyHeldNote: (note: string) => void;
  onSustainChange: (sustain: boolean) => void;
}

export default function Guitar({
  scaleState,
  onPlayNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
}: GuitarProps) {
  const {
    velocity,
    sustain,
    pressedFrets,
    handleVelocityChange,
    handleFretPress,
    handleFretRelease,
  } = useInstrumentState();

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

  const handleFretPressWithNote = useCallback(async (stringIndex: number, fret: number, note: string) => {
    handleFretPress(stringIndex, fret);
    
    if (mode === 'melody') {
      await onPlayNotes([note], velocity, true);
    } else {
      // Chord mode - play the note and its third and fifth
      const noteName = note.slice(0, -1);
      const octave = parseInt(note.slice(-1));
      const noteIndex = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(noteName);
      const thirdIndex = (noteIndex + 4) % 12;
      const fifthIndex = (noteIndex + 7) % 12;
      const thirdNote = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][thirdIndex] + octave;
      const fifthNote = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][fifthIndex] + octave;
      await onPlayNotes([note, thirdNote, fifthNote], velocity, true);
    }
  }, [mode, velocity, onPlayNotes, handleFretPress]);

  const handleFretReleaseWithNote = useCallback((stringIndex: number, fret: number, note: string) => {
    handleFretRelease(stringIndex, fret);
    onReleaseKeyHeldNote(note);
    
    if (mode === 'chord') {
      // Release chord notes
      const noteName = note.slice(0, -1);
      const octave = parseInt(note.slice(-1));
      const noteIndex = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(noteName);
      const thirdIndex = (noteIndex + 4) % 12;
      const fifthIndex = (noteIndex + 7) % 12;
      const thirdNote = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][thirdIndex] + octave;
      const fifthNote = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][fifthIndex] + octave;
      onReleaseKeyHeldNote(thirdNote);
      onReleaseKeyHeldNote(fifthNote);
    }
  }, [mode, onReleaseKeyHeldNote, handleFretRelease]);

  const handleSustainChange = useCallback((newSustain: boolean) => {
    // This state is now managed by useInstrumentState
    // setSustain(newSustain);
    onSustainChange(newSustain);
  }, [onSustainChange]);

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body">
        <h3 className="card-title text-xl mb-4">Guitar</h3>
        
        {/* Mode Selection */}
        <div className="flex items-center gap-4 mb-4">
          <div className="join">
            <button
              onClick={() => setMode('melody')}
              className={`btn btn-sm ${
                mode === 'melody'
                  ? 'btn-primary'
                  : 'btn-outline'
              }`}
            >
              Melody
            </button>
            <button
              onClick={() => setMode('chord')}
              className={`btn btn-sm ${
                mode === 'chord'
                  ? 'btn-primary'
                  : 'btn-outline'
              }`}
            >
              Chord (Coming Soon)
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
          className="guitar-fretboard"
        />
      </div>
    </div>
  );
} 