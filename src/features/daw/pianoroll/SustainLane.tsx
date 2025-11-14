import React, { useCallback, useMemo, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Line, Rect, Stage } from 'react-konva';

import { SUSTAIN_LANE_HEIGHT } from './constants';
import type { SustainEvent } from '../types/daw';
import { snapToGrid } from '../utils/timeUtils';
import { getGridDivisionForZoom } from '../utils/gridUtils';

interface SustainLaneProps {
  events: SustainEvent[];
  selectedEventIds: string[];
  totalBeats: number;
  pixelsPerBeat: number;
  zoom: number;
  scrollLeft: number;
  viewportWidth: number;
  playheadBeats?: number;
  onAddEvent: (start: number) => void;
  onUpdateEvent: (eventId: string, updates: Partial<SustainEvent>) => void;
  onRemoveEvent: (eventId: string) => void;
  onSetSelectedEvents: (eventIds: string[]) => void;
}

interface DragState {
  eventId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  originBeat: number;
  delta: number;
  initialStart: number;
  initialEnd: number;
}

// Memoized playhead component
const PlayheadIndicator = React.memo<{ x: number; height: number; width: number }>(
  ({ x, height, width }) => {
    if (x < 0 || x > width) return null;
    
    return (
      <Layer listening={false}>
        <Line
          points={[x, 0, x, height]}
          stroke="#3b82f6"
          strokeWidth={2}
          listening={false}
        />
      </Layer>
    );
  }
);
PlayheadIndicator.displayName = 'SustainPlayheadIndicator';

export const SustainLane = ({
  events,
  selectedEventIds,
  totalBeats,
  pixelsPerBeat,
  zoom,
  scrollLeft,
  viewportWidth,
  playheadBeats = 0,
  onAddEvent,
  onUpdateEvent,
  onRemoveEvent,
  onSetSelectedEvents,
}: SustainLaneProps) => {
  const width = totalBeats * pixelsPerBeat * zoom;
  const beatWidth = pixelsPerBeat * zoom;
  // Since events are now in absolute positions, playhead should also be absolute
  const playheadX = playheadBeats * beatWidth;

  const [dragState, setDragState] = useState<DragState | null>(null);
  
  // Dynamic grid division based on zoom level
  const dynamicGridDivision = useMemo(() => getGridDivisionForZoom(zoom), [zoom]);
  
  // Viewport culling - calculate visible range considering zoom
  const { visibleStartBeat, visibleEndBeat } = useMemo(() => {
    const buffer = 16; // Larger buffer to ensure all events are rendered at high zoom
    const startBeat = Math.max(0, (scrollLeft / beatWidth) - buffer);
    const endBeat = Math.min(totalBeats, ((scrollLeft + viewportWidth) / beatWidth) + buffer);
    return { visibleStartBeat: startBeat, visibleEndBeat: endBeat };
  }, [scrollLeft, beatWidth, viewportWidth, totalBeats]);
  
  // Filter events to only visible ones (always include selected)
  const visibleEvents = useMemo(() => {
    return events.filter(event => {
      if (selectedEventIds.includes(event.id)) return true; // Always render selected
      return event.end >= visibleStartBeat && event.start <= visibleEndBeat;
    });
  }, [events, visibleStartBeat, visibleEndBeat, selectedEventIds]);

  const getPointerBeat = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (!stage) {
        return 0;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return 0;
      }
      return pointer.x / beatWidth;
    },
    [beatWidth]
  );

  const handleBackgroundDoubleClick = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const beat = snapToGrid(
        getPointerBeat(event as unknown as KonvaEventObject<PointerEvent>),
        dynamicGridDivision
      );
      onAddEvent(Math.max(0, beat));
    },
    [getPointerBeat, dynamicGridDivision, onAddEvent]
  );

  const handleEventPointerDown = useCallback(
    (mode: DragState['mode'], sustain: SustainEvent, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      if (event.evt.shiftKey) {
        const combined = selectedEventIds.includes(sustain.id)
          ? selectedEventIds.filter((id) => id !== sustain.id)
          : [...selectedEventIds, sustain.id];
        onSetSelectedEvents(combined);
      } else if (!selectedEventIds.includes(sustain.id)) {
        onSetSelectedEvents([sustain.id]);
      }
      const pointerBeat = snapToGrid(getPointerBeat(event), dynamicGridDivision);
      setDragState({
        eventId: sustain.id,
        mode,
        originBeat: pointerBeat,
        delta: 0,
        initialStart: sustain.start,
        initialEnd: sustain.end,
      });
    },
    [getPointerBeat, dynamicGridDivision, onSetSelectedEvents, selectedEventIds]
  );

  const handlePointerMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      if (!dragState) {
        return;
      }
      const pointerBeat = snapToGrid(getPointerBeat(event), dynamicGridDivision);
      const delta = pointerBeat - dragState.originBeat;
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              delta,
            }
          : prev
      );
    },
    [dragState, getPointerBeat, dynamicGridDivision]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragState) {
      return;
    }
    const { eventId, mode, delta, initialStart, initialEnd } = dragState;
    if (mode === 'move' && delta !== 0) {
      const length = initialEnd - initialStart;
      const newStart = Math.max(0, initialStart + delta);
      onUpdateEvent(eventId, { start: newStart, end: newStart + length });
    } else if (mode === 'resize-start' && delta !== 0) {
      const newStart = Math.min(initialEnd - 0.25, Math.max(0, initialStart + delta));
      onUpdateEvent(eventId, { start: newStart });
    } else if (mode === 'resize-end' && delta !== 0) {
      const newEnd = Math.max(initialStart + 0.25, initialEnd + delta);
      onUpdateEvent(eventId, { end: newEnd });
    }
    setDragState(null);
  }, [dragState, onUpdateEvent]);

  const handleBackgroundClick = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      if (!event.evt.shiftKey) {
        onSetSelectedEvents([]);
      }
    },
    [onSetSelectedEvents]
  );
  
  // Calculate preview positions for events being dragged
  const getEventPreviewPosition = useCallback(
    (event: SustainEvent) => {
      if (!dragState || dragState.eventId !== event.id) {
        return { start: event.start, end: event.end };
      }
      const { mode, delta, initialStart, initialEnd } = dragState;
      if (mode === 'move') {
        const length = initialEnd - initialStart;
        const newStart = Math.max(0, initialStart + delta);
        return { start: newStart, end: newStart + length };
      } else if (mode === 'resize-start') {
        const newStart = Math.min(initialEnd - 0.25, Math.max(0, initialStart + delta));
        return { start: newStart, end: initialEnd };
      } else if (mode === 'resize-end') {
        const newEnd = Math.max(initialStart + 0.25, initialEnd + delta);
        return { start: initialStart, end: newEnd };
      }
      return { start: event.start, end: event.end };
    },
    [dragState]
  );

  const verticalLines = [];
  for (let beat = 0; beat <= totalBeats; beat++) {
    const x = beat * beatWidth;
    verticalLines.push(
      <Rect
        key={`sustain-beat-${beat}`}
        x={x}
        y={0}
        width={1}
        height={SUSTAIN_LANE_HEIGHT}
        fill={beat % 4 === 0 ? '#d1d5db' : '#e5e7eb'}
      />
    );
  }

  return (
    <Stage
      width={width}
      height={SUSTAIN_LANE_HEIGHT}
      perfectDrawEnabled={false}
      onPointerMove={handlePointerMove}
      onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
      onPointerUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
      onDblClick={handleBackgroundDoubleClick}
    >
      <Layer>
        <Rect
          x={0}
          y={0}
          width={width}
          height={SUSTAIN_LANE_HEIGHT}
          fill="#f3f4f6"
          onMouseDown={handleBackgroundClick}
        />
        {verticalLines}
        
        {/* Regular sustain events - only visible */}
        {visibleEvents.map((event) => {
          const { start, end } = getEventPreviewPosition(event);
          const x = start * beatWidth;
          const widthPixels = Math.max((end - start) * beatWidth, 4);
          const isSelected = selectedEventIds.includes(event.id);
          const isDragging = dragState?.eventId === event.id;
          return (
            <Rect
              key={event.id}
              x={x}
              y={12}
              width={widthPixels}
              height={SUSTAIN_LANE_HEIGHT - 24}
              fill={isSelected ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.35)'}
              opacity={isDragging ? 0.8 : 1}
              cornerRadius={4}
              onPointerDown={(e) => handleEventPointerDown('move', event, e)}
              onDblClick={() => onRemoveEvent(event.id)}
            />
          );
        })}
        {visibleEvents.map((event) => {
          const { start } = getEventPreviewPosition(event);
          const x = start * beatWidth;
          const isSelected = selectedEventIds.includes(event.id);
          return (
            <Rect
              key={`${event.id}-start`}
              x={x - 6}
              y={6}
              width={8}
              height={SUSTAIN_LANE_HEIGHT - 12}
              fill={isSelected ? '#3b82f6' : '#1d4ed8'}
              stroke={isSelected ? '#1e40af' : '#1e3a8a'}
              strokeWidth={1}
              cornerRadius={3}
              onPointerDown={(e) => handleEventPointerDown('resize-start', event, e)}
            />
          );
        })}
        {visibleEvents.map((event) => {
          const { start, end } = getEventPreviewPosition(event);
          const widthPixels = Math.max((end - start) * beatWidth, 4);
          const x = start * beatWidth + widthPixels;
          const isSelected = selectedEventIds.includes(event.id);
          return (
            <Rect
              key={`${event.id}-end`}
              x={x - 2}
              y={6}
              width={8}
              height={SUSTAIN_LANE_HEIGHT - 12}
              fill={isSelected ? '#3b82f6' : '#1d4ed8'}
              stroke={isSelected ? '#1e40af' : '#1e3a8a'}
              strokeWidth={1}
              cornerRadius={3}
              onPointerDown={(e) => handleEventPointerDown('resize-end', event, e)}
            />
          );
        })}
      </Layer>
      
      {/* Playhead: Separate memoized component */}
      <PlayheadIndicator x={playheadX} height={SUSTAIN_LANE_HEIGHT} width={width} />
    </Stage>
  );
};

