import React, { useState, useCallback } from 'react';
import { Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import * as Tone from 'tone';

import { RULER_HEIGHT } from './constants';
import type { TimeSignature } from '../types/daw';
import { beatsPerBar, snapToGrid } from '../utils/timeUtils';
import { getGridDivisionForZoom } from '../utils/gridUtils';
import { useProjectStore } from '../stores/projectStore';

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
PlayheadIndicator.displayName = 'PianoRollPlayheadIndicator';

interface PianoRollRulerProps {
  totalBeats: number;
  pixelsPerBeat: number;
  zoom: number;
  scrollLeft: number;
  highlightStart: number;
  highlightEnd: number;
  timeSignature: TimeSignature;
  playheadBeats?: number;
}

export const PianoRollRuler = ({
  totalBeats,
  pixelsPerBeat,
  zoom,
  scrollLeft,
  highlightStart,
  highlightEnd,
  timeSignature,
  playheadBeats = 0,
}: PianoRollRulerProps) => {
  const setPlayhead = useProjectStore((state) => state.setPlayhead);
  const snapToGridEnabled = useProjectStore((state) => state.snapToGrid);
  const [isDragging, setIsDragging] = useState(false);
  
  const width = totalBeats * pixelsPerBeat * zoom;
  const beatWidth = pixelsPerBeat * zoom;
  const beatsInBar = beatsPerBar(timeSignature);
  const highlightX = highlightStart * beatWidth;
  const highlightWidth = Math.max(0, (highlightEnd - highlightStart) * beatWidth);
  
  const updatePlayheadFromPointer = useCallback((pointer: { x: number; y: number }) => {
    // pointer.x is relative to the Stage which now starts at 0
    let absoluteBeat = Math.max(0, Math.min(pointer.x / beatWidth, totalBeats));

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
  }, [beatWidth, beatsInBar, setPlayhead, totalBeats, snapToGridEnabled, zoom]);
  
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

  const markers = [];
  for (let beat = 0; beat <= totalBeats; beat++) {
    const x = beat * beatWidth;
    const isBar = beat % beatsInBar === 0;
    markers.push({
      x,
      isBar,
      label: isBar ? Math.floor(beat / beatsInBar) + 1 : null,
    });
  }

  return (
      <div style={{ position: 'relative', left: -scrollLeft, width: width }}>
        <Stage
          width={width}
          height={RULER_HEIGHT}
          perfectDrawEnabled={false}
        onPointerDown={handlePointerDown}
        onTouchStart={(e) => handlePointerDown(e as unknown as KonvaEventObject<PointerEvent>)}
        onPointerMove={handlePointerMove}
        onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
        onPointerUp={handlePointerUp}
        onTouchEnd={handlePointerUp}
      >
      <Layer>
        {/* Background */}
        <Rect x={0} y={0} width={width} height={RULER_HEIGHT} fill="#f4f4f5" />
        {/* Region highlight */}
        <Rect
          x={highlightX}
          y={0}
          width={highlightWidth}
          height={RULER_HEIGHT}
          fill="rgba(34,197,94,0.12)"
        />
        {/* Beat/bar markers */}
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
      
      {/* Playhead: Separate memoized component */}
      <PlayheadIndicator x={playheadX} height={RULER_HEIGHT} width={width} />
      </Stage>
    </div>
  );
};

