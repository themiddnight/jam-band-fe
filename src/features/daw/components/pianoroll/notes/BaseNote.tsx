import { Rect } from 'react-konva';
import type { BaseNoteProps } from './types';
import { HIGHEST_MIDI, NOTE_HEIGHT } from '../constants';

const getNoteY = (pitch: number) => (HIGHEST_MIDI - pitch) * NOTE_HEIGHT;
const clampPitch = (pitch: number) => Math.min(127, Math.max(0, pitch));

export const BaseNote = ({
  note,
  beatWidth,
  isSelected,
  dragOffset,
  previewDuration,
}: BaseNoteProps) => {
  const start = note.start + (dragOffset?.beat ?? 0);
  const pitch = clampPitch(note.pitch + (dragOffset?.pitch ?? 0));
  const duration = previewDuration ?? note.duration;
  const x = start * beatWidth;
  const y = getNoteY(pitch);
  const noteWidth = duration * beatWidth;

  return (
    <Rect
      name={`note-${note.id}`}
      x={x}
      y={y + 2}
      width={Math.max(noteWidth, 4)}
      height={NOTE_HEIGHT - 4}
      fill={isSelected ? '#2563eb' : '#34d399'}
      stroke={isSelected ? '#1d4ed8' : '#059669'}
      strokeWidth={isSelected ? 2 : 1}
      opacity={0.9}
      perfectDrawEnabled={false}
    />
  );
};

