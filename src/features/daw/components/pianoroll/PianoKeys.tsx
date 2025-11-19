import React, { useMemo, useRef } from 'react';
import { Layer, Rect, Stage, Text } from 'react-konva';

import {
  HIGHEST_MIDI,
  KEYBOARD_WIDTH,
  LOWEST_MIDI,
  NOTE_HEIGHT,
} from './constants';
import { midiNumberToNoteName } from '@/features/daw/utils/midiUtils';
import { useTrackStore } from '@/features/daw/stores/trackStore';
import { usePianoRollStore } from '@/features/daw/stores/pianoRollStore';
import { useRegionStore } from '@/features/daw/stores/regionStore';
import { trackInstrumentRegistry } from '@/features/daw/utils/trackInstrumentRegistry';
import { useArrangeRoomScaleStore } from '@/features/daw/stores/arrangeRoomStore';
import { getVisibleMidiNumbers, isNoteOutOfScale } from '@/features/daw/utils/pianoRollViewUtils';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // relative to octave (C=0)

export const PianoKeys = React.memo(() => {
  const activeRegionId = usePianoRollStore((state) => state.activeRegionId);
  const viewMode = usePianoRollStore((state) => state.viewMode);
  const regions = useRegionStore((state) => state.regions);
  const tracks = useTrackStore((state) => state.tracks);
  const rootNote = useArrangeRoomScaleStore((state) => state.rootNote);
  const scale = useArrangeRoomScaleStore((state) => state.scale);
  const activeNotesRef = useRef<Set<string>>(new Set());
  
  const region = regions.find((r) => r.id === activeRegionId);
  const track = region ? tracks.find((t) => t.id === region.trackId) : null;
  const notes = region && region.type === 'midi' ? region.notes : [];
  
  // Get visible MIDI numbers based on view mode
  const visibleMidiNumbers = useMemo(() => {
    return getVisibleMidiNumbers(
      viewMode,
      rootNote,
      scale,
      notes,
      LOWEST_MIDI,
      HIGHEST_MIDI
    );
  }, [viewMode, rootNote, scale, notes]);
  
  // Generate keys only for visible MIDI numbers
  const keys = useMemo(() => {
    return visibleMidiNumbers.map((midi) => {
      const noteInOctave = midi % 12;
      const isBlack = BLACK_KEYS.has(noteInOctave);
      const isOutOfScale = viewMode === 'scale-keys' && isNoteOutOfScale(midi, rootNote, scale);
      
      return {
        midi,
        isBlack,
        isOutOfScale,
        label: midiNumberToNoteName(midi),
      };
    });
  }, [visibleMidiNumbers, viewMode, rootNote, scale]);
  
  const stageHeight = keys.length * NOTE_HEIGHT;
  
  const handleKeyDown = (midi: number) => {
    if (!track) {
      return;
    }
    const noteName = midiNumberToNoteName(midi);
    if (activeNotesRef.current.has(noteName)) {
      return;
    }

    activeNotesRef.current.add(noteName);
    void trackInstrumentRegistry
      .playNotes(track, noteName, {
        velocity: 100,
        isKeyHeld: true,
      })
      .catch((error) => {
        console.error('Failed to play piano roll note:', error);
        activeNotesRef.current.delete(noteName);
      });
  };
  
  const handleKeyUp = (midi: number) => {
    if (!track) {
      return;
    }
    const noteName = midiNumberToNoteName(midi);
    if (!activeNotesRef.current.has(noteName)) {
      return;
    }

    activeNotesRef.current.delete(noteName);
    void trackInstrumentRegistry
      .stopNotes(track, noteName)
      .catch((error) => {
        console.error('Failed to stop piano roll note:', error);
      });
  };

  return (
    <Stage width={KEYBOARD_WIDTH} height={stageHeight}>
      <Layer>
        {keys.map((key, index) => {
          const y = index * NOTE_HEIGHT;
          
          // Determine fill color based on key type and scale status
          let fillColor: string;
          if (key.isOutOfScale) {
            // Out of scale notes - dimmed/muted color
            fillColor = key.isBlack ? '#374151' : '#d1d5db';
          } else {
            // In scale or all-keys mode - normal colors
            fillColor = key.isBlack ? '#1f2937' : '#e5e7eb';
          }
          
          return (
            <Rect
              key={key.midi}
              x={0}
              y={y}
              width={KEYBOARD_WIDTH}
              height={NOTE_HEIGHT}
              fill={fillColor}
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
          const textColor = key.isOutOfScale 
            ? (key.isBlack ? '#9ca3af' : '#6b7280')
            : (key.isBlack ? '#f9fafb' : '#374151');
          
          return (
            <Text
              key={`label-${key.midi}`}
              text={key.label}
              x={8}
              y={y + 2}
              fontSize={10}
              fill={textColor}
            />
          );
        })}
      </Layer>
    </Stage>
  );
});

PianoKeys.displayName = 'PianoKeys';
