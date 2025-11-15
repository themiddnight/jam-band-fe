import React from 'react';
import { Rect } from 'react-konva';
import type { NoteGridBackgroundProps } from './types';
import { HIGHEST_MIDI, NOTE_HEIGHT, TOTAL_KEYS } from '../constants';
import { getGridLineStyle } from '@/features/daw/utils/gridUtils';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // relative to octave (C#, D#, F#, G#, A#)

export const NoteGridBackground = React.memo<NoteGridBackgroundProps>(
  ({
    width,
    height,
    beatWidth,
    totalBeats,
    visibleStartBeat,
    visibleEndBeat,
    gridInterval,
    regionHighlightStart = 0,
    regionHighlightEnd = 0,
  }) => {
    // Region highlight dimensions
    const highlightX = regionHighlightStart * beatWidth;
    const highlightWidth = (regionHighlightEnd - regionHighlightStart) * beatWidth;

    // Generate vertical grid lines (only visible ones)
    const verticalLines = [];
    const gridStartBeat = Math.floor(visibleStartBeat / gridInterval) * gridInterval;
    const gridEndBeat = Math.min(Math.ceil(visibleEndBeat), totalBeats);

    for (let beat = gridStartBeat; beat <= gridEndBeat; beat += gridInterval) {
      const x = beat * beatWidth;
      const style = getGridLineStyle(beat, 4); // 4 beats per bar

      verticalLines.push(
        <Rect
          key={`beat-${beat}`}
          x={x}
          y={0}
          width={style.weight}
          height={height}
          fill={style.color}
          opacity={style.opacity}
        />
      );
    }

    // Generate horizontal lines and black key backgrounds
    const horizontalLines = [];
    const blackKeyBackgrounds = [];

    for (let keyIndex = 0; keyIndex <= TOTAL_KEYS; keyIndex++) {
      const y = keyIndex * NOTE_HEIGHT;
      const midi = HIGHEST_MIDI - keyIndex;
      const noteInOctave = midi % 12;
      const isBlackKey = BLACK_KEYS.has(noteInOctave);

      // Add dimmed background for black keys
      if (isBlackKey) {
        blackKeyBackgrounds.push(
          <Rect
            key={`black-bg-${keyIndex}`}
            x={0}
            y={y}
            width={width}
            height={NOTE_HEIGHT}
            fill="rgba(0,0,0,0.08)"
            listening={false}
          />
        );
      }

      horizontalLines.push(
        <Rect key={`row-${keyIndex}`} x={0} y={y} width={width} height={1} fill="#e5e7eb" />
      );
    }

    return (
      <>
        <Rect
          name="note-background"
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#f9fafb"
          listening={true}
        />
        {/* Region highlight */}
        {highlightWidth > 0 && (
          <Rect
            x={highlightX}
            y={0}
            width={highlightWidth}
            height={height}
            fill="rgba(34, 197, 94, 0.05)"
            listening={false}
          />
        )}
        {blackKeyBackgrounds}
        {verticalLines}
        {horizontalLines}
      </>
    );
  }
);

NoteGridBackground.displayName = 'NoteGridBackground';

