import {
  generateFretPositions,
  getScaleNotes,
  type Scale,
} from "../../../utils/musicUtils";
import {
  FretboardBase,
  type FretboardConfig,
} from "../../shared/FretboardBase";
import { useCallback, useMemo, useRef } from "react";

interface BasicFretboardProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  velocity: number;
  pressedFrets: Set<string>;
  onFretPress: (stringIndex: number, fret: number) => void;
  onFretRelease: (stringIndex: number, fret: number) => void;
  onVelocityChange: (velocity: number) => void;
  // Use unified state pattern like keyboard
  unifiedState: {
    sustain: boolean;
    sustainToggle: boolean;
    playNote: (note: string, velocity?: number, isKeyHeld?: boolean) => Promise<void>;
    releaseKeyHeldNote: (note: string) => void;
    stopSustainedNotes: () => void;
  };
}

export const BasicFretboard: React.FC<BasicFretboardProps> = ({
  scaleState,
  velocity,
  pressedFrets,
  onFretPress,
  onFretRelease,
  unifiedState,
}) => {
  // Track active notes per string for same-string behavior
  const activeNotesPerString = useRef<Map<number, string>>(new Map());

  // Guitar configuration - 6 strings as requested
  const config: FretboardConfig = {
    strings: ["E", "A", "D", "G", "B", "E"],
    frets: 12,
    openNotes: ["E2", "A2", "D3", "G3", "B3", "E4"],
    mode: "melody",
    showNoteNames: true,
    showFretNumbers: true,
    highlightScaleNotes: true,
  };

  // Generate scale notes for highlighting
  const scaleNotes = useMemo(
    () =>
      getScaleNotes(scaleState.rootNote, scaleState.scale, 3).map((note) =>
        note.slice(0, -1),
      ), // Remove octave for highlighting
    [scaleState.rootNote, scaleState.scale],
  );

  // Generate fret positions using pure utility function
  const positions = useMemo(
    () =>
      generateFretPositions(
        config.strings,
        config.openNotes,
        config.frets,
        pressedFrets,
        scaleNotes,
      ),
    [config.strings, config.openNotes, config.frets, pressedFrets, scaleNotes],
  );

  // Helper function to get fret number from note (simplified version for tracking)
  const getExistingFret = useCallback((stringIndex: number, note: string): number => {
    const NOTE_NAMES = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const openNote = config.openNotes[stringIndex];
    const openNoteName = openNote.replace(/\d/, "");
    const openNoteIndex = NOTE_NAMES.indexOf(openNoteName);
    const targetNoteName = note.replace(/\d/, "");
    const targetNoteIndex = NOTE_NAMES.indexOf(targetNoteName);
    
    // Calculate fret difference (simplified)
    let fretDiff = targetNoteIndex - openNoteIndex;
    if (fretDiff < 0) fretDiff += 12;
    
    return fretDiff;
  }, [config.openNotes]);

  const handleFretPressWithNote = useCallback(
    async (stringIndex: number, fret: number, note: string) => {
      // If sustain is active and we're pressing a fret on the same string, stop the previous note
      if (unifiedState.sustain || unifiedState.sustainToggle) {
        const existingNote = activeNotesPerString.current.get(stringIndex);
        if (existingNote && existingNote !== note) {
          // Stop the previous note on this string using unified state
          unifiedState.releaseKeyHeldNote(existingNote);
          // Remove from pressedFrets tracking
          const existingFretKey = `${stringIndex}-${getExistingFret(stringIndex, existingNote)}`;
          if (pressedFrets.has(existingFretKey)) {
            const existingFretNum = getExistingFret(stringIndex, existingNote);
            onFretRelease(stringIndex, existingFretNum);
          }
        }
        // Track the new active note for this string
        activeNotesPerString.current.set(stringIndex, note);
      }

      onFretPress(stringIndex, fret);
      // Use unified state to play note with proper velocity and isKeyHeld=true like keyboard
      await unifiedState.playNote(note, velocity, true);
    },
    [
      unifiedState,
      onFretPress,
      onFretRelease,
      pressedFrets,
      getExistingFret,
    ],
  );

  const handleFretReleaseWithNote = useCallback(
    (stringIndex: number, fret: number, note: string) => {
      onFretRelease(stringIndex, fret);
      
      // Remove from active notes tracking
      if (activeNotesPerString.current.get(stringIndex) === note) {
        activeNotesPerString.current.delete(stringIndex);
      }
      
      // Always call releaseKeyHeldNote like keyboard - unified state will handle sustain logic automatically
      unifiedState.releaseKeyHeldNote(note);
    },
    [onFretRelease, unifiedState],
  );

    return (
    <div className="flex flex-col gap-4">
      {/* Fretboard */}
      <FretboardBase
        config={config}
        positions={positions}
        onFretPress={handleFretPressWithNote}
        onFretRelease={handleFretReleaseWithNote}
        className="guitar-fretboard"
        sustain={unifiedState.sustain}
        sustainToggle={unifiedState.sustainToggle}
      />
    </div>
  );
};
