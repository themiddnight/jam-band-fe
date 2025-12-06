import { memo } from "react";
import { Layer } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { BaseRegion, DuplicateRegionPreview } from "./regions";
import { getRegionLockId } from "../../utils/collaborationLocks";
import type { Track, Region, RegionId } from "../../types/daw";
import type { DragState, ResizeState, HeadResizeState, LoopState } from "./types";

interface TrackRegionsLayerProps {
  tracks: Track[];
  visibleRegions: Region[];
  trackYPositions: Record<string, { y: number; height: number }>;
  beatWidth: number;
  visibleStartBeat: number;
  visibleEndBeat: number;
  selectedRegionIds: RegionId[];
  dragState: DragState | null;
  resizeState: ResizeState | null;
  headResizeState: HeadResizeState | null;
  loopState: LoopState | null;
  dragOffsets: Record<RegionId, number>;
  lockMap: Map<string, any>;
  currentUserId: string | null;
  stageOffsetX: number;
  
  onRegionPointerDown: (region: Region, event: KonvaEventObject<PointerEvent>) => void;
  onHeadHandleDown: (region: Region, event: KonvaEventObject<PointerEvent>) => void;
  onLengthHandleDown: (region: Region, event: KonvaEventObject<PointerEvent>) => void;
  onLoopHandleDown: (region: Region, event: KonvaEventObject<PointerEvent>) => void;
}

export const TrackRegionsLayer = memo(({
  tracks,
  visibleRegions,
  trackYPositions,
  beatWidth,
  visibleStartBeat,
  visibleEndBeat,
  selectedRegionIds,
  dragState,
  resizeState,
  headResizeState,
  loopState,
  dragOffsets,
  lockMap,
  currentUserId,
  stageOffsetX,
  onRegionPointerDown,
  onHeadHandleDown,
  onLengthHandleDown,
  onLoopHandleDown
}: TrackRegionsLayerProps) => {
  return (
    <Layer x={-stageOffsetX}>
      {visibleRegions.map((region) => {
        const isDragging = dragState?.regionIds.includes(region.id);
        const isDuplicating = isDragging && dragState?.isDuplicate;
        const shouldRenderOriginal = !isDragging || isDuplicating;

        let effectiveTrackId = region.trackId;
        if (isDragging && dragState && !isDuplicating) {
          const allSameTrack = dragState.regionIds.every(id =>
            dragState.initialTrackIds[id] === dragState.initialTrackIds[dragState.regionIds[0]]
          );
          if (allSameTrack && dragState.targetTrackId) {
            effectiveTrackId = dragState.targetTrackId;
          } else {
            effectiveTrackId = dragState.initialTrackIds[region.id] ?? region.trackId;
          }
        }

        const track = tracks.find((t) => t.id === effectiveTrackId);
        if (!track) return null;
        
        const pos = trackYPositions[track.id];
        if (!pos) return null;

        const headResizing = headResizeState?.regionIds.includes(region.id);
        const previewStart = headResizing ? (headResizeState?.previewStarts[region.id] ?? region.start) : region.start;
        const previewLength = headResizing ? (headResizeState?.previewLengths[region.id] ?? region.length) : region.length;

        const baseX = previewStart * beatWidth;
        const dragOffset = shouldRenderOriginal ? 0 : (dragOffsets[region.id] ?? 0);
        const x = baseX + dragOffset * beatWidth;
        const y = pos.y + 6;
        const regionHeight = pos.height - 12;
        
        const length = resizeState?.previewLengths?.[region.id] ?? previewLength;
        
        const baseLoopIterations = region.loopEnabled ? region.loopIterations : 1;
        const loopActive = loopState?.regionIds.includes(region.id) ?? false;
        const loopPreviewEnabled = loopActive
          ? loopState?.previewIterations && loopState.previewIterations > 1
          : region.loopEnabled;
        const activeLoopIterations = loopActive
          ? loopState?.previewIterations ?? 0
          : baseLoopIterations;
        const loops = loopPreviewEnabled ? activeLoopIterations : 1;
        
        const widthPixels = length * beatWidth;
        const isSelected = selectedRegionIds.includes(region.id);
        const isMovingToNewTrack = Boolean(isDragging && effectiveTrackId !== region.trackId);

        const lock = lockMap.get(getRegionLockId(region.id));
        const isLockedByRemote = Boolean(lock && lock.userId !== currentUserId);

        return (
          <BaseRegion
            key={region.id}
            region={region}
            x={x}
            y={y}
            width={widthPixels}
            height={regionHeight}
            beatWidth={beatWidth}
            isSelected={isSelected}
            isMovingToNewTrack={isMovingToNewTrack}
            loops={loops}
            isLockedByRemote={isLockedByRemote}
            headResizeState={headResizeState?.regionIds.includes(region.id) ? headResizeState : undefined}
            viewportStartBeat={visibleStartBeat}
            viewportEndBeat={visibleEndBeat}
            onPointerDown={(e) => onRegionPointerDown(region, e)}
            onHeadHandleDown={(e) => onHeadHandleDown(region, e)}
            onLengthHandleDown={(e) => onLengthHandleDown(region, e)}
            onLoopHandleDown={(e) => onLoopHandleDown(region, e)}
          />
        );
      })}

      {/* Duplicate previews */}
      {dragState?.isDuplicate && visibleRegions
        .filter(region => dragState.regionIds.includes(region.id))
        .map((region) => {
          const dragOffset = dragOffsets[region.id] ?? 0;
          if (dragOffset === 0) return null;

          const allSameTrack = dragState.regionIds.every(id =>
            dragState.initialTrackIds[id] === dragState.initialTrackIds[dragState.regionIds[0]]
          );
          const effectiveTrackId = (allSameTrack && dragState.targetTrackId)
            ? dragState.targetTrackId
            : (dragState.initialTrackIds[region.id] ?? region.trackId);
            
          const track = tracks.find((t) => t.id === effectiveTrackId);
          if (!track) return null;
          
          const pos = trackYPositions[track.id];
          if (!pos) return null;

          const baseX = region.start * beatWidth;
          const x = baseX + dragOffset * beatWidth;
          const y = pos.y + 6;
          const regionHeight = pos.height - 12;
          const widthPixels = region.length * beatWidth;

          return (
            <DuplicateRegionPreview
              key={`duplicate-preview-${region.id}`}
              region={region}
              x={x}
              y={y}
              width={widthPixels}
              height={regionHeight}
              beatWidth={beatWidth}
            />
          );
        })}
    </Layer>
  );
});

TrackRegionsLayer.displayName = "TrackRegionsLayer";
