import { memo } from "react";
import { Rect, Layer } from "react-konva";
import type { MarqueeState } from "./types";

interface MarqueeOverlayProps {
  marqueeState: MarqueeState | null;
  stageOffsetX: number;
}

export const MarqueeOverlay = memo(({ marqueeState, stageOffsetX }: MarqueeOverlayProps) => {
  if (!marqueeState) return null;

  return (
    <Layer x={-stageOffsetX}>
      <Rect
        x={Math.min(marqueeState.originX, marqueeState.currentX)}
        y={Math.min(marqueeState.originY, marqueeState.currentY)}
        width={Math.abs(marqueeState.currentX - marqueeState.originX)}
        height={Math.abs(marqueeState.currentY - marqueeState.originY)}
        fill="rgba(59,130,246,0.15)"
        stroke="#2563eb"
        dash={[4, 4]}
        listening={false}
      />
    </Layer>
  );
});

MarqueeOverlay.displayName = "MarqueeOverlay";
