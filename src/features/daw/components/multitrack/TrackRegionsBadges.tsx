import { memo } from "react";
import { getRegionLockId } from "../../utils/collaborationLocks";
import type { Track, Region, RegionId } from "../../types/daw";
import type { DragState, HeadResizeState, ResizeState } from "./types";

interface TrackRegionsBadgesProps {
  tracks: Track[];
  visibleRegions: Region[];
  trackYPositions: Record<string, { y: number; height: number }>;
  beatWidth: number;
  dragState: DragState | null;
  resizeState: ResizeState | null;
  headResizeState: HeadResizeState | null;
  dragOffsets: Record<RegionId, number>;
  lockMap: Map<string, any>;
  currentUserId: string | null;
}

export const TrackRegionsBadges = memo(({
  tracks,
  visibleRegions,
  trackYPositions,
  beatWidth,
  dragState,
  resizeState,
  headResizeState,
  dragOffsets,
  lockMap,
  currentUserId
}: TrackRegionsBadgesProps) => {
  return (
    <>
      {visibleRegions.map((region) => {
        const lock = lockMap.get(getRegionLockId(region.id));
        const isLockedByRemote = Boolean(lock && lock.userId !== currentUserId);
        
        if (!isLockedByRemote || !lock) return null;

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
        
        // IMPORTANT: Subtract stageOffsetX because this is an absolute HTML overlay on top of the container
        // Wait, TrackCanvas renders badges inside:
        // <div className="pointer-events-none absolute left-0 top-0" style={{ width, height }}>
        // So they are positioned relative to the full scrollable area (width/height).
        // BUT the container has `relative` and scrolling is native?
        // No, `TrackCanvas` container has `width` and `height` and `overflow`? 
        // TrackCanvas has `touchAction: pan-x pan-y`.
        // The parent usually handles scroll.
        // If the parent scrolls, then `left: 0, top: 0` is correct and we use absolute coordinates (without stageOffsetX subtraction).
        // Let's check TrackCanvas again.
        
        /* 
          <div className="relative" style={{ width, height ... }}>
            <div style={{ position: 'absolute', left: stageOffsetX, top: 0 }}>
              {stageContent}
            </div>
            <div className="pointer-events-none absolute left-0 top-0" style={{ width, height }}>
              {badges...}
            </div>
          </div>
        */
        
        // The badges container is full width. So we use absolute X.
        const x = baseX + dragOffset * beatWidth;
        const y = pos.y + 6;
        const length = resizeState?.previewLengths?.[region.id] ?? previewLength;
        const widthPixels = length * beatWidth;

        const badgeX = x + widthPixels / 2;
        const badgeY = Math.max(0, y - 12);

        return (
          <div
            key={`region-lock-${region.id}`}
            className="absolute -translate-x-1/2"
            style={{ left: badgeX, top: badgeY }}
          >
            <div className="badge badge-xs badge-warning shadow">
              <span className="mr-1">🔒</span>
              <span>{lock.username}</span>
            </div>
          </div>
        );
      })}
    </>
  );
});

TrackRegionsBadges.displayName = "TrackRegionsBadges";
