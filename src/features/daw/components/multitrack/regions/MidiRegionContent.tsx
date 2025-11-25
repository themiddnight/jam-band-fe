import { Shape, Group } from 'react-konva';
import type { MidiRegion } from '@/features/daw/types/daw';
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
  // width,
  headResizeState,
  viewportStartBeat,
  viewportEndBeat,
}: MidiRegionContentProps) => {

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

  // Optimized: Use single Shape with custom drawing instead of individual Rects
  return (
    <Group>
      <Shape
        sceneFunc={(context, shape) => {
          context.fillStyle = '#1f2937';
          context.globalAlpha = isMainLoop ? 0.6 : 0.3;

          // Calculate viewport bounds in pixels if available
          let viewportStartX = -Infinity;
          let viewportEndX = Infinity;

          if (typeof viewportStartBeat === 'number' && typeof viewportEndBeat === 'number') {
            viewportStartX = viewportStartBeat * beatWidth;
            viewportEndX = viewportEndBeat * beatWidth;
          }

          // Draw all notes in a single pass
          for (const note of region.notes) {
            // Apply offset for head resize preview
            const adjustedNoteStart = note.start + noteOffset;

            // Filter out notes that would be outside visible region during preview
            if (adjustedNoteStart + note.duration <= 0 || adjustedNoteStart >= length) {
              continue;
            }

            const noteX = loopX + adjustedNoteStart * beatWidth;
            const noteWidth = Math.max(note.duration * beatWidth, 2);

            // Viewport culling: Check if note is visible on screen
            if (noteX + noteWidth < viewportStartX || noteX > viewportEndX) {
              continue;
            }

            const normalizedPitch = (note.pitch - minPitch) / pitchRange;
            const noteY = y + height - normalizedPitch * (height - 16) - 8;
            const noteHeight = 4;

            context.fillRect(noteX, noteY, noteWidth, noteHeight);
          }

          // Required for Konva
          context.fillStrokeShape(shape);
        }}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
};

