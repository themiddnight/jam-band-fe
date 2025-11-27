import React, { useState, useCallback, useMemo, memo } from 'react';
import { Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import * as Tone from 'tone';

import { RULER_HEIGHT } from './constants';
import type { TimeSignature } from '@/features/daw/types/daw';
import { getGridDivisionForZoom } from '@/features/daw/utils/gridUtils';
import { beatsPerBar, snapToGrid } from '@/features/daw/utils/timeUtils';
import { useProjectStore } from '@/features/daw/stores/projectStore';

// Memoized playhead component - needs layer offset for virtualized stage
const PlayheadIndicator = React.memo<{ x: number; height: number; width: number; layerOffset?: number }>(
  ({ x, height, width, layerOffset = 0 }) => {
    if (x < 0 || x > width) return null;
    
    return (
      <Layer listening={false} x={layerOffset}>
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
PlayheadIndicator.displayName = 'PianoRollPlayheadIndicator';

interface PianoRollRulerProps {
  totalBeats: number;
  pixelsPerBeat: number;
  zoom: number;
  scrollLeft: number;
  viewportWidth?: number;
  highlightStart: number;
  highlightEnd: number;
  timeSignature: TimeSignature;
  playheadBeats?: number;
}

const PianoRollRulerComponent = ({
  totalBeats,
  pixelsPerBeat,
  zoom,
  scrollLeft,
  viewportWidth = 1200,
  highlightStart,
  highlightEnd,
  timeSignature,
  playheadBeats = 0,
}: PianoRollRulerProps) => {
  const setPlayhead = useProjectStore((state) => state.setPlayhead);
  const snapToGridEnabled = useProjectStore((state) => state.snapToGrid);
  const [isDragging, setIsDragging] = useState(false);
  
  // Full content width
  const fullWidth = totalBeats * pixelsPerBeat * zoom;
  const beatWidth = pixelsPerBeat * zoom;
  const beatsInBar = beatsPerBar(timeSignature);
  const highlightX = highlightStart * beatWidth;
  const highlightWidth = Math.max(0, (highlightEnd - highlightStart) * beatWidth);
  
  // Virtualized Stage: only render viewport + buffer, not full width
  const stageBuffer = 100;
  const stageWidth = Math.min(fullWidth, viewportWidth + stageBuffer * 2);
  const stageOffsetX = Math.max(0, Math.min(scrollLeft - stageBuffer, fullWidth - stageWidth));
  
  const updatePlayheadFromPointer = useCallback((pointer: { x: number; y: number }) => {
    // pointer.x is relative to Stage, add offset for virtualized stage
    const absoluteX = pointer.x + stageOffsetX;
    let absoluteBeat = Math.max(0, Math.min(absoluteX / beatWidth, totalBeats));

    if (snapToGridEnabled) {
      const division = getGridDivisionForZoom(zoom);
      absoluteBeat = snapToGrid(absoluteBeat, division);
    }
    
    // Update store
    setPlayhead(absoluteBeat);
    
    // Update Tone.js Transport position without stopping
    const bars = Math.floor(absoluteBeat / beatsInBar);
    const beats = absoluteBeat % beatsInBar;
    Tone.Transport.position = `${bars}:${beats}:0`;
  }, [beatWidth, beatsInBar, setPlayhead, totalBeats, snapToGridEnabled, zoom, stageOffsetX]);
  
  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
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
    if (!isDragging) {
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
    updatePlayheadFromPointer(pointer);
  };
  
  const handlePointerUp = () => {
    setIsDragging(false);
  };
  
  // Since we're showing absolute timeline, playhead should be at absolute position
  const playheadX = playheadBeats * beatWidth;

  // Calculate visible beat range for viewport culling
  const { visibleStartBeat, visibleEndBeat } = useMemo(() => {
    const buffer = 4; // Extra beats to render for smooth scrolling
    const startBeat = Math.max(0, Math.floor(scrollLeft / beatWidth) - buffer);
    const endBeat = Math.min(totalBeats, Math.ceil((scrollLeft + viewportWidth) / beatWidth) + buffer);
    return { visibleStartBeat: startBeat, visibleEndBeat: endBeat };
  }, [scrollLeft, beatWidth, viewportWidth, totalBeats]);

  // Only generate markers for visible beats
  const markers = useMemo(() => {
    const markerList = [];
    const startBeat = Math.floor(visibleStartBeat);
    const endBeat = Math.min(Math.ceil(visibleEndBeat), totalBeats);
    
    for (let beat = startBeat; beat <= endBeat; beat++) {
      const x = beat * beatWidth;
      const isBar = beat % beatsInBar === 0;
      markerList.push({
        x,
        isBar,
        label: isBar ? Math.floor(beat / beatsInBar) + 1 : null,
      });
    }
    return markerList;
  }, [visibleStartBeat, visibleEndBeat, totalBeats, beatWidth, beatsInBar]);

  return (
    <div style={{ position: 'relative', left: -scrollLeft, width: fullWidth, height: RULER_HEIGHT }}>
      {/* Virtualized Stage - left:-scrollLeft simulates scroll for overflow:hidden parent */}
      <div style={{ position: 'absolute', left: stageOffsetX, top: 0 }}>
        <Stage
          width={stageWidth}
          height={RULER_HEIGHT}
          perfectDrawEnabled={false}
          onPointerDown={handlePointerDown}
          onTouchStart={(e) => handlePointerDown(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerMove={handlePointerMove}
          onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
        >
          <Layer x={-stageOffsetX}>
            {/* Background */}
            <Rect x={0} y={0} width={fullWidth} height={RULER_HEIGHT} fill="#f4f4f5" />
            {/* Region highlight */}
            <Rect
              x={highlightX}
              y={0}
              width={highlightWidth}
              height={RULER_HEIGHT}
              fill="rgba(34,197,94,0.12)"
            />
            {/* Beat/bar markers - only visible ones */}
            {markers.map((marker) => (
              <Rect
                key={`marker-${marker.x}`}
                x={marker.x}
                y={0}
                width={1}
                height={RULER_HEIGHT}
                fill={marker.isBar ? '#6b7280' : '#d4d4d8'}
              />
            ))}
            {/* Bar labels */}
            {markers
              .filter((marker) => marker.isBar && marker.label !== null)
              .map((marker) => (
                <Text
                  key={`label-${marker.x}`}
                  text={`${marker.label}`}
                  x={marker.x + 4}
                  y={8}
                  fontSize={12}
                  fill="#334155"
                />
              ))}
          </Layer>
          
          {/* Playhead: Separate memoized component with layer offset */}
          <PlayheadIndicator x={playheadX} height={RULER_HEIGHT} width={fullWidth} layerOffset={-stageOffsetX} />
        </Stage>
      </div>
    </div>
  );
};

export const PianoRollRuler = memo(PianoRollRulerComponent);