import { Rect } from 'react-konva';
import type { MidiRegion } from '../../../types/daw';
import type { RegionContentProps } from './types';

interface MidiRegionContentProps extends RegionContentProps {
  region: MidiRegion;
}

export const MidiRegionContent = ({
  region,
  loopX,
  y,
  height,
  beatWidth,
  isMainLoop,
  length,
  headResizeState,
}: MidiRegionContentProps) => {
  // Don't render if too many notes (performance)
  if (region.notes.length > 100) {
    return null;
  }

  // Normalize MIDI notes for preview
  const minPitch = region.notes.reduce((min, note) => Math.min(min, note.pitch), 127);
  const maxPitch = region.notes.reduce((max, note) => Math.max(max, note.pitch), 0);
  const pitchRange = Math.max(1, maxPitch - minPitch);

  // Calculate note offset for head resize preview
  const isHeadResizing = headResizeState?.regionIds.includes(region.id);
  let noteOffset = 0;

  if (isHeadResizing) {
    // During head resize, adjust note positions to show trimming behavior
    const initialStart = headResizeState?.initialStarts[region.id] ?? region.start;
    const previewStart = headResizeState?.previewStarts[region.id] ?? region.start;
    const delta = previewStart - initialStart;
    noteOffset = -delta; // Negative delta to maintain absolute position
  }

  return (
    <>
      {region.notes
        .map((note) => {
          // Apply offset for head resize preview
          const adjustedNoteStart = note.start + noteOffset;

          // Filter out notes that would be outside visible region during preview
          if (adjustedNoteStart + note.duration <= 0 || adjustedNoteStart >= length) {
            return null;
          }

          const noteX = loopX + adjustedNoteStart * beatWidth;
          const noteWidth = Math.max(note.duration * beatWidth, 2);
          const normalizedPitch = (note.pitch - minPitch) / pitchRange;
          const noteY = y + height - normalizedPitch * (height - 16) - 8;
          const noteHeight = 4;

          return (
            <Rect
              key={`${region.id}-${note.id}`}
              x={noteX}
              y={noteY}
              width={noteWidth}
              height={noteHeight}
              fill="#1f2937"
              opacity={isMainLoop ? 0.6 : 0.3}
              listening={false}
            />
          );
        })
        .filter(Boolean)}
    </>
  );
};

