import { Rect } from 'react-konva';
import type { RegionHandlesProps } from './types';

export const RegionHandles = ({
  x,
  y,
  width,
  height,
  loops,
  handleSize,
  onHeadHandleDown,
  onLengthHandleDown,
  onLoopHandleDown,
}: RegionHandlesProps) => {
  return (
    <>
      {/* Head handle (top-left) - trim from start */}
      <Rect
        x={x}
        y={y}
        width={handleSize}
        height={height}
        fill="#25fdff88"
        onPointerDown={onHeadHandleDown}
        onPointerEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'ew-resize';
        }}
        onPointerLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
        draggable={false}
      />

      {/* Length handle (top-right) - resize cursor */}
      <Rect
        x={x + width * loops - handleSize}
        y={y}
        width={handleSize}
        height={height / 2}
        fill="#25fdff88"
        onPointerDown={onLengthHandleDown}
        onPointerEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'ew-resize';
        }}
        onPointerLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
        draggable={false}
      />

      {/* Loop handle (bottom-right) - loop cursor */}
      <Rect
        x={x + width * loops - handleSize}
        y={y + height / 2}
        width={handleSize}
        height={height / 2}
        fill="#65a3ff88"
        onPointerDown={onLoopHandleDown}
        onPointerEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'alias';
        }}
        onPointerLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
        draggable={false}
      />
    </>
  );
};

