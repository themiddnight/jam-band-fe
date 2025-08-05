import {
  generateFretPositions,
  getScaleNotes,
  type Scale,
} from "../../../utils/musicUtils";
import {
  FretboardBase,
  type FretboardConfig,
} from "../../shared/FretboardBase";
import { useCallback, useMemo } from "react";

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
  onPlayNote: (note: string) => void;
  onReleaseNote: (note: string) => void;
}

export const BasicFretboard: React.FC<BasicFretboardProps> = ({
  scaleState,
  sustain,
  sustainToggle,
  pressedFrets,
  onFretPress,
  onFretRelease,
  onPlayNote,
  onReleaseNote,
}) => {
  // Guitar configuration
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

  const handleFretPressWithNote = useCallback(
    async (stringIndex: number, fret: number, note: string) => {
      // If sustain is active and we're pressing a fret on the same string, stop the previous note
      if (sustain) {
        const stringKey = `${stringIndex}-`;
        const existingFret = Array.from(pressedFrets).find(
          (fretKey) =>
            fretKey.startsWith(stringKey) &&
            fretKey !== `${stringIndex}-${fret}`,
        );
        if (existingFret) {
          const [existingStringIndex, existingFretNum] =
            existingFret.split("-");
          const existingNote = getNoteAtFret(
            config.openNotes[parseInt(existingStringIndex)],
            parseInt(existingFretNum),
          );
          onFretRelease(
            parseInt(existingStringIndex),
            parseInt(existingFretNum),
            existingNote,
          );
          onReleaseNote(existingNote);
        }
      }

      onFretPress(stringIndex, fret, note);
      onPlayNote(note);
    },
    [
      sustain,
      pressedFrets,
      onFretPress,
      onFretRelease,
      onPlayNote,
      onReleaseNote,
      config.openNotes,
    ],
  );

  const handleFretReleaseWithNote = useCallback(
    (stringIndex: number, fret: number, note: string) => {
      onFretRelease(stringIndex, fret, note);
      if (!sustain && !sustainToggle) {
        onReleaseNote(note);
      }
    },
    [onFretRelease, onReleaseNote, sustain, sustainToggle],
  );

  // Helper function to get note at fret (simplified version)
  const getNoteAtFret = (openNote: string, fret: number): string => {
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
    const openNoteName = openNote.replace(/\d/, "");
    const openNoteIndex = NOTE_NAMES.indexOf(openNoteName);
    const newNoteIndex = (openNoteIndex + fret) % 12;
    const octave =
      Math.floor((openNoteIndex + fret) / 12) +
      parseInt(openNote.replace(/\D/g, ""));
    return NOTE_NAMES[newNoteIndex] + octave;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Fretboard */}
      <FretboardBase
        config={config}
        positions={positions}
        onFretPress={handleFretPressWithNote}
        onFretRelease={handleFretReleaseWithNote}
        className="guitar-fretboard"
      />
    </div>
  );
};
