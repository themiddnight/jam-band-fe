import { Rect } from 'react-konva';
import type { DuplicateNotePreviewProps } from './types';
import { HIGHEST_MIDI, NOTE_HEIGHT } from '../constants';

const getNoteY = (pitch: number) => (HIGHEST_MIDI - pitch) * NOTE_HEIGHT;
const clampPitch = (pitch: number) => Math.min(127, Math.max(0, pitch));

export const DuplicateNotePreview = ({
  note,
  beatWidth,
  dragOffset,
}: DuplicateNotePreviewProps) => {
  // Don't render if no movement
  if (dragOffset.beat === 0 && dragOffset.pitch === 0) {
    return null;
  }

  const start = note.start + dragOffset.beat;
  const pitch = clampPitch(note.pitch + dragOffset.pitch);
  const x = start * beatWidth;
  const y = getNoteY(pitch);
  const noteWidth = note.duration * beatWidth;

  return (
    <Rect
      x={x}
      y={y + 2}
      width={Math.max(noteWidth, 4)}
      height={NOTE_HEIGHT - 4}
      cornerRadius={4}
      fill="#34d399"
      stroke="#10b981"
      strokeWidth={2}
      dash={[4, 4]}
      opacity={0.6}
      listening={false}
    />
  );
};

