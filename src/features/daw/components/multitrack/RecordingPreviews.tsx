import { memo } from "react";
import { Group, Layer, Rect, Text } from "react-konva";
import type { Track } from "../../types/daw";
import type { RemoteRecordingPreview } from "../../stores/recordingStore";

interface RecordingPreviewsProps {
  tracks: Track[];
  trackYPositions: Record<string, { y: number; height: number }>;
  beatWidth: number;
  isRecording: boolean;
  recordingTrackId: string | null;
  recordingStartBeat: number;
  recordingDurationBeats: number;
  recordingType: 'midi' | 'audio';
  remotePreviews: RemoteRecordingPreview[];
  visibleStartBeat: number;
  visibleEndBeat: number;
  stageOffsetX: number;
}

export const RecordingPreviews = memo(({
  tracks,
  trackYPositions,
  beatWidth,
  isRecording,
  recordingTrackId,
  recordingStartBeat,
  recordingDurationBeats,
  recordingType,
  remotePreviews,
  visibleStartBeat,
  visibleEndBeat,
  stageOffsetX
}: RecordingPreviewsProps) => {
  return (
    <Layer x={-stageOffsetX}>
      {/* Local Recording Preview */}
      {isRecording && recordingTrackId && recordingDurationBeats > 0 && (() => {
        const track = tracks.find((t) => t.id === recordingTrackId);
        if (!track) return null;

        const pos = trackYPositions[recordingTrackId];
        if (!pos) return null;

        const x = recordingStartBeat * beatWidth;
        const y = pos.y + 6;
        const regionHeight = pos.height - 12;
        const widthPixels = recordingDurationBeats * beatWidth;

        const isMidiRecording = recordingType === 'midi';

        return (
          <Group key="recording-preview">
            <Rect
              x={x}
              y={y}
              width={widthPixels}
              height={regionHeight}
              fill={isMidiRecording ? `${track.color}DD` : `${track.color}CC`}
              stroke={isMidiRecording ? "#3b82f6" : "#ef4444"}
              strokeWidth={2}
              dash={[4, 4]}
              cornerRadius={4}
              listening={false}
            />
            <Text
              x={x + 8}
              y={y + 6}
              text={isMidiRecording ? "● MIDI Recording..." : "● Recording..."}
              fontSize={12}
              fill={isMidiRecording ? "#3b82f6" : "#ef4444"}
              listening={false}
            />
          </Group>
        );
      })()}

      {/* Remote Recording Previews */}
      {remotePreviews.map((preview) => {
        const track = tracks.find((t) => t.id === preview.trackId);
        if (!track) return null;

        const pos = trackYPositions[preview.trackId];
        if (!pos) return null;

        const sanitizedStart = Math.max(0, preview.startBeat);
        const sanitizedLength = Math.max(0.25, preview.durationBeats);
        const x = sanitizedStart * beatWidth;
        const y = pos.y + 6;
        const regionHeight = pos.height - 12;
        const widthPixels = sanitizedLength * beatWidth;

        const isVisible = x + widthPixels >= visibleStartBeat * beatWidth && x <= visibleEndBeat * beatWidth;
        if (!isVisible) return null;

        const strokeColor = preview.recordingType === 'midi' ? '#a855f7' : '#f97316';
        const fillColor = (track.color ?? strokeColor) + '55';

        return (
          <Group key={`remote-preview-${preview.userId}-${preview.trackId}`}>
            <Rect
              x={x}
              y={y}
              width={widthPixels}
              height={regionHeight}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
              dash={[6, 4]}
              cornerRadius={4}
              listening={false}
            />
            <Text
              x={x + 8}
              y={y + 6}
              text={`● ${preview.username}`}
              fontSize={12}
              fill={strokeColor}
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
});

RecordingPreviews.displayName = "RecordingPreviews";
