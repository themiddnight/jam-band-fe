import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import * as Tone from 'tone';

import { RULER_HEIGHT } from './constants';
import { beatsPerBar, snapToGrid as snapValueToGrid } from '@/features/daw/utils/timeUtils';
import type { TimeSignature } from '@/features/daw/types/daw';
import { useProjectStore } from '@/features/daw/stores/projectStore';
import { useMarkerStore } from '@/features/daw/stores/markerStore';
import { useDAWCollaborationContext } from '@/features/daw/contexts/useDAWCollaborationContext';
import { getGridDivisionForZoom, getGridInterval, isBarLine, isBeatLine } from '@/features/daw/utils/gridUtils';
import { TimeRulerMarker } from './TimeRulerMarker';
import { MarkerEditDialog } from './MarkerEditDialog';
import type { TimeMarker } from '@/features/daw/types/marker';

interface TimeRulerProps {
  totalBeats: number;
  pixelsPerBeat: number;
  zoom: number;
  scrollLeft: number;
  height?: number;
  timeSignature: TimeSignature;
  playheadBeats?: number;
}

const TimeRulerComponent = ({
  totalBeats,
  pixelsPerBeat,
  zoom,
  scrollLeft,
  height = RULER_HEIGHT,
  timeSignature,
  playheadBeats = 0,
}: TimeRulerProps) => {
  const setPlayhead = useProjectStore((state) => state.setPlayhead);
  const snapToGrid = useProjectStore((state) => state.snapToGrid);
  const loop = useProjectStore((state) => state.loop);
  const setLoop = useProjectStore((state) => state.setLoop);
  const [isDragging, setIsDragging] = useState(false);
  const [loopDragState, setLoopDragState] = useState<'start' | 'end' | null>(null);
  
  // Marker state
  const markers = useMarkerStore((state) => state.markers);
  const selectedMarkerId = useMarkerStore((state) => state.selectedMarkerId);
  const isEditMode = useMarkerStore((state) => state.isEditMode);
  const selectMarker = useMarkerStore((state) => state.selectMarker);
  const [editingMarker, setEditingMarker] = useState<TimeMarker | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickX, setLastClickX] = useState(0);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  
  const { handleMarkerAdd, handleMarkerUpdate, handleMarkerUpdateFlush, handleMarkerDelete } = useDAWCollaborationContext();
  
  const width = totalBeats * pixelsPerBeat * zoom;
  const beatWidth = pixelsPerBeat * zoom;
  const beatsInBar = beatsPerBar(timeSignature);
  
  // Dynamic grid division based on zoom level
  const dynamicGridDivision = useMemo(() => getGridDivisionForZoom(zoom), [zoom]);
  const gridInterval = useMemo(() => getGridInterval(dynamicGridDivision), [dynamicGridDivision]);
  
  const updatePlayheadFromPointer = useCallback((pointer: { x: number; y: number }) => {
    // pointer.x is relative to the Stage which now starts at 0
    let clickedBeat = Math.max(0, Math.min(pointer.x / beatWidth, totalBeats));
    
    // Snap to global grid if enabled - use same function as region dragging
    if (snapToGrid) {
      clickedBeat = snapValueToGrid(clickedBeat, dynamicGridDivision);
    }
    
    // Update store
    setPlayhead(clickedBeat);
    
    // Update Tone.js Transport position without stopping playback
    const bars = Math.floor(clickedBeat / beatsInBar);
    const beats = clickedBeat % beatsInBar;
    
    Tone.Transport.position = `${bars}:${beats}:0`;
  }, [beatWidth, beatsInBar, setPlayhead, totalBeats, snapToGrid, dynamicGridDivision]);
  
  const updateLoopHandleFromPointer = useCallback((pointer: { x: number; y: number }, handle: 'start' | 'end') => {
    let clickedBeat = Math.max(0, Math.min(pointer.x / beatWidth, totalBeats));
    
    // Snap to global grid if enabled
    if (snapToGrid) {
      clickedBeat = snapValueToGrid(clickedBeat, dynamicGridDivision);
    }
    
    // Prevent overlap
    if (handle === 'start') {
      // Start can't go beyond end - 1 beat minimum
      const maxStart = loop.end - 1;
      clickedBeat = Math.min(clickedBeat, maxStart);
      setLoop({ start: clickedBeat });
    } else {
      // End can't go before start + 1 beat minimum
      const minEnd = loop.start + 1;
      clickedBeat = Math.max(clickedBeat, minEnd);
      setLoop({ end: clickedBeat });
    }
  }, [beatWidth, totalBeats, snapToGrid, dynamicGridDivision, loop.start, loop.end, setLoop]);
  
  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    const target = event.target;
    const targetName = target.name();
    
    // Check if clicking on loop handles
    if (targetName === 'loop-start-handle') {
      setLoopDragState('start');
      return;
    }
    if (targetName === 'loop-end-handle') {
      setLoopDragState('end');
      return;
    }
    
    // Check if clicking on a marker (check both target and parent)
    let markerName = targetName;
    if (!markerName || !markerName.startsWith('marker-')) {
      // Check parent (in case we clicked on a child element like Line or Text)
      const parent = target.getParent();
      if (parent) {
        markerName = parent.name();
      }
    }
    
    if (markerName && markerName.startsWith('marker-')) {
      const markerId = markerName.replace('marker-', '');
      if (isEditMode) {
        // Single click to select marker
        selectMarker(markerId);
        setDraggingMarkerId(markerId);
        return;
      }
    }
    
    // In edit mode, don't set playhead - only handle marker operations
    if (isEditMode) {
      const stage = event.target.getStage();
      if (!stage) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      
      // Handle double-click for adding markers
      const now = Date.now();
      const timeDiff = now - lastClickTime;
      const xDiff = Math.abs(pointer.x - lastClickX);
      
      if (timeDiff < 300 && xDiff < 10) {
        // Double click detected - show dialog to add marker with description
        let clickedBeat = Math.max(0, Math.min(pointer.x / beatWidth, totalBeats));
        if (snapToGrid) {
          clickedBeat = snapValueToGrid(clickedBeat, dynamicGridDivision);
        }
        
        const newMarker: TimeMarker = {
          id: crypto.randomUUID(),
          position: clickedBeat,
          description: '', // Will be set in dialog
          color: '#3b82f6',
        };
        
        // Show dialog to set description
        setEditingMarker(newMarker);
        setClickCount(0);
        return;
      }
      
      setClickCount(clickCount + 1);
      setLastClickTime(now);
      setLastClickX(pointer.x);
      
      // Don't set playhead in edit mode
      return;
    }
    
    // Normal mode - set playhead
    const stage = event.target.getStage();
    if (!stage) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    
    setIsDragging(true);
    updatePlayheadFromPointer(pointer);
  };
  
  const handlePointerMove = (event: KonvaEventObject<PointerEvent>) => {
    const stage = event.target.getStage();
    if (!stage) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    
    if (draggingMarkerId) {
      // Dragging a marker
      let newPosition = Math.max(0, Math.min(pointer.x / beatWidth, totalBeats));
      if (snapToGrid) {
        newPosition = snapValueToGrid(newPosition, dynamicGridDivision);
      }
      handleMarkerUpdate(draggingMarkerId, { position: newPosition });
    } else if (loopDragState) {
      updateLoopHandleFromPointer(pointer, loopDragState);
    } else if (isDragging) {
      updatePlayheadFromPointer(pointer);
    }
  };
  
  const handlePointerUp = () => {
    if (draggingMarkerId) {
      handleMarkerUpdateFlush();
      setDraggingMarkerId(null);
    }
    setIsDragging(false);
    setLoopDragState(null);
  };

  // Marker handlers
  const handleMarkerDoubleClick = useCallback((markerId: string) => {
    const marker = markers.find(m => m.id === markerId);
    if (marker) {
      setEditingMarker(marker);
    }
  }, [markers]);

  const handleMarkerSave = useCallback((description: string) => {
    if (editingMarker) {
      // Check if this is a new marker (not yet in the store)
      const existingMarker = markers.find(m => m.id === editingMarker.id);
      
      if (existingMarker) {
        // Editing existing marker
        handleMarkerUpdate(editingMarker.id, { description });
        handleMarkerUpdateFlush();
      } else {
        // Adding new marker
        const newMarker = { ...editingMarker, description };
        handleMarkerAdd(newMarker);
        selectMarker(newMarker.id);
      }
    }
    setEditingMarker(null);
  }, [editingMarker, markers, handleMarkerUpdate, handleMarkerUpdateFlush, handleMarkerAdd, selectMarker]);

  const handleMarkerCancel = useCallback(() => {
    setEditingMarker(null);
  }, []);

  // Handle keyboard delete for markers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditMode && selectedMarkerId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handleMarkerDelete(selectedMarkerId);
        selectMarker(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, selectedMarkerId, handleMarkerDelete, selectMarker]);

  // Generate grid markers based on dynamic grid subdivision
  const gridMarkers = useMemo(() => {
    const markerList = [];
    for (let beat = 0; beat <= totalBeats; beat += gridInterval) {
      const x = beat * beatWidth;
      const isBar = isBarLine(beat, beatsInBar);
      const isBeat = isBeatLine(beat);
      markerList.push({
        x,
        isBar,
        isBeat,
        isSubBeat: !isBar && !isBeat,
        label: isBar ? Math.floor(beat / beatsInBar) + 1 : null,
      });
    }
    return markerList;
  }, [totalBeats, beatWidth, gridInterval, beatsInBar]);

  const playheadX = playheadBeats * beatWidth;

  return (
    <>
      <MarkerEditDialog
        marker={editingMarker}
        onSave={handleMarkerSave}
        onCancel={handleMarkerCancel}
      />
      <div className="relative overflow-hidden border-b border-base-300 bg-base-200">
        <div style={{ position: 'relative', left: -scrollLeft, width: width }}>
        <Stage
          width={width}
          height={height}
          perfectDrawEnabled={false}
          onPointerDown={handlePointerDown}
          onTouchStart={(e) => handlePointerDown(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerMove={handlePointerMove}
          onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
        >
        <Layer>
          {/* Clickable background */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
          />
          {/* Bottom border */}
          <Line
            points={[0, height - 1, width, height - 1]}
            stroke="#a1a1aa"
            strokeWidth={1}
            listening={false}
            perfectDrawEnabled={false}
          />
          {/* Beat/bar grid markers */}
          {gridMarkers.map((marker) => {
            // Bar lines: full height, thick, dark
            if (marker.isBar) {
              return (
                <Line
                  key={`marker-${marker.x}`}
                  points={[marker.x, height, marker.x, 0]}
                  stroke="#52525b"
                  strokeWidth={2}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              );
            }
            // Beat lines: medium height, medium weight
            if (marker.isBeat) {
              return (
                <Line
                  key={`marker-${marker.x}`}
                  points={[marker.x, height, marker.x, height * 0.35]}
                  stroke="#a1a1aa"
                  strokeWidth={1}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              );
            }
            // Sub-beat lines: short height, thin, light
            return (
              <Line
                key={`marker-${marker.x}`}
                points={[marker.x, height, marker.x, height * 0.6]}
                stroke="#d4d4d8"
                strokeWidth={1}
                opacity={0.5}
                listening={false}
                perfectDrawEnabled={false}
              />
            );
          })}
          {/* Bar labels */}
          {gridMarkers
            .filter((marker) => marker.isBar && marker.label !== null)
            .map((marker) => (
              <Text
                key={`label-${marker.x}`}
                text={`${marker.label}`}
                x={marker.x + 4}
                y={4}
                fontSize={12}
                fill="#52525b"
                listening={false}
                perfectDrawEnabled={false}
              />
            ))}
          
          {/* Time markers */}
          {markers.map((marker) => (
            <TimeRulerMarker
              key={marker.id}
              marker={marker}
              pixelsPerBeat={pixelsPerBeat}
              zoom={zoom}
              height={height}
              isEditMode={isEditMode}
              isSelected={marker.id === selectedMarkerId}
              onDoubleClick={handleMarkerDoubleClick}
            />
          ))}
          {/* Loop region highlight */}
          {loop.enabled && (
            <Rect
              x={loop.start * beatWidth}
              y={0}
              width={(loop.end - loop.start) * beatWidth}
              height={height}
              fill="#fbbf24"
              opacity={0.25}
              listening={false}
            />
          )}
          
          {/* Loop start handle */}
          {loop.enabled && (
            <Rect
              name="loop-start-handle"
              x={loop.start * beatWidth - 3}
              y={0}
              width={6}
              height={height}
              fill="#fbbf24"
              stroke="#f59e0b"
              strokeWidth={1}
            />
          )}
          
          {/* Loop end handle */}
          {loop.enabled && (
            <Rect
              name="loop-end-handle"
              x={loop.end * beatWidth - 3}
              y={0}
              width={6}
              height={height}
              fill="#fbbf24"
              stroke="#f59e0b"
              strokeWidth={1}
            />
          )}
          
          {/* Playhead indicator */}
          <Line
            points={[playheadX, 0, playheadX, height]}
            stroke="#3b82f6"
            strokeWidth={2}
            listening={false}
          />
        </Layer>
        </Stage>
        </div>
      </div>
    </>
  );
};

export const TimeRuler = memo(TimeRulerComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.totalBeats === nextProps.totalBeats &&
    prevProps.pixelsPerBeat === nextProps.pixelsPerBeat &&
    prevProps.zoom === nextProps.zoom &&
    prevProps.scrollLeft === nextProps.scrollLeft &&
    prevProps.height === nextProps.height &&
    prevProps.timeSignature.numerator === nextProps.timeSignature.numerator &&
    prevProps.timeSignature.denominator === nextProps.timeSignature.denominator &&
    prevProps.playheadBeats === nextProps.playheadBeats
  );
});

