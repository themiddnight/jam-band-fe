import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Playhead } from './Playhead';
import { TimeRuler } from './TimeRuler';
import { TrackCanvas } from './TrackCanvas';
import { TrackHeader } from './TrackHeader';
import { AddTrackMenu } from './AddTrackMenu';
import { AddAudioClipButton } from './AddAudioClipButton';
import { MarkerEditToggle } from './MarkerEditToggle';
import { PIXELS_PER_BEAT, TRACK_HEADER_WIDTH, TRACK_HEIGHT } from './constants';
import { MAX_CANVAS_WIDTH, MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM } from '../../constants/canvas';
import { usePianoRollStore } from '../../stores/pianoRollStore';
import { useProjectStore } from '../../stores/projectStore';
import { useRegionStore } from '../../stores/regionStore';
import { useTrackStore } from '../../stores/trackStore';
import { LoopToggle } from '../transport/LoopToggle';
import { useDAWCollaborationContext } from '../../contexts/useDAWCollaborationContext';
import { InfoTooltip } from '../common/InfoTooltip';

export const MultitrackView = () => {
  const tracks = useTrackStore((state) => state.tracks);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const selectTrack = useTrackStore((state) => state.selectTrack);
  const regions = useRegionStore((state) => state.regions);
  const selectedRegionIds = useRegionStore((state) => state.selectedRegionIds);
  
  // Use collaboration handlers if available
  const {
    handleRegionAdd,
    handleRegionUpdate,
    handleRegionMoveToTrack,
    handleRegionMove,
    handleRegionDragStart,
    handleRegionDragRealtime,
    handleRegionDragEnd,
    handleRegionRealtimeUpdates,
    handleRegionRealtimeFlush,
    handleRegionDelete,
    handleRegionSplit,
    handleRegionSelect,
    handleRegionDeselect,
    handleRegionClearSelection,
  } = useDAWCollaborationContext();
  const playhead = useProjectStore((state) => state.playhead);
  const timeSignature = useProjectStore((state) => state.timeSignature);
  const setActiveRegion = usePianoRollStore((state) => state.setActiveRegion);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [trackHeights, setTrackHeights] = useState<Record<string, number>>({});
  const [isInitialZoomSet, setIsInitialZoomSet] = useState(false);
  const scrollRafRef = useRef<number | null>(null);
  const zoomRafRef = useRef<number | null>(null);

  const totalBeats = useMemo(() => {
    const furthestRegionBeat = regions.reduce((max, region) => {
      const loopLength = region.loopEnabled ? region.length * region.loopIterations : region.length;
      return Math.max(max, region.start + loopLength);
    }, 0);
    return Math.max(32, Math.ceil(furthestRegionBeat + 8));
  }, [regions]);

  const baseTimelineWidth = totalBeats * PIXELS_PER_BEAT;

  const maxTimelineZoom = useMemo(() => {
    if (baseTimelineWidth <= 0) {
      return MAX_TIMELINE_ZOOM;
    }
    const widthLimitedZoom = MAX_CANVAS_WIDTH / baseTimelineWidth;
    if (!Number.isFinite(widthLimitedZoom) || widthLimitedZoom <= 0) {
      return MAX_TIMELINE_ZOOM;
    }
    return Math.min(MAX_TIMELINE_ZOOM, widthLimitedZoom);
  }, [baseTimelineWidth]);

  const minTimelineZoom = useMemo(() => {
    return Math.min(MIN_TIMELINE_ZOOM, maxTimelineZoom);
  }, [maxTimelineZoom]);

  const clampTimelineZoom = useCallback((value: number) => {
    const upperBound = maxTimelineZoom > 0 ? maxTimelineZoom : MIN_TIMELINE_ZOOM;
    const lowerBound = Math.min(minTimelineZoom, upperBound);
    const withinUpper = Math.min(upperBound, value);
    return Math.max(lowerBound, withinUpper);
  }, [maxTimelineZoom, minTimelineZoom]);

  // Handle zoom changes centered on cursor or playhead
  const handleZoomChange = useCallback((newZoom: number, cursorX?: number) => {
    const clampedZoom = clampTimelineZoom(newZoom);

    if (!canvasScrollRef.current) {
      setZoom(clampedZoom);
      return;
    }

    // Use cursor position if provided, otherwise use playhead
    const focusPoint = cursorX !== undefined 
      ? (scrollLeft + cursorX) / (PIXELS_PER_BEAT * zoom)
      : playhead;

    // Calculate focus point position in pixels before zoom change
    const oldFocusPixels = focusPoint * PIXELS_PER_BEAT * zoom;

    // Calculate how far focus point is from left edge of viewport
    const focusOffsetInViewport = cursorX !== undefined ? cursorX : oldFocusPixels - scrollLeft;

    // Calculate focus point position in pixels after zoom change
    const newFocusPixels = focusPoint * PIXELS_PER_BEAT * clampedZoom;

    // Adjust scroll to keep focus point at same position in viewport
    const newScrollLeft = newFocusPixels - focusOffsetInViewport;

    setZoom(clampedZoom);

    // Apply new scroll position after zoom updates
    requestAnimationFrame(() => {
      if (canvasScrollRef.current) {
        canvasScrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
      }
    });
  }, [playhead, zoom, scrollLeft, clampTimelineZoom]);

  useEffect(() => {
    setZoom((prev) => {
      const clamped = clampTimelineZoom(prev);
      return clamped === prev ? prev : clamped;
    });
  }, [clampTimelineZoom]);

  // Handle wheel zoom with Ctrl key
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // Cancel any pending zoom update
        if (zoomRafRef.current !== null) {
          cancelAnimationFrame(zoomRafRef.current);
        }
        
        // Batch zoom updates using requestAnimationFrame
        zoomRafRef.current = requestAnimationFrame(() => {
          const delta = -e.deltaY;
          const zoomSpeed = 0.001;
          const newZoom = zoom + delta * zoomSpeed;

          // Get cursor position relative to canvas
          const rect = canvasScrollRef.current?.getBoundingClientRect();
          const cursorX = rect ? e.clientX - rect.left : undefined;

          handleZoomChange(newZoom, cursorX);
          zoomRafRef.current = null;
        });
      }
    };

    const canvas = canvasScrollRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
        // Clean up any pending animation frames
        if (zoomRafRef.current !== null) {
          cancelAnimationFrame(zoomRafRef.current);
        }
      };
    }
  }, [zoom, handleZoomChange]);

  // Track viewport width for performance culling
  useEffect(() => {
    const updateViewportSize = () => {
      if (canvasScrollRef.current) {
        setViewportWidth(canvasScrollRef.current.clientWidth);
      }
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  // Set initial zoom to show 8 bars
  useEffect(() => {
    if (!isInitialZoomSet && viewportWidth > 0 && canvasScrollRef.current) {
      const barsToShow = 8;
      const beatsToShow = barsToShow * timeSignature.numerator;
      const requiredWidth = beatsToShow * PIXELS_PER_BEAT;
      const initialZoom = clampTimelineZoom(viewportWidth / requiredWidth);
      setZoom(initialZoom);
      setIsInitialZoomSet(true);
    }
  }, [isInitialZoomSet, viewportWidth, timeSignature.numerator, clampTimelineZoom]);

  // Fit to all regions function
  const handleFitToRegions = useCallback(() => {
    if (!canvasScrollRef.current || regions.length === 0) {
      return;
    }

    // Find the extent of all regions
    let minBeat = Infinity;
    let maxBeat = -Infinity;

    regions.forEach((region) => {
      const loopLength = region.loopEnabled ? region.length * region.loopIterations : region.length;
      const regionEnd = region.start + loopLength;
      minBeat = Math.min(minBeat, region.start);
      maxBeat = Math.max(maxBeat, regionEnd);
    });

    // Add some padding (1 bar on each side)
    const padding = timeSignature.numerator;
    minBeat = Math.max(0, minBeat - padding);
    maxBeat = maxBeat + padding;

    const totalBeatsToShow = maxBeat - minBeat;
    const requiredWidth = totalBeatsToShow * PIXELS_PER_BEAT;
    const fitZoom = clampTimelineZoom(viewportWidth / requiredWidth);

    setZoom(fitZoom);

    // Scroll to show the start of the content
    requestAnimationFrame(() => {
      if (canvasScrollRef.current) {
        canvasScrollRef.current.scrollLeft = minBeat * PIXELS_PER_BEAT * fitZoom;
      }
    });
  }, [regions, viewportWidth, timeSignature.numerator, clampTimelineZoom]);

  // Auto-fit when regions change (e.g., after project load)
  const prevRegionsLengthRef = useRef(regions.length);
  useEffect(() => {
    // Only auto-fit if regions were added (e.g., project loaded)
    if (regions.length > 0 && prevRegionsLengthRef.current === 0) {
      // Delay to ensure viewport is ready
      const timer = setTimeout(() => {
        handleFitToRegions();
      }, 100);
      return () => clearTimeout(timer);
    }
    prevRegionsLengthRef.current = regions.length;
  }, [regions.length, handleFitToRegions]);

  const handleTrackHeightChange = useCallback((trackId: string, height: number) => {
    setTrackHeights((prev) => ({
      ...prev,
      [trackId]: height,
    }));

    if (!canvasScrollRef.current) {
      return;
    }

    const { scrollLeft: currentScrollLeft, scrollTop: currentScrollTop } = canvasScrollRef.current;
    setScrollLeft(currentScrollLeft);
    if (headerRef.current && headerRef.current.scrollTop !== currentScrollTop) {
      headerRef.current.scrollTop = currentScrollTop;
    }
  }, []);

  const handleCanvasScroll = useCallback(() => {
    if (!canvasScrollRef.current) {
      return;
    }
    
    // Cancel any pending scroll update
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    
    // Batch scroll updates using requestAnimationFrame
    scrollRafRef.current = requestAnimationFrame(() => {
      if (!canvasScrollRef.current) {
        return;
      }
      const { scrollLeft: currentScrollLeft, scrollTop: currentScrollTop } = canvasScrollRef.current;
      setScrollLeft(currentScrollLeft);
      if (headerRef.current && headerRef.current.scrollTop !== currentScrollTop) {
        headerRef.current.scrollTop = currentScrollTop;
      }
      scrollRafRef.current = null;
    });
  }, []);

  const handleHeaderScroll = useCallback(() => {
    if (!headerRef.current || !canvasScrollRef.current) {
      return;
    }
    const { scrollTop: currentScrollTop } = headerRef.current;
    if (canvasScrollRef.current.scrollTop !== currentScrollTop) {
      canvasScrollRef.current.scrollTop = currentScrollTop;
    }
  }, []);

  const contentWidth = totalBeats * PIXELS_PER_BEAT * zoom;
  const contentHeight = useMemo(() => {
    return tracks.reduce((total, track) => {
      return total + (trackHeights[track.id] ?? TRACK_HEIGHT);
    }, 0) || TRACK_HEIGHT;
  }, [tracks, trackHeights]);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-base-300 px-2 sm:px-4 py-1.5 sm:py-2">
        <div className="flex items-center gap-4">
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-base-content/70">
            Tracks
          </h2>
          <LoopToggle />
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={handleFitToRegions}
            disabled={regions.length === 0}
            title="Fit to All Regions"
          >
            📐 Fit
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => {
                const centerX = viewportWidth / 2;
                handleZoomChange(zoom * 0.8, centerX);
              }}
              title="Zoom Out"
            >
              −
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => {
                const centerX = viewportWidth / 2;
                handleZoomChange(zoom * 1.25, centerX);
              }}
              title="Zoom In"
            >
              +
            </button>
          </div>
          <InfoTooltip>Ctrl+Scroll to zoom</InfoTooltip>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => {
                handleRegionSplit(selectedRegionIds, playhead);
              }}
              disabled={selectedRegionIds.length === 0}
              title="Split Selected Regions at Playhead"
            >
              ✂️
            </button>
            <AddAudioClipButton />
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => {
                // Use selected track or fallback to first track
                const targetTrack = selectedTrackId
                  ? tracks.find(t => t.id === selectedTrackId)
                  : tracks[0];

                if (targetTrack && targetTrack.type === 'midi') {
                  // Create region at current playhead position
                  handleRegionAdd(targetTrack.id, playhead);
                }
              }}
              disabled={
                tracks.length === 0 ||
                (selectedTrackId ? tracks.find(t => t.id === selectedTrackId)?.type === 'audio' : false)
              }
              title={
                selectedTrackId && tracks.find(t => t.id === selectedTrackId)?.type === 'audio'
                  ? "Audio regions are created by recording"
                  : "Add MIDI Region at Playhead"
              }
            >
              +
            </button>
            <button
              type="button"
              className="btn btn-xs btn-error"
              onClick={() => {
                selectedRegionIds.forEach((id) => {
                  handleRegionDelete(id);
                });
              }}
              disabled={selectedRegionIds.length === 0}
              title="Delete Selected Regions"
            >
              ×
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-stretch border-b border-base-300">
        <div
          className="h-full border-r border-base-300 bg-base-100 p-2 flex justify-between items-center gap-2"
          style={{ width: `${TRACK_HEADER_WIDTH}px` }}
        >
          <AddTrackMenu />
          <MarkerEditToggle />
        </div>
        <div className="relative h-[36px] overflow-hidden">
          <TimeRuler
            totalBeats={totalBeats}
            pixelsPerBeat={PIXELS_PER_BEAT}
            zoom={zoom}
            scrollLeft={scrollLeft}
            timeSignature={timeSignature}
            playheadBeats={playhead}
          />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={headerRef}
          onScroll={handleHeaderScroll}
          className="flex flex-col overflow-y-auto border-r border-base-300 bg-base-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{ width: `${TRACK_HEADER_WIDTH}px` }}
        >
          {tracks.map((track, index) => (
            <TrackHeader
              key={track.id}
              track={track}
              isSelected={track.id === selectedTrackId}
              onSelect={selectTrack}
              onHeightChange={handleTrackHeightChange}
              canMoveUp={index > 0}
              canMoveDown={index < tracks.length - 1}
            />
          ))}
        </div>
        <div
          ref={canvasScrollRef}
          onScroll={handleCanvasScroll}
          className="relative flex-1 overflow-auto bg-base-200/40"
          style={{ willChange: 'scroll-position' }}
        >
          {tracks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-base-content/40">
                <p className="text-sm sm:text-base">No tracks yet</p>
                <p className="text-xs sm:text-sm mt-1">Click "+ Add Track" to get started</p>
              </div>
            </div>
          ) : (
            <div
              className="relative"
              style={{
                width: contentWidth,
                height: contentHeight,
              }}
            >
              <TrackCanvas
                tracks={tracks}
                regions={regions}
                selectedRegionIds={selectedRegionIds}
                totalBeats={totalBeats}
                pixelsPerBeat={PIXELS_PER_BEAT}
                zoom={zoom}
                scrollLeft={scrollLeft}
                viewportWidth={viewportWidth}
                selectedTrackId={selectedTrackId}
                onSelectTrack={selectTrack}
                timeSignature={timeSignature}
                trackHeights={trackHeights}
                onPan={(deltaX, deltaY) => {
                  if (canvasScrollRef.current) {
                    canvasScrollRef.current.scrollLeft += deltaX;
                    canvasScrollRef.current.scrollTop += deltaY;
                  }
                }}
                onSelectRegion={(regionId, additive) => {
                  const didSelect = handleRegionSelect(regionId, additive ?? false);
                  if (!didSelect) {
                    return;
                  }
                  setActiveRegion(regionId);

                  // Automatically select the track that the region belongs to
                  const region = regions.find((r) => r.id === regionId);
                  if (region) {
                    selectTrack(region.trackId);
                  }
                }}
                onToggleRegionSelection={(regionId) => {
                  if (selectedRegionIds.includes(regionId)) {
                    handleRegionDeselect(regionId);
                  } else {
                    const didSelect = handleRegionSelect(regionId, true);
                    if (didSelect) {
                      setActiveRegion(regionId);
                    }
                  }
                }}
                onClearRegionSelection={() => {
                  handleRegionClearSelection();
                  setActiveRegion(null);
                }}
                onCreateRegion={(trackId, startBeat) => {
                  const region = handleRegionAdd(trackId, startBeat);
                  if (region) {
                    setActiveRegion(region.id);
                    // Automatically select the track
                    selectTrack(trackId);
                  }
                }}
                onMoveRegions={(regionIds, deltaBeats) => {
                  regionIds.forEach((regionId) => {
                    handleRegionMove(regionId, deltaBeats);
                  });
                }}
                onMoveRegionsToTrack={(regionIds, targetTrackId, deltaBeats) =>
                  handleRegionMoveToTrack(regionIds, targetTrackId, deltaBeats)
                }
                onRegionDragStart={handleRegionDragStart}
                onRegionDragRealtime={handleRegionDragRealtime}
                onRegionDragEnd={handleRegionDragEnd}
                onRegionRealtimeUpdates={handleRegionRealtimeUpdates}
                onRegionRealtimeFlush={handleRegionRealtimeFlush}
                onResizeRegion={(regionId, length) => handleRegionUpdate(regionId, { length })}
                onHeadResizeRegion={(regionId, updates) => handleRegionUpdate(regionId, updates)}
                onSetLoopIterations={(regionId, iterations) =>
                  handleRegionUpdate(regionId, {
                    loopEnabled: iterations > 1,
                    loopIterations: Math.max(1, iterations),
                  })
                }
                onMarqueeSelect={(regionIds, additive) => {
                  if (!regionIds.length) {
                    return;
                  }

                  if (!additive) {
                    handleRegionClearSelection();
                  }

                  regionIds.forEach((regionId) => {
                    handleRegionSelect(regionId, true);
                  });

                  const lastRegionId = regionIds.at(-1) ?? null;
                  setActiveRegion(lastRegionId);

                  // Automatically select the track of the last selected region
                  if (lastRegionId) {
                    const region = regions.find((r) => r.id === lastRegionId);
                    if (region) {
                      selectTrack(region.trackId);
                    }
                  }
                }}
              />
              <Playhead
                playheadBeats={playhead}
                pixelsPerBeat={PIXELS_PER_BEAT}
                zoom={zoom}
                height={contentHeight}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default MultitrackView;

