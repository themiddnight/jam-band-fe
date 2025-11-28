import { memo } from 'react';
import { Rect, Group, Text } from 'react-konva';
import { KONVA_GRID, COLORS, getCellPosition } from './constants';
import type { SequencerStep, SequencerRow, EditMode, NoteRow, DrumRow } from '../../types';

interface StepNoteProps {
  step: SequencerStep;
  row: SequencerRow;
  rowIndex: number;
  beatIndex: number;
  editMode: EditMode;
  isRecording: boolean;
  isSelected?: boolean;
  rootNote?: string;
}

// Type guards
const isDrumRow = (row: SequencerRow): row is DrumRow => {
  return 'sampleName' in row;
};

const isNoteRow = (row: SequencerRow): row is NoteRow => {
  return 'note' in row && 'inScale' in row;
};

// Check if a note matches the root note
const isRootNoteRow = (row: SequencerRow, rootNote?: string): boolean => {
  if (!rootNote || !isNoteRow(row)) return false;
  const noteNameWithoutOctave = row.note.replace(/\d+$/, '');
  return noteNameWithoutOctave === rootNote;
};

export const StepNote = memo(({
  step,
  row,
  rowIndex,
  beatIndex,
  editMode,
  isRecording,
  isSelected = false,
  rootNote,
}: StepNoteProps) => {
  const { x, y } = getCellPosition(beatIndex, rowIndex);
  const centerOffset = (KONVA_GRID.CELL_SIZE - KONVA_GRID.NOTE_SIZE) / 2;
  
  const isDrum = isDrumRow(row);
  const isRoot = isRootNoteRow(row, rootNote);
  const isOutOfScale = isNoteRow(row) && !row.inScale;
  
  // Calculate position for the note cell
  const noteX = x + centerOffset;
  const noteY = y + centerOffset;
  
  // Determine colors based on state
  let fillColor: string;
  let strokeColor: string;
  
  if (editMode === 'gate') {
    fillColor = 'rgba(54, 211, 153, 0.2)';
    strokeColor = COLORS.STEP_ACTIVE;
  } else if (editMode === 'velocity') {
    fillColor = 'rgba(251, 189, 35, 0.2)';
    strokeColor = COLORS.STEP_ACTIVE_DRUM;
  } else {
    if (isDrum) {
      fillColor = COLORS.STEP_ACTIVE_DRUM;
      strokeColor = COLORS.STEP_ACTIVE_DRUM;
    } else if (isOutOfScale) {
      fillColor = 'rgba(251, 189, 35, 0.7)';
      strokeColor = COLORS.STEP_ACTIVE_DRUM;
    } else {
      fillColor = COLORS.STEP_ACTIVE;
      strokeColor = COLORS.STEP_ACTIVE;
    }
  }
  
  // Add root note ring effect or selection
  const strokeWidth = isSelected ? 2 : isRoot ? 2 : 1;
  
  // Selection ring color
  const selectionRingColor = '#3b82f6'; // Blue for selection
  
  // Render based on edit mode
  if (editMode === 'gate') {
    // Gate mode: horizontal bar from left
    const gateWidth = Math.max(3, step.gate * KONVA_GRID.NOTE_SIZE);
    return (
      <Group name={`step-${beatIndex}-${rowIndex}`}>
        {/* Selection ring */}
        {isSelected && (
          <Rect
            x={noteX - 2}
            y={noteY - 2}
            width={KONVA_GRID.NOTE_SIZE + 4}
            height={KONVA_GRID.NOTE_SIZE + 4}
            stroke={selectionRingColor}
            strokeWidth={2}
            cornerRadius={6}
            listening={false}
          />
        )}
        {/* Background cell */}
        <Rect
          x={noteX}
          y={noteY}
          width={KONVA_GRID.NOTE_SIZE}
          height={KONVA_GRID.NOTE_SIZE}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          cornerRadius={4}
        />
        {/* Gate indicator bar */}
        <Rect
          x={noteX}
          y={noteY}
          width={gateWidth}
          height={KONVA_GRID.NOTE_SIZE}
          fill={COLORS.GATE_FILL}
          cornerRadius={[4, gateWidth >= KONVA_GRID.NOTE_SIZE - 2 ? 4 : 0, gateWidth >= KONVA_GRID.NOTE_SIZE - 2 ? 4 : 0, 4]}
          listening={false}
        />
      </Group>
    );
  }
  
  if (editMode === 'velocity') {
    // Velocity mode: vertical bar from bottom
    const velocityHeight = Math.max(3, step.velocity * KONVA_GRID.NOTE_SIZE);
    return (
      <Group name={`step-${beatIndex}-${rowIndex}`}>
        {/* Selection ring */}
        {isSelected && (
          <Rect
            x={noteX - 2}
            y={noteY - 2}
            width={KONVA_GRID.NOTE_SIZE + 4}
            height={KONVA_GRID.NOTE_SIZE + 4}
            stroke={selectionRingColor}
            strokeWidth={2}
            cornerRadius={6}
            listening={false}
          />
        )}
        {/* Background cell */}
        <Rect
          x={noteX}
          y={noteY}
          width={KONVA_GRID.NOTE_SIZE}
          height={KONVA_GRID.NOTE_SIZE}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          cornerRadius={4}
        />
        {/* Velocity indicator bar */}
        <Rect
          x={noteX}
          y={noteY + KONVA_GRID.NOTE_SIZE - velocityHeight}
          width={KONVA_GRID.NOTE_SIZE}
          height={velocityHeight}
          fill={COLORS.VELOCITY_FILL}
          cornerRadius={[velocityHeight >= KONVA_GRID.NOTE_SIZE - 2 ? 4 : 0, velocityHeight >= KONVA_GRID.NOTE_SIZE - 2 ? 4 : 0, 4, 4]}
          listening={false}
        />
      </Group>
    );
  }
  
  // Note mode: filled cell with symbol
  return (
    <Group name={`step-${beatIndex}-${rowIndex}`}>
      {/* Selection ring */}
      {isSelected && (
        <Rect
          x={noteX - 2}
          y={noteY - 2}
          width={KONVA_GRID.NOTE_SIZE + 4}
          height={KONVA_GRID.NOTE_SIZE + 4}
          stroke={selectionRingColor}
          strokeWidth={2}
          cornerRadius={6}
          listening={false}
        />
      )}
      <Rect
        x={noteX}
        y={noteY}
        width={KONVA_GRID.NOTE_SIZE}
        height={KONVA_GRID.NOTE_SIZE}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        cornerRadius={4}
      />
      <Text
        x={noteX}
        y={noteY}
        width={KONVA_GRID.NOTE_SIZE}
        height={KONVA_GRID.NOTE_SIZE}
        text={isRecording ? '●' : '■'}
        fontSize={12}
        fontStyle="bold"
        fill={COLORS.TEXT}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
});

StepNote.displayName = 'StepNote';
