import { Rect } from 'react-konva';
import type { MarqueeSelectionProps } from './types';

export const MarqueeSelection = ({
  originX,
  originY,
  currentX,
  currentY,
}: MarqueeSelectionProps) => {
  return (
    <Rect
      x={Math.min(originX, currentX)}
      y={Math.min(originY, currentY)}
      width={Math.abs(currentX - originX)}
      height={Math.abs(currentY - originY)}
      fill="rgba(59,130,246,0.15)"
      stroke="#2563eb"
      dash={[4, 4]}
    />
  );
};

