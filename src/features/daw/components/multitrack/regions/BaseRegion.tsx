import type { KonvaEventObject } from 'konva/lib/Node';
import { Group, Rect, Text } from 'react-konva';
import type { BaseRegionProps, RegionContentProps } from './types';
import { MidiRegionContent } from './MidiRegionContent';
import { AudioRegionContent } from './AudioRegionContent';
import { RegionHandles } from './RegionHandles';

const HANDLE_SIZE = 8;

interface ExtendedBaseRegionProps extends BaseRegionProps {
  headResizeState?: RegionContentProps['headResizeState'];
  onHeadHandleDown: (event: KonvaEventObject<PointerEvent>) => void;
  onLengthHandleDown: (event: KonvaEventObject<PointerEvent>) => void;
  onLoopHandleDown: (event: KonvaEventObject<PointerEvent>) => void;
}

export const BaseRegion = ({
  region,
  x,
  y,
  width,
  height,
  beatWidth,
  isSelected,
  isMovingToNewTrack,
  loops,
  headResizeState,
  onPointerDown,
  onHeadHandleDown,
  onLengthHandleDown,
  onLoopHandleDown,
}: ExtendedBaseRegionProps) => {
  return (
    <Group>
      {/* Draw each loop iteration */}
      {Array.from({ length: loops }).map((_, loopIndex) => {
        const loopX = x + loopIndex * width;
        const isMainLoop = loopIndex === 0;

        return (
          <Group key={`${region.id}-loop-${loopIndex}`}>
            {/* Loop block background */}
            <Rect
              x={loopX}
              y={y}
              width={width}
              height={height}
              fill={
                isMainLoop
                  ? isSelected
                    ? region.color
                    : `${region.color}AA`
                  : `${region.color}88`
              }
              stroke={isMovingToNewTrack ? '#10b981' : isSelected ? '#ffffff' : '#1f2937'}
              strokeWidth={isMovingToNewTrack ? 3 : isSelected ? 2 : 1}
              dash={isMovingToNewTrack ? [6, 3] : undefined}
              cornerRadius={4}
              onPointerDown={isMainLoop ? onPointerDown : undefined}
              listening={isMainLoop}
            />

            {/* Region content - MIDI or Audio */}
            {region.type === 'midi' ? (
              <MidiRegionContent
                region={region}
                loopX={loopX}
                y={y}
                width={width}
                height={height}
                beatWidth={beatWidth}
                isMainLoop={isMainLoop}
                length={region.length}
                headResizeState={headResizeState}
              />
            ) : (
              <AudioRegionContent
                region={region}
                loopX={loopX}
                y={y}
                width={width}
                height={height}
                beatWidth={beatWidth}
                isMainLoop={isMainLoop}
                length={region.length}
                headResizeState={headResizeState}
              />
            )}
          </Group>
        );
      })}

      {/* Region name (only on first loop) */}
      <Text
        x={x + 8}
        y={y + 6}
        text={region.name}
        fontSize={12}
        fill="#1f2937"
        listening={false}
      />

      {/* Region handles */}
      <RegionHandles
        x={x}
        y={y}
        width={width}
        height={height}
        loops={loops}
        handleSize={HANDLE_SIZE}
        onHeadHandleDown={onHeadHandleDown}
        onLengthHandleDown={onLengthHandleDown}
        onLoopHandleDown={onLoopHandleDown}
      />
    </Group>
  );
};

