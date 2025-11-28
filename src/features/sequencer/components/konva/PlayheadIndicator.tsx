import { memo } from 'react';
import { Layer, Rect } from 'react-konva';
import { KONVA_GRID, COLORS } from './constants';

interface PlayheadIndicatorProps {
  currentBeat: number;
  height: number;
  isRecording: boolean;
  layerOffset: number;
}

export const PlayheadIndicator = memo(({
  currentBeat,
  height,
  isRecording,
  layerOffset,
}: PlayheadIndicatorProps) => {
  const x = currentBeat * (KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP);
  const width = KONVA_GRID.CELL_SIZE
  
  const strokeColor = isRecording ? COLORS.PLAYHEAD_RECORDING : COLORS.PLAYHEAD;
  const fillColor = isRecording 
    ? 'rgba(248, 114, 114, 0.1)' 
    : 'rgba(99, 102, 241, 0.1)';
  
  return (
    <Layer x={-layerOffset} listening={false}>
      <Rect
        x={x}
        y={0}
        width={width}
        height={height}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        cornerRadius={4}
        shadowColor={strokeColor}
        shadowBlur={isRecording ? 8 : 4}
        shadowOpacity={0.5}
      />
    </Layer>
  );
});

PlayheadIndicator.displayName = 'PlayheadIndicator';
