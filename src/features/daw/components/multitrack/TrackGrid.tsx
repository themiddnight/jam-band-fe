import { memo } from "react";
import { Rect, Layer } from "react-konva";
import { getGridLineStyle } from "../../utils/gridUtils";

interface TrackGridProps {
  visibleStartBeat: number;
  visibleEndBeat: number;
  totalBeats: number;
  gridInterval: number;
  beatWidth: number;
  height: number;
  beatsInBar: number;
  stageOffsetX: number;
}

export const TrackGrid = memo(({
  visibleStartBeat,
  visibleEndBeat,
  totalBeats,
  gridInterval,
  beatWidth,
  height,
  beatsInBar,
  stageOffsetX
}: TrackGridProps) => {
  const beatLines = [];
  const startBeat = Math.floor(visibleStartBeat / gridInterval) * gridInterval;
  const endBeat = Math.min(Math.ceil(visibleEndBeat), totalBeats);

  for (let beat = startBeat; beat <= endBeat; beat += gridInterval) {
    const x = beat * beatWidth;
    const style = getGridLineStyle(beat, beatsInBar);

    beatLines.push(
      <Rect
        key={`beat-${beat}`}
        x={x}
        y={0}
        width={style.weight}
        height={height}
        fill={style.color}
        opacity={style.opacity}
        listening={false}
      />
    );
  }

  return (
    <Layer listening={false} x={-stageOffsetX}>
      {beatLines}
    </Layer>
  );
});

TrackGrid.displayName = "TrackGrid";
