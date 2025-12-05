import { useCallback, useEffect, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { usePianoRollStore } from "../stores/pianoRollStore";
import { useRegionStore } from "../stores/regionStore";
import type { Region, RegionId, Track, AudioRegion } from "../types/daw";
import type { RegionRealtimeUpdate } from "../contexts/DAWCollaborationContext.shared";
import type { RegionDragUpdatePayload } from "../services/dawSyncService";
import { snapToGrid as snapValueToGrid } from "../utils/timeUtils";
import type {
  DragState,
  ResizeState,
  HeadResizeState,
  LoopState,
  MarqueeState,
  PanState,
  HoldState
} from "../components/multitrack/types";

const HOLD_DURATION = 400; // ms
const HOLD_MOVE_THRESHOLD = 10; // pixels

interface UseTrackInteractionsProps {
  tracks: Track[];
  regions: Region[];
  selectedRegionIds: RegionId[];
  beatWidth: number;
  dynamicGridDivision: number;
  snapToGrid: boolean;
  stageOffsetX: number;
  trackYPositions: Record<string, { y: number; height: number }>;
  
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

export const useTrackInteractions = ({
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
}: UseTrackInteractionsProps) => {
  const activePianoRegionId = usePianoRollStore((state) => state.activeRegionId);
  const setRegionPreviewStart = usePianoRollStore((state) => state.setRegionPreviewStart);
  const clearRegionPreview = usePianoRollStore((state) => state.clearRegionPreview);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [headResizeState, setHeadResizeState] = useState<HeadResizeState | null>(null);
  const [loopState, setLoopState] = useState<LoopState | null>(null);
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [holdState, setHoldState] = useState<HoldState | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  // Clean up hold timer
  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const dragOffsets = dragState ? dragState.regionIds.reduce<Record<RegionId, number>>((acc, regionId) => {
    acc[regionId] = dragState.delta;
    return acc;
  }, {}) : {};

  const getPointerData = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (!stage) return null;

      const pointer = stage.getPointerPosition();
      if (!pointer) return null;

      const absoluteX = pointer.x + stageOffsetX;
      const beatPosition = absoluteX / beatWidth;

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
      const isBackground = target === stage || target?.name?.() === "track-background";
      if (!isBackground) return;

      const data = getPointerData(event as unknown as KonvaEventObject<PointerEvent>);
      if (!data || !data.track) return;

      const beat = snapToGrid ? Math.max(0, snapValueToGrid(data.beat, dynamicGridDivision)) : Math.max(0, data.beat);
      onCreateRegion(data.track.id, beat);
    },
    [getPointerData, dynamicGridDivision, onCreateRegion, snapToGrid]
  );

  const handleBackgroundClick = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const data = getPointerData(event as unknown as KonvaEventObject<PointerEvent>);
      if (!data) return;

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

      const regionIds = event.evt.shiftKey || selectedRegionIds.includes(region.id)
        ? Array.from(new Set([...selectedRegionIds, region.id]))
        : [region.id];

      const data = getPointerData(event);
      if (!data) return;

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
      if (!canStart) return;

      setDragState({
        regionIds,
        originBeat: snappedBeat,
        originY: data.pointer.y,
        delta: 0,
        targetTrackId: null,
        isDuplicate: event.evt.altKey,
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

  const handleLengthHandleDown = useCallback(
    (region: Region, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      const data = getPointerData(event);
      if (!data) return;

      const regionIds = selectedRegionIds.includes(region.id) ? selectedRegionIds : [region.id];
      const originBeat = snapToGrid ? snapValueToGrid(data.beat, dynamicGridDivision) : data.beat;
      const initialLengths = regionIds.reduce<Record<RegionId, number>>((acc, id) => {
        const target = regions.find((r) => r.id === id);
        if (target) acc[id] = target.length;
        return acc;
      }, {});

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
      if (!data) return;

      const regionIds = selectedRegionIds.includes(region.id) ? selectedRegionIds : [region.id];
      const baseIterations = region.loopEnabled ? region.loopIterations : 1;
      
      setLoopState({
        regionIds,
        baseIterations,
        previewIterations: baseIterations,
        startX: data.pointer.x,
        targetLength: region.length,
      });
    },
    [getPointerData, selectedRegionIds]
  );

  const handleHeadHandleDown = useCallback(
    (region: Region, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      const data = getPointerData(event);
      if (!data) return;

      const regionIds = selectedRegionIds.includes(region.id) ? selectedRegionIds : [region.id];
      const initialStarts = regionIds.reduce<Record<RegionId, number>>((acc, id) => {
        const r = regions.find((r) => r.id === id);
        if (r) acc[id] = r.start;
        return acc;
      }, {});
      const initialLengths = regionIds.reduce<Record<RegionId, number>>((acc, id) => {
        const r = regions.find((r) => r.id === id);
        if (r) acc[id] = r.length;
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
      if (!stage) return;

      const target = event.target;
      const isBackground = target === stage || target.name() === "track-background";
      if (!isBackground) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const absoluteX = pointer.x + stageOffsetX;

      if (event.evt.ctrlKey || event.evt.metaKey) {
        setPanState({
          startX: pointer.x,
          startY: pointer.y,
        });
        return;
      }

      const isTouch = event.evt.pointerType === 'touch' || 'touches' in event.evt;

      if (isTouch) {
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

  const handlePointerMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
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
        if (!data) return;

        const beat = snapToGrid ? snapValueToGrid(data.beat, dynamicGridDivision) : data.beat;
        let delta = beat - dragState.originBeat;
        
        const minPossible = dragState.regionIds.reduce((minValue, regionId) => {
          const start = dragState.initialPositions[regionId];
          return Math.min(minValue, start);
        }, Infinity);
        delta = Math.max(delta, -minPossible);

        const targetTrackId = data.track?.id ?? null;

        if (
          !dragState.isDuplicate &&
          onRegionDragRealtime &&
          (delta !== dragState.delta || targetTrackId !== dragState.targetTrackId)
        ) {
          const allSameTrack = dragState.regionIds.every(id =>
            dragState.initialTrackIds[id] === dragState.initialTrackIds[dragState.regionIds[0]]
          );

          const updates: RegionDragUpdatePayload[] = dragState.regionIds.map((regionId) => {
            const initialStart = dragState.initialPositions[regionId];
            const nextStart = Math.max(0, initialStart + delta);
            const fallbackTrackId = dragState.initialTrackIds[regionId];
            const nextTrackId = (allSameTrack && targetTrackId) ? targetTrackId : fallbackTrackId;
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

        setDragState((prev) => prev ? { ...prev, delta, targetTrackId } : prev);

      } else if (resizeState) {
        const data = getPointerData(event);
        if (!data) return;

        const realtimeUpdates: RegionRealtimeUpdate[] = [];
        const previewLengths = resizeState.regionIds.reduce<Record<RegionId, number>>((acc, regionId) => {
          const r = regions.find((region) => region.id === regionId);
          if (!r) return acc;

          const initial = resizeState.initialLengths[regionId];
          let absoluteEnd = r.start + initial + (data.beat - resizeState.originBeat);

          if (snapToGrid) {
            const gridSize = 4 / dynamicGridDivision;
            absoluteEnd = Math.round(absoluteEnd / gridSize) * gridSize;
          }

          let newLength = absoluteEnd - r.start;

          if (r.type === 'audio') {
            const originalLength = r.originalLength ?? initial;
            const trimStart = r.trimStart ?? 0;
            const maxLength = originalLength - trimStart;
            const minLength = 0.25;
            newLength = Math.max(minLength, Math.min(newLength, maxLength));
          } else {
            newLength = Math.max(0.25, newLength);
          }

          acc[regionId] = newLength;

          realtimeUpdates.push({
            regionId,
            updates: { length: newLength },
          });
          return acc;
        }, {});

        setResizeState((prev) => prev ? { ...prev, delta: data.beat - resizeState.originBeat, previewLengths } : prev);

        if (onRegionRealtimeUpdates && realtimeUpdates.length > 0) {
          onRegionRealtimeUpdates(realtimeUpdates);
        }

      } else if (headResizeState) {
        const data = getPointerData(event);
        if (!data) return;

        const previewStarts: Record<RegionId, number> = {};
        const previewLengths: Record<RegionId, number> = {};
        const realtimeUpdates: RegionRealtimeUpdate[] = [];

        headResizeState.regionIds.forEach((regionId) => {
          const r = regions.find((region) => region.id === regionId);
          if (!r) return;

          const initialStart = headResizeState.initialStarts[regionId];
          const initialLength = headResizeState.initialLengths[regionId];
          const originalEnd = r.start + r.length;

          let newStart = initialStart + (data.beat - headResizeState.originBeat);

          if (snapToGrid) {
            const gridSize = 4 / dynamicGridDivision;
            newStart = Math.round(newStart / gridSize) * gridSize;
          }

          newStart = Math.max(0, newStart);
          let newLength = originalEnd - newStart;

          if (r.type === 'audio') {
            const originalLength = r.originalLength ?? initialLength;
            const maxLength = originalLength;
            const minLength = 0.25;
            newLength = Math.max(minLength, Math.min(newLength, maxLength));
            newStart = originalEnd - newLength;
          } else {
            newLength = Math.max(0.25, newLength);
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

        setHeadResizeState((prev) => prev ? {
          ...prev,
          delta: data.beat - headResizeState.originBeat,
          previewStarts,
          previewLengths,
        } : prev);

        if (onRegionRealtimeUpdates && realtimeUpdates.length > 0) {
          onRegionRealtimeUpdates(realtimeUpdates);
        }

      } else if (loopState) {
        const stage = event.target.getStage();
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const pointerX = pointer.x;
        const deltaPixels = pointerX - loopState.startX;
        const unitWidth = loopState.targetLength * beatWidth;
        
        if (unitWidth === 0) return;

        const deltaIterations = Math.round(deltaPixels / unitWidth);
        const newIterations = Math.max(1, loopState.baseIterations + deltaIterations);

        setLoopState((prev) => prev ? { ...prev, previewIterations: newIterations } : prev);

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
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        setMarqueeState((prev) => prev ? {
          ...prev,
          currentX: pointer.x + stageOffsetX,
          currentY: pointer.y,
        } : prev);

      } else if (panState && onPan) {
        const stage = event.target.getStage();
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

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
      beatWidth, dragState, dynamicGridDivision, getPointerData,
      headResizeState, holdState, loopState, marqueeState, onPan,
      panState, regions, resizeState, snapToGrid, stageOffsetX,
      onRegionDragRealtime, onRegionRealtimeUpdates, activePianoRegionId,
      setRegionPreviewStart
    ]
  );

  const handlePointerUp = useCallback(() => {
    if ((resizeState || headResizeState || loopState) && onRegionRealtimeFlush) {
      onRegionRealtimeFlush();
    }

    if (dragState) {
      if (onRegionDragEnd) onRegionDragEnd(dragState.regionIds);

      if (dragState.isDuplicate) {
        const { duplicateRegion } = useRegionStore.getState();
        dragState.regionIds.forEach((regionId) => {
          duplicateRegion(regionId, dragState.delta);
        });
      } else {
        const allSameTrack = dragState.regionIds.every(id =>
          dragState.initialTrackIds[id] === dragState.initialTrackIds[dragState.regionIds[0]]
        );

        const isTrackChange = allSameTrack &&
          dragState.targetTrackId &&
          dragState.regionIds.some(id => dragState.initialTrackIds[id] !== dragState.targetTrackId);

        if (isTrackChange && dragState.targetTrackId) {
          onMoveRegionsToTrack(dragState.regionIds, dragState.targetTrackId, dragState.delta);
        } else if (dragState.delta !== 0) {
          onMoveRegions(dragState.regionIds, dragState.delta);
        }
      }
      
      setDragState(null);
      if (activePianoRegionId && dragState.regionIds.includes(activePianoRegionId)) {
        clearRegionPreview(activePianoRegionId);
      }
    }

    if (panState) setPanState(null);

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
      const applyHeadResize = onHeadResizeRegion ?? ((regionId: RegionId, updates: Partial<Region>) => {
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
          if (r.type === 'audio') {
            const currentTrimStart = r.trimStart ?? 0;
            applyHeadResize(regionId, {
              start: newStart,
              length: newLength,
              trimStart: currentTrimStart + actualDelta,
            });
          } else if (r.type === 'midi') {
            const adjustedNotes = r.notes.map((note) => ({
              ...note,
              start: note.start - actualDelta,
            }));
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

      const selected = regions.filter((region) => {
        const track = tracks.find((t) => t.id === region.trackId);
        if (!track) return false;
        const pos = trackYPositions[track.id];
        if (!pos) return false;

        const regionX = region.start * beatWidth;
        const regionWidth = region.length * beatWidth * (region.loopEnabled ? region.loopIterations : 1);
        const regionY = pos.y;
        const regionBottom = regionY + pos.height;
        const regionRight = regionX + regionWidth;

        return regionX < x2 && regionRight > x1 && regionY < y2 && regionBottom > y1;
      }).map((region) => region.id);

      onMarqueeSelect(selected, marqueeState.additive);
      setMarqueeState(null);
    }

    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdState) setHoldState(null);

  }, [
    beatWidth, dragState, headResizeState, holdState, loopState, marqueeState,
    onHeadResizeRegion, onMarqueeSelect, onMoveRegions, onMoveRegionsToTrack,
    onResizeRegion, onSetLoopIterations, onRegionDragEnd, onRegionRealtimeFlush,
    panState, regions, resizeState, trackYPositions, tracks, activePianoRegionId,
    clearRegionPreview
  ]);

  return {
    dragState,
    resizeState,
    headResizeState,
    loopState,
    marqueeState,
    panState,
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
  };
};
