import { Rect } from 'react-konva';
import type { BaseNoteProps } from './types';
import { HIGHEST_MIDI, NOTE_HEIGHT } from '../constants';

const defaultGetNoteY = (pitch: number) => (HIGHEST_MIDI - pitch) * NOTE_HEIGHT;
const clampPitch = (pitch: number) => Math.min(127, Math.max(0, pitch));

export const BaseNote = ({
  note,
  beatWidth,
  isSelected,
  dragOffset,
  previewDuration,
  getNoteY = defaultGetNoteY,
  isOutOfScale = false,
}: BaseNoteProps) => {
  const start = note.start + (dragOffset?.beat ?? 0);
  const pitch = clampPitch(note.pitch + (dragOffset?.pitch ?? 0));
  const duration = previewDuration ?? note.duration;
  const x = start * beatWidth;
  const y = getNoteY(pitch);
  const noteWidth = duration * beatWidth;

  // Determine colors based on selection and scale status
  let fill: string;
  let stroke: string;
  
  if (isSelected) {
    // Selected notes: blue (or orange-blue if out of scale)
    fill = isOutOfScale ? '#ea580c' : '#2563eb'; // orange-600 or blue-600
    stroke = isOutOfScale ? '#c2410c' : '#1d4ed8'; // orange-700 or blue-700
  } else {
    // Unselected notes: green or orange
    fill = isOutOfScale ? '#fb923c' : '#34d399'; // orange-400 or emerald-400
    stroke = isOutOfScale ? '#ea580c' : '#059669'; // orange-600 or emerald-600
  }

  return (
    <Rect
      name={`note-${note.id}`}
      x={x}
      y={y + 2}
      width={Math.max(noteWidth, 4)}
      height={NOTE_HEIGHT - 4}
      fill={fill}
      stroke={stroke}
      strokeWidth={isSelected ? 2 : 1}
      opacity={0.9}
      perfectDrawEnabled={false}
    />
  );
};

