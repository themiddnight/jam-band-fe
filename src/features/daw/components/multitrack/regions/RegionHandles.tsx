import type { KonvaEventObject } from 'konva/lib/Node';
import { Rect } from 'react-konva';
import type { RegionHandlesProps } from './types';

export const RegionHandles = ({
  x,
  y,
  width,
  height,
  loops,
  handleSize,
  disabled = false,
  onHeadHandleDown,
  onLengthHandleDown,
  onLoopHandleDown,
}: RegionHandlesProps) => {
  const setCursor = (event: KonvaEventObject<PointerEvent>, cursor: string) => {
    const container = event.target.getStage()?.container();
    if (!container) {
      return;
    }
    container.style.cursor = cursor;
  };

  return (
    <>
      {/* Head handle (top-left) - trim from start */}
      <Rect
        x={x}
        y={y}
        width={handleSize}
        height={height}
        fill="#25fdff88"
        onPointerDown={disabled ? undefined : onHeadHandleDown}
        onPointerEnter={(e) => setCursor(e, disabled ? 'not-allowed' : 'ew-resize')}
        onPointerLeave={(e) => setCursor(e, 'default')}
        draggable={false}
      />

      {/* Length handle (top-right) - resize cursor */}
      <Rect
        x={x + width * loops - handleSize}
        y={y}
        width={handleSize}
        height={height / 2}
        fill="#25fdff88"
        onPointerDown={disabled ? undefined : onLengthHandleDown}
        onPointerEnter={(e) => setCursor(e, disabled ? 'not-allowed' : 'ew-resize')}
        onPointerLeave={(e) => setCursor(e, 'default')}
        draggable={false}
      />

      {/* Loop handle (bottom-right) - loop cursor */}
      <Rect
        x={x + width * loops - handleSize}
        y={y + height / 2}
        width={handleSize}
        height={height / 2}
        fill="#65a3ff88"
        onPointerDown={disabled ? undefined : onLoopHandleDown}
        onPointerEnter={(e) => setCursor(e, disabled ? 'not-allowed' : 'alias')}
        onPointerLeave={(e) => setCursor(e, 'default')}
        draggable={false}
      />
    </>
  );
};

