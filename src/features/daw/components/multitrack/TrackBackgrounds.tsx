import { memo } from "react";
import { Layer, Rect, Group } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Track } from "../../types/daw";

interface TrackBackgroundsProps {
  tracks: Track[];
  trackYPositions: Record<string, { y: number; height: number }>;
  width: number;
  selectedTrackId: string | null;
  onBackgroundClick: (event: KonvaEventObject<MouseEvent>) => void;
  stageOffsetX: number;
}

export const TrackBackgrounds = memo(({
  tracks,
  trackYPositions,
  width,
  selectedTrackId,
  onBackgroundClick,
  stageOffsetX
}: TrackBackgroundsProps) => {
  return (
    <Layer x={-stageOffsetX}>
      {tracks.map((track) => {
        const pos = trackYPositions[track.id];
        if (!pos) return null;
        
        const { y, height: trackHeight } = pos;
        const isSelected = track.id === selectedTrackId;
        
        return (
          <Group key={track.id}>
            <Rect
              name="track-background"
              x={0}
              y={y}
              width={width}
              height={trackHeight - 1}
              fill={isSelected ? "#1d4ed80f" : 'transparent'}
              onMouseDown={onBackgroundClick}
              onTouchStart={(e) => onBackgroundClick(e as unknown as KonvaEventObject<MouseEvent>)}
            />
            <Rect
              x={0}
              y={y + trackHeight - 1}
              width={width}
              height={1}
              fill="#888888aa"
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
});

TrackBackgrounds.displayName = "TrackBackgrounds";
