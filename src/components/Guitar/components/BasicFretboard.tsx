import { useCallback, useMemo } from "react";
import { FretboardBase, type FretboardConfig } from "../../shared/FretboardBase";
import { generateFretPositions, getScaleNotes, type Scale } from "../../../utils/musicUtils";
import { useTouchEvents } from "../../../hooks/useTouchEvents";
import { getKeyDisplayName, DEFAULT_GUITAR_SHORTCUTS } from "../../../constants/guitarShortcuts";

interface BasicFretboardProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  velocity: number;
  sustain: boolean;
  sustainToggle: boolean;
  pressedFrets: Set<string>;
  onFretPress: (stringIndex: number, fret: number, note: string) => void;
  onFretRelease: (stringIndex: number, fret: number, note: string) => void;
  onVelocityChange: (velocity: number) => void;
  onSustainChange: (sustain: boolean) => void;
  onSustainToggleChange: (sustainToggle: boolean) => void;
  onPlayNote: (note: string) => void;
  onReleaseNote: (note: string) => void;
  onStopSustainedNotes: () => void;
}

export const BasicFretboard: React.FC<BasicFretboardProps> = ({
  scaleState,
  velocity,
  sustain,
  sustainToggle,
  pressedFrets,
  onFretPress,
  onFretRelease,
  onVelocityChange,
  onSustainChange,
  onSustainToggleChange,
  onPlayNote,
  onReleaseNote,
  onStopSustainedNotes,
}) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  // Guitar configuration
  const config: FretboardConfig = {
    strings: ["E", "A", "D", "G", "B", "E"],
    frets: 12,
    openNotes: ["E2", "A2", "D3", "G3", "B3", "E4"],
    mode: 'melody',
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
    // If sustain is active and we're pressing a fret on the same string, stop the previous note
    if (sustain) {
      const stringKey = `${stringIndex}-`;
      const existingFret = Array.from(pressedFrets).find(fretKey => 
        fretKey.startsWith(stringKey) && fretKey !== `${stringIndex}-${fret}`
      );
      if (existingFret) {
        const [existingStringIndex, existingFretNum] = existingFret.split('-');
        const existingNote = getNoteAtFret(config.openNotes[parseInt(existingStringIndex)], parseInt(existingFretNum));
        onFretRelease(parseInt(existingStringIndex), parseInt(existingFretNum), existingNote);
        onReleaseNote(existingNote);
      }
    }
    
    onFretPress(stringIndex, fret, note);
    onPlayNote(note);
  }, [sustain, pressedFrets, onFretPress, onFretRelease, onPlayNote, onReleaseNote, config.openNotes]);

  const handleFretReleaseWithNote = useCallback((stringIndex: number, fret: number, note: string) => {
    onFretRelease(stringIndex, fret, note);
    if (!sustain && !sustainToggle) {
      onReleaseNote(note);
    }
  }, [onFretRelease, onReleaseNote, sustain, sustainToggle]);

  // Helper function to get note at fret (simplified version)
  const getNoteAtFret = (openNote: string, fret: number): string => {
    const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const openNoteName = openNote.replace(/\d/, "");
    const openNoteIndex = NOTE_NAMES.indexOf(openNoteName);
    const newNoteIndex = (openNoteIndex + fret) % 12;
    const octave = Math.floor((openNoteIndex + fret) / 12) + parseInt(openNote.replace(/\D/g, ""));
    return NOTE_NAMES[newNoteIndex] + octave;
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body p-3">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <h3 className="card-title text-base">Basic Fretboard</h3>
          </div>
        </div>

        <div className="bg-neutral p-4 rounded-lg shadow-2xl overflow-auto">
          <FretboardBase
            config={config}
            positions={positions}
            onFretPress={handleFretPressWithNote}
            onFretRelease={handleFretReleaseWithNote}
            velocity={velocity}
            onVelocityChange={onVelocityChange}
            className="guitar-fretboard"
          />
        </div>

        <div className="flex justify-center items-center gap-3 flex-wrap mt-1">
          <div className="join">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                if (sustainToggle) {
                  // If toggle mode is active, sustain button stops current sustained notes
                  // This creates the "inverse" behavior where tapping sustain stops sound
                  onStopSustainedNotes();
                  // Also temporarily turn off sustain to communicate with remote users
                  // then immediately turn it back on to maintain the toggle state
                  onSustainChange(false);
                  // Use setTimeout to ensure the sustain off message is sent before turning it back on
                  setTimeout(() => {
                    onSustainChange(true);
                  }, 10);
                } else {
                  // Normal momentary sustain behavior
                  onSustainChange(true);
                }
              }}
              onMouseUp={(e) => {
                e.preventDefault();
                if (sustainToggle) {
                  // If toggle mode is active, releasing sustain should resume sustain mode
                  // This creates the "inverse" behavior where lifting sustain resumes sustain
                  onSustainChange(true);
                } else {
                  // Normal momentary sustain behavior - turn off sustain
                  onSustainChange(false);
                  onStopSustainedNotes();
                }
              }}
              onMouseLeave={() => {
                if (!sustainToggle) {
                  onSustainChange(false);
                  onStopSustainedNotes();
                }
              }}
              ref={useTouchEvents(
                () => {
                  if (sustainToggle) {
                    // If toggle mode is active, tapping sustain stops current sustained notes
                    onStopSustainedNotes();
                    // Also temporarily turn off sustain to communicate with remote users
                    // then immediately turn it back on to maintain the toggle state
                    onSustainChange(false);
                    // Use setTimeout to ensure the sustain off message is sent before turning it back on
                    setTimeout(() => {
                      onSustainChange(true);
                    }, 10);
                  } else {
                    onSustainChange(true);
                  }
                },
                () => {
                  if (sustainToggle) {
                    // If toggle mode is active, releasing sustain should resume sustain mode
                    onSustainChange(true);
                  } else {
                    onSustainChange(false);
                    onStopSustainedNotes();
                  }
                }
              ).ref as React.Ref<HTMLButtonElement>}
              className={`btn btn-sm join-item touch-manipulation select-none ${(sustain &&
                !sustainToggle) ||
                (sustainToggle &&
                  false) // TODO: hasSustainedNotes
                ? "btn-warning"
                : "btn-outline"
                }`}
              style={{
                WebkitTapHighlightColor: 'transparent',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation'
              }}
            >
              Sustain <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.sustain.key)}</kbd>
            </button>
            <button
              onClick={() => {
                onSustainToggleChange(!sustainToggle);
              }}
              className={`btn btn-sm join-item touch-manipulation ${sustainToggle
                ? "btn-success"
                : "btn-outline"
                }`}
            >
              {sustainToggle ? "🔒" : "🔓"}
              <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.sustainToggle.key)}</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="label py-1">
              <span className="label-text text-sm">
                Velocity: {Math.round(velocity * 9)}
              </span>
            </label>
            <input
              type="range"
              min="1"
              max="9"
              value={Math.round(velocity * 9)}
              onChange={(e) => onVelocityChange(parseInt(e.target.value) / 9)}
              className="range range-sm range-primary w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
}; 