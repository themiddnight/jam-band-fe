import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Playhead } from './Playhead';
import { TimeRuler } from './TimeRuler';
import { TrackCanvas } from './TrackCanvas';
import { TrackHeader } from './TrackHeader';
import { AddTrackMenu } from './AddTrackMenu';
import { AddAudioClipButton } from './AddAudioClipButton';
import { MarkerEditToggle } from './MarkerEditToggle';
import { PIXELS_PER_BEAT, TRACK_HEADER_WIDTH, TRACK_HEIGHT } from './constants';
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM } from '../../constants/canvas';
import { usePianoRollStore } from '../../stores/pianoRollStore';
import { useProjectStore } from '../../stores/projectStore';
import { useRegionStore } from '../../stores/regionStore';
import { useTrackStore } from '../../stores/trackStore';
import { LoopToggle } from '../transport/LoopToggle';
import { useDAWCollaborationContext } from '../../contexts/useDAWCollaborationContext';
import { InfoTooltip } from '../common/InfoTooltip';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { AiGenerationPopup } from '../../../ai/components/AiGenerationPopup';
import type { AiNote } from '../../../../shared/api/aiGeneration';

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
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const scrollRafRef = useRef<number | null>(null);
  const zoomRafRef = useRef<number | null>(null);
  // Refs for stable wheel handler
  const zoomRef = useRef(zoom);
  const scrollLeftRef = useRef(scrollLeft);
  
  // Keep refs in sync with state
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  
  useEffect(() => {
    scrollLeftRef.current = scrollLeft;
  }, [scrollLeft]);

  const totalBeats = useMemo(() => {
    const furthestRegionBeat = regions.reduce((max, region) => {
      const loopLength = region.loopEnabled ? region.length * region.loopIterations : region.length;
      return Math.max(max, region.start + loopLength);
    }, 0);
    return Math.max(32, Math.ceil(furthestRegionBeat + 8));
  }, [regions]);

  // Dynamic zoom limits based on content length
  // Max zoom is fixed, min zoom allows fitting entire content in viewport
  const maxTimelineZoom = MAX_TIMELINE_ZOOM;
  const minTimelineZoom = useMemo(() => {
    if (viewportWidth <= 0 || totalBeats <= 0) return MIN_TIMELINE_ZOOM;
    // Calculate zoom level that would fit all content in viewport
    const fitZoom = viewportWidth / (totalBeats * PIXELS_PER_BEAT);
    // Use the smaller of fixed minimum or fit-to-content zoom
    return Math.min(MIN_TIMELINE_ZOOM, fitZoom);
  }, [viewportWidth, totalBeats]);

  const clampTimelineZoom = useCallback((value: number) => {
    return Math.max(minTimelineZoom, Math.min(maxTimelineZoom, value));
  }, [maxTimelineZoom, minTimelineZoom]);

  // Handle zoom changes centered on cursor or playhead
  // Uses refs to avoid recreating on every zoom/scroll change
  const handleZoomChange = useCallback((newZoom: number, cursorX?: number) => {
    const clampedZoom = clampTimelineZoom(newZoom);
    const currentZoom = zoomRef.current;
    const currentScrollLeft = scrollLeftRef.current;

    if (!canvasScrollRef.current) {
      setZoom(clampedZoom);
      return;
    }

    // Use cursor position if provided, otherwise use playhead
    const focusPoint = cursorX !== undefined 
      ? (currentScrollLeft + cursorX) / (PIXELS_PER_BEAT * currentZoom)
      : playhead;

    // Calculate focus point position in pixels before zoom change
    const oldFocusPixels = focusPoint * PIXELS_PER_BEAT * currentZoom;

    // Calculate how far focus point is from left edge of viewport
    const focusOffsetInViewport = cursorX !== undefined ? cursorX : oldFocusPixels - currentScrollLeft;

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
  }, [playhead, clampTimelineZoom]);

  useEffect(() => {
    setZoom((prev) => {
      const clamped = clampTimelineZoom(prev);
      return clamped === prev ? prev : clamped;
    });
  }, [clampTimelineZoom]);

  // Handle wheel zoom with Ctrl key - stable effect using refs
  useEffect(() => {
    const canvas = canvasScrollRef.current;
    if (!canvas) return;
    
    const handleWheel = (e: WheelEvent) => {
      // Only handle zoom when Ctrl/Meta is pressed
      if (!(e.ctrlKey || e.metaKey)) {
        return; // Let native scroll happen
      }
      
      e.preventDefault();
      
      // Cancel any pending zoom update
      if (zoomRafRef.current !== null) {
        cancelAnimationFrame(zoomRafRef.current);
      }
      
      // Batch zoom updates using requestAnimationFrame
      zoomRafRef.current = requestAnimationFrame(() => {
        const scrollContainer = canvasScrollRef.current;
        if (!scrollContainer) return;
        
        const delta = -e.deltaY;
        const zoomSpeed = 0.001;
        const currentZoom = zoomRef.current;
        const newZoom = currentZoom + delta * zoomSpeed;
        // Clamp directly here to avoid stale callback issues
        const clampedZoom = Math.max(minTimelineZoom, Math.min(maxTimelineZoom, newZoom));
        
        // Get current playhead position for centering
        const currentPlayhead = playhead;
        const viewportWidth = scrollContainer.clientWidth;
        
        // Calculate new scroll position to keep playhead centered in viewport
        const playheadPixels = currentPlayhead * PIXELS_PER_BEAT * clampedZoom;
        const newScrollLeft = playheadPixels - viewportWidth / 2;
        
        setZoom(clampedZoom);
        
        requestAnimationFrame(() => {
          if (canvasScrollRef.current) {
            canvasScrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
          }
        });
        zoomRafRef.current = null;
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      // Clean up any pending animation frames
      if (zoomRafRef.current !== null) {
        cancelAnimationFrame(zoomRafRef.current);
      }
    };
  }, [playhead, minTimelineZoom, maxTimelineZoom]);

  // Touch gesture handling for mobile (pinch-to-zoom and two-finger pan)
  const handleTouchZoomChange = useCallback((newZoom: number, centerX: number) => {
    const clampedZoom = clampTimelineZoom(newZoom);
    const currentScrollLeft = canvasScrollRef.current?.scrollLeft ?? 0;
    
    // Calculate focus point in beats
    const focusPoint = (currentScrollLeft + centerX) / (PIXELS_PER_BEAT * zoom);
    
    // Calculate new scroll position to keep focus point at same position
    const newFocusPixels = focusPoint * PIXELS_PER_BEAT * clampedZoom;
    const newScrollLeft = newFocusPixels - centerX;
    
    setZoom(clampedZoom);
    
    requestAnimationFrame(() => {
      if (canvasScrollRef.current) {
        canvasScrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
      }
    });
  }, [zoom, clampTimelineZoom]);

  const handleTouchPan = useCallback((deltaX: number, deltaY: number) => {
    if (canvasScrollRef.current) {
      canvasScrollRef.current.scrollLeft += deltaX;
      canvasScrollRef.current.scrollTop += deltaY;
    }
  }, []);

  const { containerRef: touchContainerRef } = useTouchGestures({
    zoom,
    onZoomChange: handleTouchZoomChange,
    onPan: handleTouchPan,
    minZoom: minTimelineZoom,
    maxZoom: maxTimelineZoom,
    enabled: true,
  });

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

  // Auto-fit when project is loaded
  const isLoadingProject = useProjectStore((state) => state.isLoadingProject);
  const prevRegionsLengthRef = useRef(regions.length);
  const prevIsLoadingProjectRef = useRef(isLoadingProject);
  
  useEffect(() => {
    // Only auto-fit if:
    // 1. A project is being loaded (isLoadingProject flag is true)
    // 2. Regions were added (went from 0 to more than 0)
    const hadNoRegions = prevRegionsLengthRef.current === 0;
    const hasRegionsNow = regions.length > 0;
    
    if (isLoadingProject && hadNoRegions && hasRegionsNow) {
      // Delay to ensure viewport is ready
      const timer = setTimeout(() => {
        handleFitToRegions();
      }, 100);
      return () => clearTimeout(timer);
    }
    
    prevRegionsLengthRef.current = regions.length;
    prevIsLoadingProjectRef.current = isLoadingProject;
  }, [regions.length, isLoadingProject, handleFitToRegions]);

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
    
    // Sync header scroll immediately for visual consistency
    const { scrollTop: currentScrollTop } = canvasScrollRef.current;
    if (headerRef.current && headerRef.current.scrollTop !== currentScrollTop) {
      headerRef.current.scrollTop = currentScrollTop;
    }
    
    // Throttle scrollLeft state updates using RAF
    if (scrollRafRef.current !== null) {
      return; // Already scheduled, skip
    }
    
    scrollRafRef.current = requestAnimationFrame(() => {
      if (!canvasScrollRef.current) {
        scrollRafRef.current = null;
        return;
      }
      const { scrollLeft: currentScrollLeft } = canvasScrollRef.current;
      setScrollLeft(currentScrollLeft);
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

  // AI Generation Context
  const projectScale = useProjectStore((state) => state.projectScale);
  const bpm = useProjectStore((state) => state.bpm);
  
  // Find the selected region (single)
  const selectedRegion = useMemo(() => {
    if (selectedRegionIds.length === 1) {
      return regions.find(r => r.id === selectedRegionIds[0]);
    }
    return null;
  }, [selectedRegionIds, regions]);

  const aiContext = useMemo(() => {
    const context: any = {
      bpm,
      scale: projectScale,
      loopLength: selectedRegion ? selectedRegion.length : 4,
    };

    if (selectedRegion && selectedRegion.type === 'midi' && selectedRegion.notes && selectedRegion.notes.length > 0) {
      context.existingNotes = selectedRegion.notes.map(n => ({
        pitch: n.pitch,
        start: n.start,
        duration: n.duration,
        velocity: n.velocity
      }));
    }

    return context;
  }, [bpm, projectScale, selectedRegion]);

  const extraContext = useMemo(() => ({
    tracks: tracks.map(t => ({ name: t.name, category: t.instrumentCategory }))
  }), [tracks]);

  const handleAiGenerate = useCallback((notes: AiNote[]) => {
    if (!selectedTrackId) return;
    const track = tracks.find(t => t.id === selectedTrackId);
    if (!track || track.type !== 'midi') return;

    let targetRegionId: string | null = null;
    
    // Case: Region Selected (single)
    // Check if the selected region belongs to the selected track to be safe
    if (selectedRegion && selectedRegion.trackId === track.id) {
        targetRegionId = selectedRegion.id;
    }

    const midiNotes = notes.map(n => ({
      id: crypto.randomUUID(),
      pitch: Math.round(n.pitch),
      start: n.start,
      duration: n.duration,
      velocity: Math.round(n.velocity)
    }));

    if (targetRegionId) {
      // Update existing region: Replace notes completely
      handleRegionUpdate(targetRegionId, { notes: midiNotes });
    } else {
      // Case: No Region Selected -> Create new region
      // Calculate required length from generated notes
      const maxEnd = notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
      const newLength = Math.max(4, Math.ceil(maxEnd));

      // Create region at playhead
      const region = handleRegionAdd(track.id, playhead);
      
      if (region) {
        handleRegionUpdate(region.id, { 
          length: newLength,
          notes: midiNotes 
        });
      }
    }
  }, [selectedTrackId, tracks, playhead, handleRegionAdd, handleRegionUpdate, selectedRegion]);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-base-300 px-2 sm:px-4 py-1.5 sm:py-2">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-base-content/70">
            Tracks
          </h2>
          <AiGenerationPopup
            onGenerate={handleAiGenerate}
            context={aiContext}
            extraContext={extraContext}
            showContextToggle={true}
            contextToggleLabel="Track Context"
            trigger={
              <button className="btn btn-xs btn-secondary btn-outline gap-1" disabled={!selectedTrackId}>
                <span>✨</span> AI
              </button>
            }
          />
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
            <AddAudioClipButton />
            <div className='divider divider-horizontal m-0!' />
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
      <div className="flex items-stretch border-b border-base-300">
        {/* Mobile spacer to align with collapse button below */}
        {!isHeaderCollapsed && (
          <div className="sm:hidden w-6 border-r border-base-300 bg-base-200" />
        )}
        {/* Mobile expand button when collapsed */}
        {isHeaderCollapsed && (
          <button
            type="button"
            className="sm:hidden flex items-center justify-center w-6 h-full border-r border-base-300 bg-base-100 hover:bg-base-200"
            onClick={() => setIsHeaderCollapsed(false)}
            title="Expand Track Headers"
          >
            ▶
          </button>
        )}
        <div
          className={`h-full border-r border-base-300 bg-base-100 p-2 flex justify-between items-center gap-2 transition-all duration-200 ${isHeaderCollapsed ? 'hidden sm:flex' : ''}`}
          style={{ width: `${TRACK_HEADER_WIDTH}px` }}
        >
          <AddTrackMenu />
          <MarkerEditToggle />
        </div>
        <div className="relative flex-1 h-9 overflow-hidden">
          <TimeRuler
            totalBeats={totalBeats}
            pixelsPerBeat={PIXELS_PER_BEAT}
            zoom={zoom}
            scrollLeft={scrollLeft}
            viewportWidth={viewportWidth}
            timeSignature={timeSignature}
            playheadBeats={playhead}
          />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile toggle button when expanded */}
        {!isHeaderCollapsed && (
          <button
            type="button"
            className="sm:hidden flex items-center justify-center w-6 bg-base-200 hover:bg-base-300 border-r border-base-300 transition-colors"
            onClick={() => setIsHeaderCollapsed(true)}
            title="Collapse Track Headers"
          >
            ◀
          </button>
        )}
        {/* Mobile collapse toggle when collapsed */}
        {isHeaderCollapsed && (
          <button
            type="button"
            className="sm:hidden flex items-center justify-center w-6 bg-base-100 hover:bg-base-200 border-r border-base-300"
            onClick={() => setIsHeaderCollapsed(false)}
            title="Expand Track Headers"
          >
            ▶
          </button>
        )}
        <div
          ref={headerRef}
          onScroll={handleHeaderScroll}
          className={`flex flex-col overflow-y-auto border-r border-base-300 bg-base-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-all duration-200 ${isHeaderCollapsed ? 'hidden sm:flex' : ''}`}
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
          ref={(node) => {
            canvasScrollRef.current = node;
            touchContainerRef(node);
          }}
          onScroll={handleCanvasScroll}
          className="relative flex-1 overflow-auto bg-base-200/40 touch-pan-y"
          style={{ 
            willChange: 'scroll-position',
            contain: 'strict',
            overscrollBehavior: 'contain',
          }}
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

