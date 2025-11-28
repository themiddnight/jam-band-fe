import React, { memo, useMemo } from 'react';
import { Rect, Group } from 'react-konva';
import { KONVA_GRID, COLORS, getCellPosition } from './constants';
import type { SequencerRow, NoteRow } from '../../types';

interface GridBackgroundProps {
  rows: SequencerRow[];
  sequenceLength: number;
  visibleStartBeat: number;
  visibleEndBeat: number;
  visibleStartRow: number;
  visibleEndRow: number;
  rootNote?: string;
}

// Type guard for NoteRow
const isNoteRow = (row: SequencerRow): row is NoteRow => {
  return 'note' in row && 'inScale' in row;
};

// Check if a note matches the root note (ignoring octave)
const isRootNoteRow = (row: SequencerRow, rootNote?: string): boolean => {
  if (!rootNote || !isNoteRow(row)) return false;
  const noteNameWithoutOctave = row.note.replace(/\d+$/, '');
  return noteNameWithoutOctave === rootNote;
};

export const GridBackground = memo(({
  rows,
  sequenceLength,
  visibleStartBeat,
  visibleEndBeat,
  visibleStartRow,
  visibleEndRow,
  rootNote,
}: GridBackgroundProps) => {
  // Generate background cells for visible area
  const backgroundCells = useMemo(() => {
    const cells: React.ReactElement[] = [];
    
    for (let rowIndex = visibleStartRow; rowIndex <= visibleEndRow && rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row) continue;
      
      const isRoot = isRootNoteRow(row, rootNote);
      const isOutOfScale = isNoteRow(row) && !row.inScale;
      
      for (let beatIndex = visibleStartBeat; beatIndex <= visibleEndBeat && beatIndex < sequenceLength; beatIndex++) {
        const { x, y } = getCellPosition(beatIndex, rowIndex);
        const isDownbeat = (beatIndex + 1) % 4 === 1;
        
        // Determine cell background color
        let fillColor: string = isDownbeat ? COLORS.CELL_INACTIVE_BEAT : COLORS.CELL_INACTIVE;
        if (isRoot) {
          fillColor = COLORS.ROOT_NOTE_BG;
        } else if (isOutOfScale) {
          fillColor = 'rgba(255, 255, 255, 0.02)';
        }
        
        // Determine border color
        let strokeColor: string = COLORS.CELL_BORDER;
        if (isRoot) {
          strokeColor = COLORS.ROOT_NOTE_BORDER;
        }
        
        cells.push(
          <Rect
            key={`bg-${beatIndex}-${rowIndex}`}
            x={x}
            y={y}
            width={KONVA_GRID.CELL_SIZE}
            height={KONVA_GRID.CELL_SIZE}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={1}
            cornerRadius={4}
            listening={false}
          />
        );
      }
    }
    
    return cells;
  }, [rows, sequenceLength, visibleStartBeat, visibleEndBeat, visibleStartRow, visibleEndRow, rootNote]);

  return <Group listening={false}>{backgroundCells}</Group>;
});

GridBackground.displayName = 'GridBackground';
