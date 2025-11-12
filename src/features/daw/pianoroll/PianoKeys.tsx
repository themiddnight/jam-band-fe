import React, { useMemo, useRef } from 'react';
import { Layer, Rect, Stage, Text } from 'react-konva';

import {
  HIGHEST_MIDI,
  KEYBOARD_WIDTH,
  LOWEST_MIDI,
  NOTE_HEIGHT,
} from './constants';
import { midiNumberToNoteName } from '../utils/midiUtils';
import { useTrackStore } from '../stores/trackStore';
import { usePianoRollStore } from '../stores/pianoRollStore';
import { useRegionStore } from '../stores/regionStore';
import { playImmediateNote, stopImmediateNote } from '../utils/audioEngine';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // relative to octave (C=0)

const generateKeys = () => {
  const keys: Array<{ midi: number; isBlack: boolean; label: string }> = [];
  for (let midi = HIGHEST_MIDI; midi >= LOWEST_MIDI; midi -= 1) {
    const noteInOctave = midi % 12;
    const isBlack = BLACK_KEYS.has(noteInOctave);
    keys.push({
      midi,
      isBlack,
      label: midiNumberToNoteName(midi),
    });
  }
  return keys;
};

export const PianoKeys = React.memo(() => {
  const keys = useMemo(() => generateKeys(), []);
  const stageHeight = keys.length * NOTE_HEIGHT;
  
  const activeRegionId = usePianoRollStore((state) => state.activeRegionId);
  const regions = useRegionStore((state) => state.regions);
  const tracks = useTrackStore((state) => state.tracks);
  const activeNotesRef = useRef<Set<number>>(new Set());
  
  const region = regions.find((r) => r.id === activeRegionId);
  const track = region ? tracks.find((t) => t.id === region.trackId) : null;
  
  const handleKeyDown = (midi: number) => {
    if (!track || activeNotesRef.current.has(midi)) {
      return;
    }
    activeNotesRef.current.add(midi);
    playImmediateNote(track, midi, 100);
  };
  
  const handleKeyUp = (midi: number) => {
    if (!track) {
      return;
    }
    activeNotesRef.current.delete(midi);
    stopImmediateNote(track, midi);
  };

  return (
    <Stage width={KEYBOARD_WIDTH} height={stageHeight}>
      <Layer>
        {keys.map((key, index) => {
          const y = index * NOTE_HEIGHT;
          return (
            <Rect
              key={key.midi}
              x={0}
              y={y}
              width={KEYBOARD_WIDTH}
              height={NOTE_HEIGHT}
              fill={key.isBlack ? '#1f2937' : '#e5e7eb'}
              stroke="#9ca3af"
              strokeWidth={key.isBlack ? 0 : 1}
              onPointerDown={() => handleKeyDown(key.midi)}
              onPointerUp={() => handleKeyUp(key.midi)}
              onTouchEnd={() => handleKeyUp(key.midi)}
            />
          );
        })}
        {keys.map((key, index) => {
          const y = index * NOTE_HEIGHT;
          return (
            <Text
              key={`label-${key.midi}`}
              text={key.label}
              x={8}
              y={y + 2}
              fontSize={10}
              fill={key.isBlack ? '#f9fafb' : '#374151'}
            />
          );
        })}
      </Layer>
    </Stage>
  );
});

PianoKeys.displayName = 'PianoKeys';
