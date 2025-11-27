import { getGridDivisionForZoom, getGridInterval, isBarLine, isBeatLine } from '@/features/daw/utils/gridUtils';
import { memo, useMemo, useState, useCallback } from 'react';
import { Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import * as Tone from 'tone';
import { useProjectStore } from '@/features/daw/stores/projectStore';
import { snapToGrid } from '@/features/daw/utils/timeUtils';

interface TimeRulerProps {
  totalBeats: number;
  pixelsPerBeat: number;
  zoomX: number;
  regionStart: number; // Region's position on main timeline
  trimStart: number;
  trimEnd: number;
  scrollLeft?: number;
  viewportWidth?: number;
  playheadBeats?: number;
}

const RULER_HEIGHT = 36;

const TimeRulerComponent = ({
  totalBeats,
  pixelsPerBeat,
  zoomX,
  regionStart,
  trimStart,
  trimEnd,
  scrollLeft = 0,
  viewportWidth = 1200,
  playheadBeats = 0,
}: TimeRulerProps) => {
  const setPlayhead = useProjectStore((state) => state.setPlayhead);
  const snapToGridEnabled = useProjectStore((state) => state.snapToGrid);
  const [isDragging, setIsDragging] = useState(false);
  
  const beatWidth = pixelsPerBeat * zoomX;
  const fullWidth = totalBeats * beatWidth;
  
  // Virtualized Stage: only render viewport + buffer
  const stageBuffer = 100;
  const stageWidth = Math.min(fullWidth, viewportWidth + stageBuffer * 2);
  const stageOffsetX = Math.max(0, Math.min(scrollLeft - stageBuffer, fullWidth - stageWidth));

  // Calculate absolute start position (where the full waveform starts on main timeline)
  // If region starts at beat 1 and trimStart is 0.5, the waveform starts at 0.5 on main timeline
  const absoluteStartBeat = regionStart - trimStart;

  const updatePlayheadFromPointer = useCallback((pointer: { x: number; y: number }, currentStageOffsetX: number) => {
    // Convert pointer position to absolute beat on main timeline (add stageOffsetX for virtualized stage)
    let absoluteBeat = absoluteStartBeat + ((pointer.x + currentStageOffsetX) / beatWidth);
    absoluteBeat = Math.max(0, absoluteBeat);

    if (snapToGridEnabled) {
      const division = getGridDivisionForZoom(zoomX);
      absoluteBeat = snapToGrid(absoluteBeat, division);
    }
    
    // Update store
    setPlayhead(absoluteBeat);
    
    // Update Tone.js Transport position without stopping
    const bars = Math.floor(absoluteBeat / 4); // 4 beats per bar
    const beats = absoluteBeat % 4;
    Tone.Transport.position = `${bars}:${beats}:0`;
  }, [absoluteStartBeat, beatWidth, setPlayhead, snapToGridEnabled, zoomX]);
  
  const handlePointerDown = useCallback((event: KonvaEventObject<PointerEvent>) => {
    const stage = event.target.getStage();
    if (!stage) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    setIsDragging(true);
    updatePlayheadFromPointer(pointer, stageOffsetX);
  }, [updatePlayheadFromPointer, stageOffsetX]);
  
  const handlePointerMove = useCallback((event: KonvaEventObject<PointerEvent>) => {
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
    updatePlayheadFromPointer(pointer, stageOffsetX);
  }, [isDragging, updatePlayheadFromPointer, stageOffsetX]);
  
  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Dynamic grid division based on zoom level
  const dynamicGridDivision = useMemo(() => getGridDivisionForZoom(zoomX), [zoomX]);
  const gridInterval = useMemo(() => getGridInterval(dynamicGridDivision), [dynamicGridDivision]);

  // Generate markers based on absolute timeline positions
  const markers = useMemo(() => {
    const markerList = [];
    
    // Calculate the range of beats to show on ruler
    const firstBeat = Math.floor(absoluteStartBeat / gridInterval) * gridInterval;
    const lastBeat = absoluteStartBeat + totalBeats;
    
    for (let beat = firstBeat; beat <= lastBeat; beat += gridInterval) {
      const x = (beat - absoluteStartBeat) * beatWidth;
      const isBar = isBarLine(beat, 4); // 4 beats per bar
      const isBeat = isBeatLine(beat);
      markerList.push({
        x,
        beat,
        isBar,
        isBeat,
        isSubBeat: !isBar && !isBeat,
        label: isBar ? Math.floor(beat / 4) + 1 : null,
      });
    }
    return markerList;
  }, [absoluteStartBeat, totalBeats, beatWidth, gridInterval]);

  // Calculate positions relative to waveform start
  const playheadX = (playheadBeats - absoluteStartBeat) * beatWidth;
  const trimStartX = trimStart * beatWidth;
  const trimEndX = trimEnd * beatWidth;

  return (
    <div style={{ position: 'relative', width: fullWidth, height: RULER_HEIGHT }}>
      {/* Virtualized Stage - positioned at stageOffsetX */}
      <div style={{ position: 'absolute', left: stageOffsetX, top: 0 }}>
        <Stage 
          width={stageWidth} 
          height={RULER_HEIGHT} 
          perfectDrawEnabled={false} 
          style={{ scrollbarWidth: 'none' }}
          onPointerDown={handlePointerDown}
          onTouchStart={(e) => handlePointerDown(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerMove={handlePointerMove}
          onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
        >
          <Layer x={-stageOffsetX}>
            {/* Background */}
            <Rect x={0} y={0} width={fullWidth} height={RULER_HEIGHT} fill="#18181b" />

        {/* Trimmed region highlight */}
        <Rect
          x={trimStartX}
          y={0}
          width={trimEndX - trimStartX}
          height={RULER_HEIGHT}
          fill="#10b981"
          opacity={0.15}
        />

            {/* Bottom border */}
            <Line
              points={[0, RULER_HEIGHT - 1, fullWidth, RULER_HEIGHT - 1]}
              stroke="#a1a1aa"
              strokeWidth={1}
            />

        {/* Beat/bar markers */}
        {markers.map((marker) => {
          // Bar lines: full height, thick, dark
          if (marker.isBar) {
            return (
              <Line
                key={`marker-${marker.x}`}
                points={[marker.x, RULER_HEIGHT, marker.x, 0]}
                stroke="#52525b"
                strokeWidth={2}
              />
            );
          }
          // Beat lines: medium height, medium weight
          if (marker.isBeat) {
            return (
              <Line
                key={`marker-${marker.x}`}
                points={[marker.x, RULER_HEIGHT, marker.x, RULER_HEIGHT * 0.35]}
                stroke="#a1a1aa"
                strokeWidth={1}
              />
            );
          }
          // Sub-beat lines: short height, thin, light
          return (
            <Line
              key={`marker-${marker.x}`}
              points={[marker.x, RULER_HEIGHT, marker.x, RULER_HEIGHT * 0.6]}
              stroke="#d4d4d8"
              strokeWidth={1}
              opacity={0.5}
            />
          );
        })}

        {/* Bar labels - show bar numbers matching main timeline */}
        {markers
          .filter((marker) => marker.isBar && marker.label)
          .map((marker) => (
            <Text
              key={`label-${marker.x}`}
              text={`${marker.label}`}
              x={marker.x + 4}
              y={4}
              fontSize={11}
              fill="#a1a1aa"
            />
          ))}

            {/* Playhead indicator */}
            {playheadX >= 0 && playheadX <= fullWidth && (
              <Line
                points={[playheadX, 0, playheadX, RULER_HEIGHT]}
                stroke="#3b82f6"
                strokeWidth={2}
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export const TimeRuler = memo(TimeRulerComponent);