import { Rect } from 'react-konva';
import type { NoteResizeHandleProps } from './types';
import { HIGHEST_MIDI, NOTE_HEIGHT } from '../constants';

const getNoteY = (pitch: number) => (HIGHEST_MIDI - pitch) * NOTE_HEIGHT;
const clampPitch = (pitch: number) => Math.min(127, Math.max(0, pitch));

export const NoteResizeHandle = ({
  note,
  beatWidth,
  dragOffset,
  previewDuration,
}: NoteResizeHandleProps) => {
  const start = note.start + (dragOffset?.beat ?? 0);
  const pitch = clampPitch(note.pitch + (dragOffset?.pitch ?? 0));
  const duration = previewDuration ?? note.duration;
  const x = start * beatWidth + duration * beatWidth - 6;
  const y = getNoteY(pitch) + NOTE_HEIGHT / 2 - 6;

  return (
    <Rect
      name={`handle-${note.id}`}
      x={x}
      y={y}
      width={6}
      height={12}
      fill="#1d4ed8"
      cornerRadius={2}
      perfectDrawEnabled={false}
    />
  );
};

