import { memo, useCallback } from "react";
import type { SequencerRow, DrumRow, NoteRow } from "../../types";

// Type guards
const isDrumRow = (row: SequencerRow): row is DrumRow => {
  return "sampleName" in row;
};

const isNoteRow = (row: SequencerRow): row is NoteRow => {
  return "note" in row && "inScale" in row;
};

// Helper function to check if a note matches the root note (ignoring octave)
const isRootNote = (note: string, rootNote?: string): boolean => {
  if (!rootNote) return false;
  // Extract note name without octave (e.g., "C4" -> "C", "F#3" -> "F#")
  const noteNameWithoutOctave = note.replace(/\d+$/, "");
  return noteNameWithoutOctave === rootNote;
};

interface RowLabelCellProps {
  row: SequencerRow;
  rootNote?: string;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
}

export const RowLabelCell = memo(({
  row,
  rootNote,
  onPlayNotes,
  onStopNotes,
}: RowLabelCellProps) => {
  const getNoteName = useCallback(() => {
    return isDrumRow(row) ? row.sampleName : row.note;
  }, [row]);

  const getLabelClasses = useCallback(() => {
    const baseClasses = `w-full h-full text-xs text-white font-medium p-2 border-r border-base-200 flex items-center justify-end cursor-pointer transition-colors hover:bg-base-200 active:bg-base-300 select-none`;

    // Check if this row represents the root note
    const isRoot = isNoteRow(row) && isRootNote(row.note, rootNote);

    if (isRoot) {
      return `${baseClasses} text-base-content bg-primary/20 border-primary/40 font-bold`;
    }

    if (isNoteRow(row) && !row.inScale) {
      return `${baseClasses} text-base-content/50`;
    }

    return `${baseClasses} text-base-content`;
  }, [row, rootNote]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const noteName = getNoteName();
      onPlayNotes([noteName], 80, true);
    },
    [getNoteName, onPlayNotes]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const noteName = getNoteName();
      onStopNotes([noteName]);
    },
    [getNoteName, onStopNotes]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const noteName = getNoteName();
      onStopNotes([noteName]);
    },
    [getNoteName, onStopNotes]
  );

  return (
    <button
      className={getLabelClasses()}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      title={`Preview ${isDrumRow(row) ? row.displayName : row.displayName}`}
    >
      <span className="truncate">
        {isDrumRow(row) ? row.displayName : row.displayName}
      </span>
    </button>
  );
});

RowLabelCell.displayName = "RowLabelCell";