import { useMemo } from 'react';
import { Layer, Line, Rect, Stage, Text } from 'react-konva';
import { getGridDivisionForZoom, getGridInterval, isBarLine, isBeatLine } from '../../utils/gridUtils';

interface TimeRulerProps {
  totalBeats: number;
  pixelsPerBeat: number;
  zoomX: number;
  regionStart: number; // Region's position on main timeline
  trimStart: number;
  trimEnd: number;
  playheadBeats?: number;
}

const RULER_HEIGHT = 36;

export const TimeRuler = ({
  totalBeats,
  pixelsPerBeat,
  zoomX,
  regionStart,
  trimStart,
  trimEnd,
  playheadBeats = 0,
}: TimeRulerProps) => {
  const beatWidth = pixelsPerBeat * zoomX;
  const width = totalBeats * beatWidth;

  // Calculate absolute start position (where the full waveform starts on main timeline)
  // If region starts at beat 1 and trimStart is 0.5, the waveform starts at 0.5 on main timeline
  const absoluteStartBeat = regionStart - trimStart;

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
    <Stage width={width} height={RULER_HEIGHT} perfectDrawEnabled={false} style={{ scrollbarWidth: 'none' }}>
      <Layer>
        {/* Background */}
        <Rect x={0} y={0} width={width} height={RULER_HEIGHT} fill="#18181b" />

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
          points={[0, RULER_HEIGHT - 1, width, RULER_HEIGHT - 1]}
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

        {/* Beat labels - show actual beat positions from main timeline */}
        {markers
          .filter((marker) => marker.isBeat)
          .map((marker) => {
            // Show the actual beat number from main timeline (rounded for display)
            const beatLabel = Math.round(marker.beat);
            const isBar = marker.isBar;
            return (
              <Text
                key={`label-${marker.x}`}
                text={`${beatLabel}`}
                x={marker.x + 4}
                y={4}
                fontSize={11}
                fill={isBar ? "#a1a1aa" : "#71717a"}
                opacity={isBar ? 1 : 0.7}
              />
            );
          })}

        {/* Playhead indicator */}
        {playheadX >= 0 && playheadX <= width && (
          <Line
            points={[playheadX, 0, playheadX, RULER_HEIGHT]}
            stroke="#3b82f6"
            strokeWidth={2}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
};

