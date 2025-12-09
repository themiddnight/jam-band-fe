import { useMemo, memo } from "react";
import { Stage } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { TRACK_HEIGHT } from "./constants";
import { useLockStore } from "../../stores/lockStore";
import { useUserStore } from "@/shared/stores/userStore";
import { useRecordingStore, type RemoteRecordingPreview } from "../../stores/recordingStore";
import { useProjectStore } from "../../stores/projectStore";
import { getGridDivisionForZoom, getGridInterval } from "../../utils/gridUtils";
import { beatsPerBar } from "../../utils/timeUtils";
import type { Region, RegionId, Track, TimeSignature } from "../../types/daw";
import type { RegionRealtimeUpdate } from "../../contexts/DAWCollaborationContext.shared";
import type { RegionDragUpdatePayload } from "../../services/dawSyncService";

import { useTrackInteractions } from "../../hooks/useTrackInteractions";
import { TrackBackgrounds } from "./TrackBackgrounds";
import { TrackGrid } from "./TrackGrid";
import { TrackRegionsLayer } from "./TrackRegionsLayer";
import { RecordingPreviews } from "./RecordingPreviews";
import { MarqueeOverlay } from "./MarqueeOverlay";
import { TrackRegionsBadges } from "./TrackRegionsBadges";

interface TrackCanvasProps {
  tracks: Track[];
  regions: Region[];
  selectedTrackId: string | null;
  selectedRegionIds: RegionId[];
  totalBeats: number;
  pixelsPerBeat: number;
  zoom: number;
  scrollLeft: number;
  viewportWidth: number;
  viewportHeight?: number;
  timeSignature: TimeSignature;
  trackHeights?: Record<string, number>;
  onSelectTrack: (trackId: string) => void;
  onSelectRegion: (regionId: RegionId, additive?: boolean) => void;
  onToggleRegionSelection: (regionId: RegionId) => void;
  onClearRegionSelection: () => void;
  onCreateRegion: (trackId: string, startBeat: number) => void;
  onMoveRegions: (regionIds: RegionId[], deltaBeats: number) => void;
  onMoveRegionsToTrack: (regionIds: RegionId[], targetTrackId: string, deltaBeats: number) => void;
  onResizeRegion: (regionId: RegionId, newLength: number) => void;
  onSetLoopIterations: (regionId: RegionId, iterations: number) => void;
  onHeadResizeRegion?: (regionId: RegionId, updates: Partial<Region>) => void;
  onMarqueeSelect: (regionIds: RegionId[], additive: boolean) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
  onRegionDragStart?: (regionIds: RegionId[]) => boolean;
  onRegionDragRealtime?: (updates: RegionDragUpdatePayload[]) => void;
  onRegionDragEnd?: (regionIds: RegionId[]) => void;
  onRegionRealtimeUpdates?: (updates: RegionRealtimeUpdate[]) => void;
  onRegionRealtimeFlush?: () => void;
}

const TrackCanvasComponent = ({
  tracks,
  regions,
  selectedTrackId,
  selectedRegionIds,
  totalBeats,
  pixelsPerBeat,
  zoom,
  scrollLeft,
  viewportWidth,
  timeSignature,
  trackHeights = {},
  onSelectTrack,
  onSelectRegion,
  onToggleRegionSelection,
  onClearRegionSelection,
  onCreateRegion,
  onMoveRegions,
  onMoveRegionsToTrack,
  onResizeRegion,
  onSetLoopIterations,
  onHeadResizeRegion,
  onMarqueeSelect,
  onPan,
  onRegionDragStart,
  onRegionDragRealtime,
  onRegionDragEnd,
  onRegionRealtimeUpdates,
  onRegionRealtimeFlush,
}: TrackCanvasProps) => {
  const lockMap = useLockStore((state) => state.locks);
  const currentUserId = useUserStore((state) => state.userId);

  // Full content width (for wrapper div and positioning calculations)
  const width = totalBeats * pixelsPerBeat * zoom;
  const beatWidth = pixelsPerBeat * zoom;

  // Virtualized Stage: only render viewport + buffer, not full width
  const stageBuffer = 200;
  const stageWidth = Math.min(width, viewportWidth + stageBuffer * 2);
  const stageOffsetX = Math.max(0, Math.min(scrollLeft - stageBuffer, width - stageWidth));

  // Snap to grid state
  const snapToGrid = useProjectStore((state) => state.snapToGrid);

  // Recording preview state
  const isRecording = useRecordingStore((state) => state.isRecording);
  const recordingType = useRecordingStore((state) => state.recordingType);
  const safeRecordingType = recordingType || 'audio';
  const recordingTrackId = useRecordingStore((state) => state.recordingTrackId);
  const recordingStartBeat = useRecordingStore((state) => state.recordingStartBeat);
  const recordingDurationBeats = useRecordingStore((state) => state.recordingDurationBeats);
  const remotePreviewsMap = useRecordingStore((state) => state.remotePreviews);

  // Dynamic grid division based on zoom level
  const dynamicGridDivision = useMemo(() => getGridDivisionForZoom(zoom), [zoom]);
  const gridInterval = useMemo(() => getGridInterval(dynamicGridDivision), [dynamicGridDivision]);
  const beatsInBar = beatsPerBar(timeSignature);

  // Viewport culling
  const { visibleStartBeat, visibleEndBeat } = useMemo(() => {
    const buffer = 16;
    const startBeat = Math.max(0, (scrollLeft / beatWidth) - buffer);
    const endBeat = Math.min(totalBeats, ((scrollLeft + viewportWidth) / beatWidth) + buffer);
    return { visibleStartBeat: startBeat, visibleEndBeat: endBeat };
  }, [scrollLeft, beatWidth, viewportWidth, totalBeats]);

  // Filter regions
  const visibleRegions = useMemo(() => {
    return regions.filter(region => {
      if (selectedRegionIds.includes(region.id)) return true;
      const regionEnd = region.start + (region.loopEnabled ? region.length * region.loopIterations : region.length);
      return regionEnd >= visibleStartBeat && region.start <= visibleEndBeat;
    });
  }, [regions, visibleStartBeat, visibleEndBeat, selectedRegionIds]);

  // Calculate track positions
  const trackYPositions = useMemo(() => {
    const positions: Record<string, { y: number; height: number }> = {};
    let currentY = 0;
    tracks.forEach((track) => {
      const trackHeight = trackHeights[track.id] ?? TRACK_HEIGHT;
      positions[track.id] = { y: currentY, height: trackHeight };
      currentY += trackHeight;
    });
    return positions;
  }, [tracks, trackHeights]);

  const height = useMemo(() => {
    return (
      tracks.reduce((total, track) => {
        return total + (trackHeights[track.id] ?? TRACK_HEIGHT);
      }, 0) || TRACK_HEIGHT
    );
  }, [tracks, trackHeights]);

  const remotePreviews = useMemo<RemoteRecordingPreview[]>(() => Object.values(remotePreviewsMap), [remotePreviewsMap]);

  // Use Hook for interactions
  const {
    dragState,
    resizeState,
    headResizeState,
    loopState,
    marqueeState,
    dragOffsets,
    handleStageDoubleClick,
    handleBackgroundClick,
    handleRegionPointerDown,
    handleLengthHandleDown,
    handleLoopHandleDown,
    handleHeadHandleDown,
    handleMarqueeStart,
    handlePointerMove,
    handlePointerUp,
  } = useTrackInteractions({
    tracks,
    regions,
    selectedRegionIds,
    beatWidth,
    dynamicGridDivision,
    snapToGrid,
    stageOffsetX,
    trackYPositions,
    onSelectTrack,
    onSelectRegion,
    onToggleRegionSelection,
    onClearRegionSelection,
    onCreateRegion,
    onMoveRegions,
    onMoveRegionsToTrack,
    onResizeRegion,
    onSetLoopIterations,
    onHeadResizeRegion,
    onMarqueeSelect,
    onPan,
    onRegionDragStart,
    onRegionDragRealtime,
    onRegionDragEnd,
    onRegionRealtimeUpdates,
    onRegionRealtimeFlush,
  });

  return (
    <div
      className="relative"
      style={{
        width,
        height,
        touchAction: 'none',
      }}
    >
      {/* Stage Content */}
      <div style={{ position: 'absolute', left: stageOffsetX, top: 0 }}>
        <Stage
          width={stageWidth}
          height={height}
          perfectDrawEnabled={false}
          onDblClick={handleStageDoubleClick}
          onDblTap={handleStageDoubleClick}
          onMouseDown={handleMarqueeStart}
          onTouchStart={(e) => handleMarqueeStart(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerMove={handlePointerMove}
          onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
        >
          <TrackGrid
            visibleStartBeat={visibleStartBeat}
            visibleEndBeat={visibleEndBeat}
            totalBeats={totalBeats}
            gridInterval={gridInterval}
            beatWidth={beatWidth}
            height={height}
            beatsInBar={beatsInBar}
            stageOffsetX={stageOffsetX}
          />

          <TrackBackgrounds
            tracks={tracks}
            trackYPositions={trackYPositions}
            width={width}
            selectedTrackId={selectedTrackId}
            onBackgroundClick={handleBackgroundClick}
            stageOffsetX={stageOffsetX}
          />

          <TrackRegionsLayer
            tracks={tracks}
            visibleRegions={visibleRegions}
            trackYPositions={trackYPositions}
            beatWidth={beatWidth}
            visibleStartBeat={visibleStartBeat}
            visibleEndBeat={visibleEndBeat}
            selectedRegionIds={selectedRegionIds}
            dragState={dragState}
            resizeState={resizeState}
            headResizeState={headResizeState}
            loopState={loopState}
            dragOffsets={dragOffsets}
            lockMap={lockMap}
            currentUserId={currentUserId}
            stageOffsetX={stageOffsetX}
            onRegionPointerDown={handleRegionPointerDown}
            onHeadHandleDown={handleHeadHandleDown}
            onLengthHandleDown={handleLengthHandleDown}
            onLoopHandleDown={handleLoopHandleDown}
          />

          <RecordingPreviews
            tracks={tracks}
            trackYPositions={trackYPositions}
            beatWidth={beatWidth}
            isRecording={isRecording}
            recordingTrackId={recordingTrackId}
            recordingStartBeat={recordingStartBeat}
            recordingDurationBeats={recordingDurationBeats}
            recordingType={safeRecordingType}
            remotePreviews={remotePreviews}
            visibleStartBeat={visibleStartBeat}
            visibleEndBeat={visibleEndBeat}
            stageOffsetX={stageOffsetX}
          />

          <MarqueeOverlay
            marqueeState={marqueeState}
            stageOffsetX={stageOffsetX}
          />
        </Stage>
      </div>

      {/* HTML Overlays (Badges) */}
      <div className="pointer-events-none absolute left-0 top-0" style={{ width, height }}>
        <TrackRegionsBadges
          tracks={tracks}
          visibleRegions={visibleRegions}
          trackYPositions={trackYPositions}
          beatWidth={beatWidth}
          dragState={dragState}
          resizeState={resizeState}
          headResizeState={headResizeState}
          dragOffsets={dragOffsets}
          lockMap={lockMap}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
};

export const TrackCanvas = memo(TrackCanvasComponent);
