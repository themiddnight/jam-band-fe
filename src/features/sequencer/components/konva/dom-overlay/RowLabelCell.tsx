import { memo } from 'react';
import type { SequencerRow, DrumRow, NoteRow } from '../../../types';

interface RowLabelCellProps {
  row: SequencerRow;
  rootNote?: string;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
}

const isDrumRow = (row: SequencerRow): row is DrumRow => 'sampleName' in row;
const isNoteRow = (row: SequencerRow): row is NoteRow => 'note' in row;

export const RowLabelCell = memo(({
  row,
  rootNote,
  onPlayNotes,
  onStopNotes,
}: RowLabelCellProps) => {
  const isRoot = isNoteRow(row) && rootNote && row.note.startsWith(rootNote);
  const isBlackKey = isNoteRow(row) && row.note.includes('#');

  return (
    <div
      className={`
        flex items-center w-full h-full px-2 text-xs select-none
        border-b border-base-200 cursor-pointer
        hover:bg-base-200 transition-colors
        ${isRoot ? 'bg-primary/10 text-primary font-bold' : ''}
        ${!isRoot && isBlackKey ? 'bg-base-300/30' : ''}
      `}
      onMouseDown={() => {
        if (isDrumRow(row)) {
          onPlayNotes([row.sampleName], 1, true);
        } else if (isNoteRow(row)) {
          onPlayNotes([row.note], 1, true);
        }
      }}
      onMouseUp={() => {
        if (isDrumRow(row)) {
          onStopNotes([row.sampleName]);
        } else if (isNoteRow(row)) {
          onStopNotes([row.note]);
        }
      }}
      onMouseLeave={() => {
        if (isDrumRow(row)) {
          onStopNotes([row.sampleName]);
        } else if (isNoteRow(row)) {
          onStopNotes([row.note]);
        }
      }}
      onTouchStart={() => {
        if (isDrumRow(row)) {
          onPlayNotes([row.sampleName], 1, true);
        } else if (isNoteRow(row)) {
          onPlayNotes([row.note], 1, true);
        }
      }}
      onTouchEnd={() => {
        if (isDrumRow(row)) {
          onStopNotes([row.sampleName]);
        } else if (isNoteRow(row)) {
          onStopNotes([row.note]);
        }
      }}
    >
      <span className="truncate">
        {isDrumRow(row) ? row.displayName : row.note}
      </span>
    </div>
  );
});

RowLabelCell.displayName = 'RowLabelCell';
