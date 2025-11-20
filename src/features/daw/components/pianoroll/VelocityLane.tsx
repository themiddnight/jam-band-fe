import { useCallback, useMemo, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Line, Rect, Stage } from 'react-konva';

import { SUSTAIN_LANE_HEIGHT } from './constants';
import type { MidiNote, NoteId } from '@/features/daw/types/daw';

interface VelocityLaneProps {
  notes: MidiNote[];
  selectedNoteIds: NoteId[];
  totalBeats: number;
  pixelsPerBeat: number;
  zoom: number;
  scrollLeft: number;
  viewportWidth: number;
  playheadBeats?: number;
  onSetNotesVelocity: (noteIds: NoteId[], velocity: number, options?: { commit?: boolean }) => void;
}

interface DragState {
  noteIds: NoteId[];
  previewVelocity: number;
}

export const VelocityLane = ({
  notes,
  selectedNoteIds,
  totalBeats,
  pixelsPerBeat,
  zoom,
  scrollLeft,
  viewportWidth,
  playheadBeats = 0,
  onSetNotesVelocity,
}: VelocityLaneProps) => {
  const width = totalBeats * pixelsPerBeat * zoom;
  const beatWidth = pixelsPerBeat * zoom;
  const playheadX = playheadBeats * beatWidth;
  
  const [dragState, setDragState] = useState<DragState | null>(null);
  
  // Viewport culling - calculate visible range considering zoom
  const { visibleStartBeat, visibleEndBeat } = useMemo(() => {
    const buffer = 16; // Larger buffer to ensure all notes are rendered at high zoom
    const startBeat = Math.max(0, (scrollLeft / beatWidth) - buffer);
    const endBeat = Math.min(totalBeats, ((scrollLeft + viewportWidth) / beatWidth) + buffer);
    return { visibleStartBeat: startBeat, visibleEndBeat: endBeat };
  }, [scrollLeft, beatWidth, viewportWidth, totalBeats]);
  
  // Filter notes to only visible ones (always include selected)
  const visibleNotes = useMemo(() => {
    return notes.filter(note => {
      if (selectedNoteIds.includes(note.id)) return true; // Always render selected
      const noteEnd = note.start + note.duration;
      return noteEnd >= visibleStartBeat && note.start <= visibleEndBeat;
    });
  }, [notes, visibleStartBeat, visibleEndBeat, selectedNoteIds]);

  const calculateVelocityFromY = useCallback((y: number) => {
    const newVelocity = Math.round((1 - y / SUSTAIN_LANE_HEIGHT) * 127);
    return Math.min(127, Math.max(1, newVelocity));
  }, []);

  const handleBarPointerDown = useCallback(
    (note: MidiNote, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      const stage = event.target.getStage();
      if (!stage) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      
      const velocity = calculateVelocityFromY(pointer.y);
      const noteIds = selectedNoteIds.includes(note.id) ? selectedNoteIds : [note.id];
      
      setDragState({
        noteIds,
        previewVelocity: velocity,
      });

      onSetNotesVelocity(noteIds, velocity);
    },
    [calculateVelocityFromY, onSetNotesVelocity, selectedNoteIds]
  );
  
  const handlePointerMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      if (!dragState) {
        return;
      }
      const stage = event.target.getStage();
      if (!stage) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      
      const velocity = calculateVelocityFromY(pointer.y);
      setDragState((prev) => prev ? { ...prev, previewVelocity: velocity } : null);
      onSetNotesVelocity(dragState.noteIds, velocity);
    },
    [calculateVelocityFromY, dragState, onSetNotesVelocity]
  );
  
  const handlePointerUp = useCallback(() => {
    if (dragState) {
      onSetNotesVelocity(dragState.noteIds, dragState.previewVelocity, { commit: true });
    }
    setDragState(null);
  }, [dragState, onSetNotesVelocity]);

  const sortedNotes = useMemo(() => {
    return [...visibleNotes].sort((a, b) => a.start - b.start);
  }, [visibleNotes]);
  
  const previewVelocities = useMemo(() => {
    if (!dragState) {
      return {};
    }
    return dragState.noteIds.reduce<Record<NoteId, number>>((acc, id) => {
      acc[id] = dragState.previewVelocity;
      return acc;
    }, {});
  }, [dragState]);

  return (
    <Stage
      width={width}
      height={SUSTAIN_LANE_HEIGHT}
      perfectDrawEnabled={false}
      onPointerMove={handlePointerMove}
      onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
      onPointerUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
    >
      <Layer
        onPointerDown={(event) => {
          // Event delegation: find which velocity line was clicked
          const target = event.target;
          const targetName = target.name();
          if (targetName && targetName.startsWith('vel-line-')) {
            const noteId = targetName.replace('vel-line-', '');
            const note = sortedNotes.find((n) => n.id === noteId);
            if (note) {
              handleBarPointerDown(note, event);
            }
          }
        }}
      >
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={SUSTAIN_LANE_HEIGHT}
          fill="#f9fafb"
        />
        
        {/* Grid lines */}
        {[0, 32, 64, 96, 127].map((vel) => {
          const y = SUSTAIN_LANE_HEIGHT - (vel / 127) * SUSTAIN_LANE_HEIGHT;
          return (
            <Line
              key={`vel-${vel}`}
              points={[0, y, width, y]}
              stroke="#e5e7eb"
              strokeWidth={1}
              dash={vel === 0 || vel === 127 ? undefined : [4, 4]}
            />
          );
        })}

        {/* Velocity lines at note start position */}
        {sortedNotes.map((note) => {
          const x = note.start * beatWidth;
          const velocity = previewVelocities[note.id] ?? note.velocity;
          const velocityHeight = (velocity / 127) * SUSTAIN_LANE_HEIGHT;
          const y = SUSTAIN_LANE_HEIGHT - velocityHeight;
          const isSelected = selectedNoteIds.includes(note.id);
          const isDragging = dragState?.noteIds.includes(note.id);

          return (
            <Line
              key={note.id}
              name={`vel-line-${note.id}`}
              points={[x, SUSTAIN_LANE_HEIGHT, x, y]}
              stroke={isSelected ? '#3b82f6' : '#10b981'}
              strokeWidth={3}
              opacity={isDragging ? 0.9 : 0.7}
              perfectDrawEnabled={false}
            />
          );
        })}

        {/* Playhead indicator */}
        {playheadX >= 0 && playheadX <= width && (
          <Line
            points={[playheadX, 0, playheadX, SUSTAIN_LANE_HEIGHT]}
            stroke="#3b82f6"
            strokeWidth={2}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
};

