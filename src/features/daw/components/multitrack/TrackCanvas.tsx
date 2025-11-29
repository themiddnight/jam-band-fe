import { useCallback, useMemo, useState, useRef, useEffect, memo } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Layer, Rect, Stage, Text } from "react-konva";

import { TRACK_HEIGHT } from "./constants";
import { BaseRegion, DuplicateRegionPreview } from "./regions";
import { usePianoRollStore } from "../../stores/pianoRollStore";
import { useLockStore } from "../../stores/lockStore";
import { getRegionLockId } from "../../utils/collaborationLocks";
import { useUserStore } from "@/shared/stores/userStore";
import type { AudioRegion, Region, RegionId, Track, TimeSignature } from "../../types/daw";
import type { RegionRealtimeUpdate } from "../../contexts/DAWCollaborationContext.shared";
import { snapToGrid as snapValueToGrid } from "../../utils/timeUtils";
import { getGridDivisionForZoom, getGridInterval, getGridLineStyle } from "../../utils/gridUtils";
import { beatsPerBar } from "../../utils/timeUtils";
import { useRegionStore } from "../../stores/regionStore";
import { useRecordingStore, type RemoteRecordingPreview } from "../../stores/recordingStore";
import { useProjectStore } from "../../stores/projectStore";
import type { RegionDragUpdatePayload } from "../../services/dawSyncService";

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

interface DragState {
  regionIds: RegionId[];
  originBeat: number;
  originY: number;
  delta: number;
  targetTrackId: string | null;
  isDuplicate: boolean;
  initialPositions: Record<RegionId, number>;
  initialTrackIds: Record<RegionId, string>;
}

interface PanState {
  startX: number;
  startY: number;
}

interface ResizeState {
  regionIds: RegionId[];
  originBeat: number;
  delta: number;
  initialLengths: Record<RegionId, number>;
  previewLengths: Record<RegionId, number>;
}

interface HeadResizeState {
  regionIds: RegionId[];
  originBeat: number;
  delta: number;
  initialStarts: Record<RegionId, number>;
  initialLengths: Record<RegionId, number>;
  previewStarts: Record<RegionId, number>;
  previewLengths: Record<RegionId, number>;
}

interface LoopState {
  regionIds: RegionId[];
  baseIterations: number;
  previewIterations: number;
  startX: number;
  targetLength: number;
}

interface MarqueeState {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
}

interface HoldState {
  x: number;
  y: number;
  startTime: number;
}

const HOLD_DURATION = 400; // ms - duration to hold before starting marquee
const HOLD_MOVE_THRESHOLD = 10; // pixels - max movement during hold

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
  const activePianoRegionId = usePianoRollStore((state) => state.activeRegionId);
  const setRegionPreviewStart = usePianoRollStore((state) => state.setRegionPreviewStart);
  const clearRegionPreview = usePianoRollStore((state) => state.clearRegionPreview);
  const lockMap = useLockStore((state) => state.locks);
  const currentUserId = useUserStore((state) => state.userId);
  
  // Full content width (for wrapper div and positioning calculations)
  const width = totalBeats * pixelsPerBeat * zoom;
  const beatWidth = pixelsPerBeat * zoom;
  
  // Virtualized Stage: only render viewport + buffer, not full width
  // This prevents massive canvas allocation at high zoom levels
  const stageBuffer = 200; // Extra pixels on each side for smooth scrolling
  const stageWidth = Math.min(width, viewportWidth + stageBuffer * 2);
  // Calculate offset: where in the full content does the stage start?
  const stageOffsetX = Math.max(0, Math.min(scrollLeft - stageBuffer, width - stageWidth));

  // Snap to grid state
  const snapToGrid = useProjectStore((state) => state.snapToGrid);

  // Recording preview state
  const isRecording = useRecordingStore((state) => state.isRecording);
  const recordingType = useRecordingStore((state) => state.recordingType);
  const recordingTrackId = useRecordingStore((state) => state.recordingTrackId);
  const recordingStartBeat = useRecordingStore((state) => state.recordingStartBeat);
  const recordingDurationBeats = useRecordingStore((state) => state.recordingDurationBeats);
  const remotePreviewsMap = useRecordingStore((state) => state.remotePreviews);

  // Dynamic grid division based on zoom level
  const dynamicGridDivision = useMemo(() => getGridDivisionForZoom(zoom), [zoom]);
  const gridInterval = useMemo(() => getGridInterval(dynamicGridDivision), [dynamicGridDivision]);
  const beatsInBar = beatsPerBar(timeSignature);

  // Viewport culling - calculate visible range considering zoom
  const { visibleStartBeat, visibleEndBeat } = useMemo(() => {
    const buffer = 16; // Larger buffer to ensure all regions are rendered at high zoom
    const startBeat = Math.max(0, (scrollLeft / beatWidth) - buffer);
    const endBeat = Math.min(totalBeats, ((scrollLeft + viewportWidth) / beatWidth) + buffer);
    return { visibleStartBeat: startBeat, visibleEndBeat: endBeat };
  }, [scrollLeft, beatWidth, viewportWidth, totalBeats]);

  // Filter regions to only visible ones (always include selected)
  const visibleRegions = useMemo(() => {
    return regions.filter(region => {
      if (selectedRegionIds.includes(region.id)) return true; // Always render selected
      const regionEnd = region.start + (region.loopEnabled ? region.length * region.loopIterations : region.length);
      return regionEnd >= visibleStartBeat && region.start <= visibleEndBeat;
    });
  }, [regions, visibleStartBeat, visibleEndBeat, selectedRegionIds]);

  // Calculate track Y positions based on actual heights
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

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [headResizeState, setHeadResizeState] = useState<HeadResizeState | null>(null);
  const [loopState, setLoopState] = useState<LoopState | null>(null);
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [holdState, setHoldState] = useState<HoldState | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  // Clean up hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const dragOffsets = useMemo(() => {
    if (!dragState) {
      return {};
    }
    return dragState.regionIds.reduce<Record<RegionId, number>>(
      (acc, regionId) => {
        acc[regionId] = dragState.delta;
        return acc;
      },
      {}
    );
  }, [dragState]);

  const getPointerData = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (!stage) {
        return null;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return null;
      }
      // Account for stage offset in virtualized rendering
      // pointer.x is relative to Stage, add stageOffsetX to get absolute position
      const absoluteX = pointer.x + stageOffsetX;
      const beatPosition = absoluteX / beatWidth;

      // Find track based on cumulative heights
      let trackIndex = -1;
      let track: Track | null = null;
      for (let i = 0; i < tracks.length; i++) {
        const pos = trackYPositions[tracks[i].id];
        if (pos && pointer.y >= pos.y && pointer.y < pos.y + pos.height) {
          trackIndex = i;
          track = tracks[i];
          break;
        }
      }

      return {
        beat: beatPosition,
        trackIndex,
        track,
        pointer: { ...pointer, x: absoluteX, y: pointer.y },
      };
    },
    [beatWidth, tracks, trackYPositions, stageOffsetX]
  );

  const handleStageDoubleClick = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = event.target.getStage();
      const target = event.target;
      const isBackground =
        target === stage || target?.name?.() === "track-background";
      if (!isBackground) {
        return;
      }
      const data = getPointerData(
        event as unknown as KonvaEventObject<PointerEvent>
      );
      if (!data || !data.track) {
        return;
      }
      const beat = snapToGrid ? Math.max(0, snapValueToGrid(data.beat, dynamicGridDivision)) : Math.max(0, data.beat);
      onCreateRegion(data.track.id, beat);
    },
    [getPointerData, dynamicGridDivision, onCreateRegion, snapToGrid]
  );

  const handleBackgroundClick = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const data = getPointerData(
        event as unknown as KonvaEventObject<PointerEvent>
      );
      if (!data) {
        return;
      }
      if (data.track) {
        onSelectTrack(data.track.id);
      }
      if (!event.evt.shiftKey) {
        onClearRegionSelection();
      }
    },
    [getPointerData, onClearRegionSelection, onSelectTrack]
  );

  const handleRegionPointerDown = useCallback(
    (region: Region, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;

      // Ctrl+drag for panning
      if (event.evt.ctrlKey || event.evt.metaKey) {
        const data = getPointerData(event);
        if (data) {
          setPanState({
            startX: data.pointer.x,
            startY: data.pointer.y,
          });
        }
        return;
      }

      if (event.evt.shiftKey) {
        onToggleRegionSelection(region.id);
      } else if (!selectedRegionIds.includes(region.id)) {
        onSelectRegion(region.id);
      }

      const regionIds =
        event.evt.shiftKey || selectedRegionIds.includes(region.id)
          ? Array.from(new Set([...selectedRegionIds, region.id]))
          : [region.id];

      const data = getPointerData(event);
      if (!data) {
        return;
      }
      const snappedBeat = snapToGrid ? snapValueToGrid(data.beat, dynamicGridDivision) : data.beat;
      const initialPositions: Record<RegionId, number> = {};
      const initialTrackIds: Record<RegionId, string> = {};
      regionIds.forEach((id) => {
        const regionData = regions.find((r) => r.id === id);
        if (regionData) {
          initialPositions[id] = regionData.start;
          initialTrackIds[id] = regionData.trackId;
        }
      });

      const canStart = onRegionDragStart ? onRegionDragStart(regionIds) : true;
      if (!canStart) {
        return;
      }

      setDragState({
        regionIds,
        originBeat: snappedBeat,
        originY: data.pointer.y,
        delta: 0,
        targetTrackId: null,
        isDuplicate: event.evt.altKey, // Alt key for duplication
        initialPositions,
        initialTrackIds,
      });

      if (activePianoRegionId && regionIds.includes(activePianoRegionId)) {
        const previewStart = initialPositions[activePianoRegionId];
        if (typeof previewStart === "number") {
          setRegionPreviewStart(activePianoRegionId, previewStart);
        }
      }
    },
    [
      getPointerData,
      dynamicGridDivision,
      onSelectRegion,
      onToggleRegionSelection,
      regions,
      selectedRegionIds,
      snapToGrid,
      onRegionDragStart,
      activePianoRegionId,
      setRegionPreviewStart,
    ]
  );

  const handlePointerMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      // Cancel hold if pointer moves significantly during hold
      if (holdState) {
        const stage = event.target.getStage();
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const dx = pointer.x - holdState.x;
            const dy = pointer.y - holdState.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > HOLD_MOVE_THRESHOLD) {
              if (holdTimerRef.current !== null) {
                clearTimeout(holdTimerRef.current);
                holdTimerRef.current = null;
              }
              setHoldState(null);
            }
          }
        }
      }

      if (dragState) {
        const data = getPointerData(event);
        if (!data) {
          return;
        }
        const beat = snapToGrid ? snapValueToGrid(data.beat, dynamicGridDivision) : data.beat;
        let delta = beat - dragState.originBeat;
        const minPossible = dragState.regionIds.reduce((minValue, regionId) => {
          const start = dragState.initialPositions[regionId];
          return Math.min(minValue, start);
        }, Infinity);
        delta = Math.max(delta, -minPossible);

        // Determine target track based on Y position
        const targetTrackId = data.track?.id ?? null;

        if (
          !dragState.isDuplicate &&
          onRegionDragRealtime &&
          (delta !== dragState.delta || targetTrackId !== dragState.targetTrackId)
        ) {
          const updates: RegionDragUpdatePayload[] = dragState.regionIds.map((regionId) => {
            const initialStart = dragState.initialPositions[regionId];
            const nextStart = Math.max(0, initialStart + delta);
            const fallbackTrackId = dragState.initialTrackIds[regionId];
            const nextTrackId = targetTrackId ?? fallbackTrackId;
            return {
              regionId,
              newStart: nextStart,
              trackId: nextTrackId,
            };
          });
          onRegionDragRealtime(updates);
        }

        if (activePianoRegionId && dragState.regionIds.includes(activePianoRegionId)) {
          const initialStart = dragState.initialPositions[activePianoRegionId];
          if (typeof initialStart === "number") {
            const previewStart = Math.max(0, initialStart + delta);
            setRegionPreviewStart(activePianoRegionId, previewStart);
          }
        }

        setDragState((prev) =>
          prev
            ? {
              ...prev,
              delta,
              targetTrackId,
            }
            : prev
        );
      } else if (resizeState) {
        const data = getPointerData(event);
        if (!data) {
          return;
        }

        // Calculate preview lengths using ABSOLUTE grid snapping
        const realtimeUpdates: RegionRealtimeUpdate[] = [];
        const previewLengths = resizeState.regionIds.reduce<
          Record<RegionId, number>
        >((acc, regionId) => {
          const r = regions.find((region) => region.id === regionId);
          if (!r) return acc;

          const initial = resizeState.initialLengths[regionId];

          // Calculate absolute end position
          let absoluteEnd = r.start + initial + (data.beat - resizeState.originBeat);

          // Snap absolute end position to grid if snap is enabled
          if (snapToGrid) {
            const gridSize = 4 / dynamicGridDivision;
            absoluteEnd = Math.round(absoluteEnd / gridSize) * gridSize;
          }

          // Calculate new length from start to snapped end
          let newLength = absoluteEnd - r.start;

          if (r.type === 'audio') {
            const originalLength = r.originalLength ?? initial;
            const trimStart = r.trimStart ?? 0;
            const maxLength = originalLength - trimStart;

            // Clamp to audio constraints
            const minLength = 0.25;
            newLength = Math.max(minLength, Math.min(newLength, maxLength));
          } else {
            // MIDI regions have minimum length only
            newLength = Math.max(0.25, newLength);
          }

          acc[regionId] = newLength;

          realtimeUpdates.push({
            regionId,
            updates: {
              length: newLength,
            },
          });
          return acc;
        }, {});

        setResizeState((prev) =>
          prev
            ? {
              ...prev,
              delta: data.beat - resizeState.originBeat,
              previewLengths,
            }
            : prev
        );

        if (onRegionRealtimeUpdates && realtimeUpdates.length > 0) {
          onRegionRealtimeUpdates(realtimeUpdates);
        }
      } else if (headResizeState) {
        const data = getPointerData(event);
        if (!data) {
          return;
        }

        // Calculate preview for each region using ABSOLUTE grid snapping
        const previewStarts: Record<RegionId, number> = {};
        const previewLengths: Record<RegionId, number> = {};
        const realtimeUpdates: RegionRealtimeUpdate[] = [];

        headResizeState.regionIds.forEach((regionId) => {
          const r = regions.find((region) => region.id === regionId);
          if (!r) return;

          const initialStart = headResizeState.initialStarts[regionId];
          const initialLength = headResizeState.initialLengths[regionId];
          const originalEnd = r.start + r.length;

          // Calculate new absolute start position
          let newStart = initialStart + (data.beat - headResizeState.originBeat);

          // Snap absolute start position to grid if snap is enabled
          if (snapToGrid) {
            const gridSize = 4 / dynamicGridDivision;
            newStart = Math.round(newStart / gridSize) * gridSize;
          }

          // Ensure start doesn't go negative
          newStart = Math.max(0, newStart);

          // Calculate new length from snapped start to original end
          let newLength = originalEnd - newStart;

          // For audio regions, limit based on original length and minimum length
          if (r.type === 'audio') {
            const originalLength = r.originalLength ?? initialLength;

            // Can't extend beyond what's already trimmed
            const maxLength = originalLength;
            const minLength = 0.25;

            newLength = Math.max(minLength, Math.min(newLength, maxLength));

            // Recalculate start if length was clamped
            newStart = originalEnd - newLength;
          } else {
            // MIDI regions have minimum length only
            newLength = Math.max(0.25, newLength);

            // Recalculate start if length was clamped
            newStart = originalEnd - newLength;
          }

          previewStarts[regionId] = newStart;
          previewLengths[regionId] = newLength;

          const update: RegionRealtimeUpdate = {
            regionId,
            updates: {
              start: newStart,
              length: newLength,
            },
          };

          if (r.type === 'audio') {
            const currentTrimStart = r.trimStart ?? 0;
            const actualDelta = newStart - r.start;
            (update.updates as Partial<AudioRegion>).trimStart = Math.max(0, currentTrimStart + actualDelta);
          }

          realtimeUpdates.push(update);
        });

        setHeadResizeState((prev) =>
          prev
            ? {
              ...prev,
              delta: data.beat - headResizeState.originBeat,
              previewStarts,
              previewLengths,
            }
            : prev
        );

        if (onRegionRealtimeUpdates && realtimeUpdates.length > 0) {
          onRegionRealtimeUpdates(realtimeUpdates);
        }
      } else if (loopState) {
        const stage = event.target.getStage();
        if (!stage) {
          return;
        }
        const pointer = stage.getPointerPosition();
        if (!pointer) {
          return;
        }
        const pointerX = pointer.x;
        const deltaPixels = pointerX - loopState.startX;
        const unitWidth = loopState.targetLength * beatWidth;
        if (unitWidth === 0) {
          return;
        }
        const deltaIterations = Math.round(deltaPixels / unitWidth);
        const newIterations = Math.max(
          1,
          loopState.baseIterations + deltaIterations
        );
        setLoopState((prev) =>
          prev
            ? {
              ...prev,
              previewIterations: newIterations,
            }
            : prev
        );

        if (onRegionRealtimeUpdates) {
          const updates: RegionRealtimeUpdate[] = loopState.regionIds.map((regionId) => ({
            regionId,
            updates: {
              loopEnabled: newIterations > 1,
              loopIterations: newIterations,
            },
          }));

          onRegionRealtimeUpdates(updates);
        }
      } else if (marqueeState) {
        const stage = event.target.getStage();
        if (!stage) {
          return;
        }
        const pointer = stage.getPointerPosition();
        if (!pointer) {
          return;
        }
        // Use absolute coordinates for virtualized stage
        setMarqueeState((prev) =>
          prev
            ? {
              ...prev,
              currentX: pointer.x + stageOffsetX,
              currentY: pointer.y,
            }
            : prev
        );
      } else if (panState && onPan) {
        const stage = event.target.getStage();
        if (!stage) {
          return;
        }
        const pointer = stage.getPointerPosition();
        if (!pointer) {
          return;
        }
        const deltaX = panState.startX - pointer.x;
        const deltaY = panState.startY - pointer.y;
        onPan(deltaX, deltaY);
        setPanState({
          startX: pointer.x,
          startY: pointer.y,
        });
      }
    },
    [
      beatWidth,
      dragState,
      dynamicGridDivision,
      getPointerData,
      headResizeState,
      holdState,
      loopState,
      marqueeState,
      onPan,
      panState,
      regions,
      resizeState,
      snapToGrid,
      stageOffsetX,
      onRegionDragRealtime,
      onRegionRealtimeUpdates,
      activePianoRegionId,
      setRegionPreviewStart,
    ]
  );

  const handlePointerUp = useCallback(() => {
    if ((resizeState || headResizeState || loopState) && onRegionRealtimeFlush) {
      onRegionRealtimeFlush();
    }

    if (dragState) {
      if (onRegionDragEnd) {
        onRegionDragEnd(dragState.regionIds);
      }
      if (dragState.isDuplicate) {
        // Alt+drag: Duplicate regions
        const { duplicateRegion } = useRegionStore.getState();
        dragState.regionIds.forEach((regionId) => {
          duplicateRegion(regionId, dragState.delta);
        });
      } else {
        // Normal drag: Move regions
        const isTrackChange = dragState.targetTrackId &&
          dragState.regionIds.some(id => dragState.initialTrackIds[id] !== dragState.targetTrackId);

        if (isTrackChange && dragState.targetTrackId) {
          // Move to different track (only if all regions were on the same track initially)
          const allSameTrack = dragState.regionIds.every(id =>
            dragState.initialTrackIds[id] === dragState.initialTrackIds[dragState.regionIds[0]]
          );
          if (allSameTrack) {
            onMoveRegionsToTrack(dragState.regionIds, dragState.targetTrackId, dragState.delta);
          } else if (dragState.delta !== 0) {
            // Different initial tracks, just move horizontally
            onMoveRegions(dragState.regionIds, dragState.delta);
          }
        } else if (dragState.delta !== 0) {
          // Same track, just move horizontally
          onMoveRegions(dragState.regionIds, dragState.delta);
        }
      }
      setDragState(null);
      if (activePianoRegionId && dragState.regionIds.includes(activePianoRegionId)) {
        clearRegionPreview(activePianoRegionId);
      }
    }
    if (panState) {
      setPanState(null);
    }
    if (resizeState) {
      resizeState.regionIds.forEach((regionId) => {
        const length = resizeState.previewLengths[regionId];
        if (typeof length === "number") {
          onResizeRegion(regionId, length);
        }
      });
      setResizeState(null);
    }
    if (headResizeState) {
      const applyHeadResize =
        onHeadResizeRegion ??
        ((regionId: RegionId, updates: Partial<Region>) => {
          const { updateRegion } = useRegionStore.getState();
          updateRegion(regionId, updates);
        });
      headResizeState.regionIds.forEach((regionId) => {
        const r = regions.find((region) => region.id === regionId);
        if (!r) return;

        const newStart = headResizeState.previewStarts[regionId];
        const newLength = headResizeState.previewLengths[regionId];
        const actualDelta = newStart - r.start;

        if (typeof newStart === 'number' && typeof newLength === 'number' && actualDelta !== 0) {
          // For audio regions, update trim offset
          if (r.type === 'audio') {
            const currentTrimStart = r.trimStart ?? 0;
            // When moving start right (positive delta), we're trimming more from the start
            applyHeadResize(regionId, {
              start: newStart,
              length: newLength,
              trimStart: currentTrimStart + actualDelta,
            });
          } else if (r.type === 'midi') {
            // For MIDI regions, adjust note positions to maintain absolute timeline position
            // When region.start moves right by delta, notes need to move left by delta (relatively)
            // Notes can exist outside the visible region bounds (negative start or beyond length)
            const adjustedNotes = r.notes.map((note) => ({
              ...note,
              start: note.start - actualDelta, // Subtract delta to maintain absolute position
            }));

            // Also adjust sustain events
            const adjustedSustainEvents = r.sustainEvents.map((event) => ({
              ...event,
              start: event.start - actualDelta,
              end: event.end - actualDelta,
            }));

            applyHeadResize(regionId, {
              start: newStart,
              length: newLength,
              notes: adjustedNotes,
              sustainEvents: adjustedSustainEvents,
            });
          }
        }
      });
      setHeadResizeState(null);
    }
    if (loopState) {
      loopState.regionIds.forEach((regionId) => {
        onSetLoopIterations(regionId, loopState.previewIterations);
      });
      setLoopState(null);
    }
    if (marqueeState) {
      const x1 = Math.min(marqueeState.originX, marqueeState.currentX);
      const x2 = Math.max(marqueeState.originX, marqueeState.currentX);
      const y1 = Math.min(marqueeState.originY, marqueeState.currentY);
      const y2 = Math.max(marqueeState.originY, marqueeState.currentY);

      const selected = regions
        .filter((region) => {
          const track = tracks.find((t) => t.id === region.trackId);
          if (!track) {
            return false;
          }
          const pos = trackYPositions[track.id];
          if (!pos) {
            return false;
          }
          const regionX = region.start * beatWidth;
          const regionWidth =
            region.length *
            beatWidth *
            (region.loopEnabled ? region.loopIterations : 1);
          const regionY = pos.y;
          const regionBottom = regionY + pos.height;
          const regionRight = regionX + regionWidth;
          return (
            regionX < x2 &&
            regionRight > x1 &&
            regionY < y2 &&
            regionBottom > y1
          );
        })
        .map((region) => region.id);

      onMarqueeSelect(selected, marqueeState.additive);
      setMarqueeState(null);
    }

    // Clean up hold state and timer
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdState) {
      setHoldState(null);
    }
  }, [
    beatWidth,
    dragState,
    headResizeState,
    holdState,
    loopState,
    marqueeState,
    onHeadResizeRegion,
    onMarqueeSelect,
    onMoveRegions,
    onMoveRegionsToTrack,
    onResizeRegion,
    onSetLoopIterations,
    onRegionDragEnd,
    onRegionRealtimeFlush,
    panState,
    regions,
    resizeState,
    trackYPositions,
    tracks,
    activePianoRegionId,
    clearRegionPreview,
  ]);

  const handleLengthHandleDown = useCallback(
    (region: Region, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      const data = getPointerData(event);
      if (!data) {
        return;
      }
      const regionIds = selectedRegionIds.includes(region.id)
        ? selectedRegionIds
        : [region.id];
      const originBeat = snapToGrid ? snapValueToGrid(data.beat, dynamicGridDivision) : data.beat;
      const initialLengths = regionIds.reduce<Record<RegionId, number>>(
        (acc, id) => {
          const target = regions.find((r) => r.id === id);
          if (target) {
            acc[id] = target.length;
          }
          return acc;
        },
        {}
      );
      setResizeState({
        regionIds,
        originBeat,
        delta: 0,
        initialLengths,
        previewLengths: { ...initialLengths },
      });
    },
    [getPointerData, dynamicGridDivision, regions, selectedRegionIds, snapToGrid]
  );

  const handleLoopHandleDown = useCallback(
    (region: Region, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      const data = getPointerData(event);
      if (!data) {
        return;
      }
      const pointerX = data.pointer.x;
      const regionIds = selectedRegionIds.includes(region.id)
        ? selectedRegionIds
        : [region.id];
      const baseIterations = region.loopEnabled ? region.loopIterations : 1;
      setLoopState({
        regionIds,
        baseIterations,
        previewIterations: baseIterations,
        startX: pointerX,
        targetLength: region.length,
      });
    },
    [getPointerData, selectedRegionIds]
  );

  const handleHeadHandleDown = useCallback(
    (region: Region, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      const data = getPointerData(event);
      if (!data) {
        return;
      }
      const regionIds = selectedRegionIds.includes(region.id)
        ? selectedRegionIds
        : [region.id];

      const initialStarts = regionIds.reduce<Record<RegionId, number>>((acc, id) => {
        const r = regions.find((r) => r.id === id);
        if (r) {
          acc[id] = r.start;
        }
        return acc;
      }, {});

      const initialLengths = regionIds.reduce<Record<RegionId, number>>((acc, id) => {
        const r = regions.find((r) => r.id === id);
        if (r) {
          acc[id] = r.length;
        }
        return acc;
      }, {});

      setHeadResizeState({
        regionIds,
        originBeat: data.beat,
        delta: 0,
        initialStarts,
        initialLengths,
        previewStarts: { ...initialStarts },
        previewLengths: { ...initialLengths },
      });
    },
    [getPointerData, regions, selectedRegionIds]
  );

  const handleMarqueeStart = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (!stage) {
        return;
      }
      const target = event.target;
      const isBackground =
        target === stage || target.name() === "track-background";
      if (!isBackground) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }

      // Convert to absolute coordinates for virtualized stage
      const absoluteX = pointer.x + stageOffsetX;

      // Ctrl+drag for panning
      if (event.evt.ctrlKey || event.evt.metaKey) {
        setPanState({
          startX: pointer.x,
          startY: pointer.y,
        });
        return;
      }

      // Check if this is a touch event
      const isTouch = event.evt.pointerType === 'touch' ||
        'touches' in event.evt;

      if (isTouch) {
        // For touch on empty space: start panning immediately with single finger
        // Also start hold timer - if user holds without moving, switch to marquee
        setPanState({
          startX: pointer.x,
          startY: pointer.y,
        });
        
        setHoldState({
          x: pointer.x,
          y: pointer.y,
          startTime: Date.now(),
        });

        holdTimerRef.current = window.setTimeout(() => {
          // After hold duration without significant movement, start marquee selection
          // The panState will be cleared when marquee starts
          setPanState(null);
          setMarqueeState({
            originX: absoluteX,
            originY: pointer.y,
            currentX: absoluteX,
            currentY: pointer.y,
            additive: event.evt.shiftKey,
          });
          setHoldState(null);
          holdTimerRef.current = null;
        }, HOLD_DURATION);
      } else {
        // For mouse: immediately start marquee selection (use absolute coords)
        setMarqueeState({
          originX: absoluteX,
          originY: pointer.y,
          currentX: absoluteX,
          currentY: pointer.y,
          additive: event.evt.shiftKey,
        });
      }
    },
    [stageOffsetX]
  );

  // Dynamic grid lines based on zoom level - only render visible beats
  const beatLines = [];
  const startBeat = Math.floor(visibleStartBeat / gridInterval) * gridInterval;
  const endBeat = Math.min(Math.ceil(visibleEndBeat), totalBeats);

  // Draw grid lines at subdivision intervals
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
      />
    );
  }

  const regionBadgePositions: Array<{ regionId: string; x: number; y: number; width: number }> = [];

  const stageContent = (
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
      {/* Static Layer: Grid and track backgrounds - offset by stageOffsetX */}
      <Layer listening={false} x={-stageOffsetX}>
        {beatLines}
      </Layer>

      {/* Interactive Layer: Tracks and regions - offset by stageOffsetX */}
      <Layer x={-stageOffsetX}>
        {tracks.map((track) => {
          const pos = trackYPositions[track.id];
          if (!pos) {
            return null;
          }
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
                fill={
                  isSelected
                    ? "#1d4ed80f"
                    : 'transparent'
                }
                onMouseDown={handleBackgroundClick}
                onTouchStart={(e) => handleBackgroundClick(e as unknown as KonvaEventObject<MouseEvent>)}
              />
              <Rect
                x={0}
                y={y + trackHeight - 1}
                width={width}
                height={1}
                fill="#888888aa"
              />
            </Group>
          );
        })}
        {/* Only render visible regions for better performance */}
        {visibleRegions.map((region) => {
          const isDragging = dragState?.regionIds.includes(region.id);
          const isDuplicating = isDragging && dragState?.isDuplicate;

          // For duplication, render original at original position
          const shouldRenderOriginal = !isDragging || isDuplicating;

          // Determine which track to use for rendering
          const effectiveTrackId = isDragging && dragState?.targetTrackId && !isDuplicating
            ? dragState.targetTrackId
            : region.trackId;

          const track = tracks.find((t) => t.id === effectiveTrackId);
          if (!track) {
            return null;
          }
          const pos = trackYPositions[track.id];
          if (!pos) {
            return null;
          }

          // Apply head resize preview
          const headResizing = headResizeState?.regionIds.includes(region.id);
          const previewStart = headResizing ? (headResizeState?.previewStarts[region.id] ?? region.start) : region.start;
          const previewLength = headResizing ? (headResizeState?.previewLengths[region.id] ?? region.length) : region.length;

          const baseX = previewStart * beatWidth;
          const dragOffset = shouldRenderOriginal ? 0 : (dragOffsets[region.id] ?? 0);
          const x = baseX + dragOffset * beatWidth;
          const y = pos.y + 6;
          const regionHeight = pos.height - 12;
          const length =
            resizeState?.previewLengths?.[region.id] ?? previewLength;
          const baseLoopIterations = region.loopEnabled
            ? region.loopIterations
            : 1;
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
          if (isLockedByRemote) {
            regionBadgePositions.push({ regionId: region.id, x, y, width: widthPixels });
          }

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
              onPointerDown={(e) => handleRegionPointerDown(region, e)}
              onHeadHandleDown={(e) => handleHeadHandleDown(region, e)}
              onLengthHandleDown={(e) => handleLengthHandleDown(region, e)}
              onLoopHandleDown={(e) => handleLoopHandleDown(region, e)}
            />
          );
        })}

        {/* Duplicate previews when Alt+dragging */}
        {dragState?.isDuplicate && visibleRegions
          .filter(region => dragState.regionIds.includes(region.id))
          .map((region) => {
            const dragOffset = dragOffsets[region.id] ?? 0;
            if (dragOffset === 0) {
              return null;
            }

            const effectiveTrackId = dragState.targetTrackId ?? region.trackId;
            const track = tracks.find((t) => t.id === effectiveTrackId);
            if (!track) {
              return null;
            }
            const pos = trackYPositions[track.id];
            if (!pos) {
              return null;
            }

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

        {/* Recording preview - show extending region during recording */}
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

        {/* Remote recording previews */}
        {remotePreviews.map((preview) => {
          const track = tracks.find((t) => t.id === preview.trackId);
          if (!track) {
            return null;
          }

          const pos = trackYPositions[preview.trackId];
          if (!pos) {
            return null;
          }

          const sanitizedStart = Math.max(0, preview.startBeat);
          const sanitizedLength = Math.max(0.25, preview.durationBeats);
          const x = sanitizedStart * beatWidth;
          const y = pos.y + 6;
          const regionHeight = pos.height - 12;
          const widthPixels = sanitizedLength * beatWidth;

          const isVisible = x + widthPixels >= visibleStartBeat * beatWidth && x <= visibleEndBeat * beatWidth;
          if (!isVisible) {
            return null;
          }

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

        {marqueeState && (
          <Rect
            x={Math.min(marqueeState.originX, marqueeState.currentX)}
            y={Math.min(marqueeState.originY, marqueeState.currentY)}
            width={Math.abs(marqueeState.currentX - marqueeState.originX)}
            height={Math.abs(marqueeState.currentY - marqueeState.originY)}
            fill="rgba(59,130,246,0.15)"
            stroke="#2563eb"
            dash={[4, 4]}
          />
        )}
      </Layer>
    </Stage>
  );

  return (
    <div 
      className="relative" 
      style={{ 
        width, 
        height,
        // Allow browser to handle scroll gestures for better performance
        touchAction: 'pan-x pan-y',
      }}
    >
      {/* Position the virtualized Stage at the correct scroll offset */}
      <div style={{ position: 'absolute', left: stageOffsetX, top: 0 }}>
        {stageContent}
      </div>
      <div className="pointer-events-none absolute left-0 top-0" style={{ width, height }}>
        {regionBadgePositions.map(({ regionId, x, y, width: regionWidth }) => {
          const lock = lockMap.get(getRegionLockId(regionId));
          if (!lock) {
            return null;
          }
          const badgeX = x + regionWidth / 2;
          const badgeY = Math.max(0, y - 12);
          return (
            <div
              key={`region-lock-${regionId}`}
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
      </div>
    </div>
  );
};

// Memoize TrackCanvas with shallow comparison for arrays/objects
export const TrackCanvas = memo(TrackCanvasComponent);
