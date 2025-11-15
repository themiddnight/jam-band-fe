import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Playhead } from './Playhead';
import { TimeRuler } from './TimeRuler';
import { TrackCanvas } from './TrackCanvas';
import { TrackHeader } from './TrackHeader';
import { AddTrackMenu } from './AddTrackMenu';
import { PIXELS_PER_BEAT, TRACK_HEADER_WIDTH, TRACK_HEIGHT } from './constants';
import { usePianoRollStore } from '../../stores/pianoRollStore';
import { useProjectStore } from '../../stores/projectStore';
import { useRegionStore } from '../../stores/regionStore';
import { useTrackStore } from '../../stores/trackStore';
import { LoopToggle } from '../transport/LoopToggle';

export const MultitrackView = () => {
  const tracks = useTrackStore((state) => state.tracks);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const selectTrack = useTrackStore((state) => state.selectTrack);
  const regions = useRegionStore((state) => state.regions);
  const selectedRegionIds = useRegionStore((state) => state.selectedRegionIds);
  const selectRegion = useRegionStore((state) => state.selectRegion);
  const toggleRegionSelection = useRegionStore((state) => state.toggleRegionSelection);
  const clearRegionSelection = useRegionStore((state) => state.clearSelection);
  const addRegion = useRegionStore((state) => state.addRegion);
  const removeRegion = useRegionStore((state) => state.removeRegion);
  const moveRegions = useRegionStore((state) => state.moveRegions);
  const resizeRegion = useRegionStore((state) => state.resizeRegion);
  const setRegionLoop = useRegionStore((state) => state.setRegionLoop);
  const selectRegions = useRegionStore((state) => state.selectRegions);
  const splitRegions = useRegionStore((state) => state.splitRegions);
  const playhead = useProjectStore((state) => state.playhead);
  const timeSignature = useProjectStore((state) => state.timeSignature);
  const setActiveRegion = usePianoRollStore((state) => state.setActiveRegion);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [trackHeights, setTrackHeights] = useState<Record<string, number>>({});

  // Handle zoom changes centered on playhead
  const handleZoomChange = useCallback((newZoom: number) => {
    if (!canvasScrollRef.current) {
      setZoom(newZoom);
      return;
    }

    // Calculate playhead position in pixels before zoom change
    const oldPlayheadPixels = playhead * PIXELS_PER_BEAT * zoom;

    // Calculate how far playhead is from left edge of viewport
    const playheadOffsetInViewport = oldPlayheadPixels - scrollLeft;

    // Calculate playhead position in pixels after zoom change
    const newPlayheadPixels = playhead * PIXELS_PER_BEAT * newZoom;

    // Adjust scroll to keep playhead at same position in viewport
    const newScrollLeft = newPlayheadPixels - playheadOffsetInViewport;

    setZoom(newZoom);

    // Apply new scroll position after zoom updates
    requestAnimationFrame(() => {
      if (canvasScrollRef.current) {
        canvasScrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
      }
    });
  }, [playhead, zoom, scrollLeft]);

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

  const handleTrackHeightChange = useCallback((trackId: string, height: number) => {
    setTrackHeights((prev) => ({
      ...prev,
      [trackId]: height,
    }));
  }, []);

  const totalBeats = useMemo(() => {
    const furthestRegionBeat = regions.reduce((max, region) => {
      const loopLength = region.loopEnabled ? region.length * region.loopIterations : region.length;
      return Math.max(max, region.start + loopLength);
    }, 0);
    return Math.max(32, Math.ceil(furthestRegionBeat + 8));
  }, [regions]);

  const handleCanvasScroll = useCallback(() => {
    if (!canvasScrollRef.current) {
      return;
    }
    const { scrollLeft: currentScrollLeft, scrollTop: currentScrollTop } = canvasScrollRef.current;
    setScrollLeft(currentScrollLeft);
    if (headerRef.current && headerRef.current.scrollTop !== currentScrollTop) {
      headerRef.current.scrollTop = currentScrollTop;
    }
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
    <section className="flex h-full min-h-80 flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm touch-none">
      <div className="flex items-center justify-between border-b border-base-300 px-2 sm:px-4 py-1.5 sm:py-2">
        <div className="flex items-center gap-4">
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-base-content/70">
            Tracks
          </h2>
          <label className="flex items-center gap-1 sm:gap-2 text-xs text-base-content/70">
            <span className="hidden sm:inline">Zoom</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={zoom}
              onChange={(event) => handleZoomChange(Number(event.target.value))}
              className="range range-xs w-20 sm:w-32"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => {
                splitRegions(selectedRegionIds, playhead);
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
                  addRegion(targetTrack.id, playhead);
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
                  removeRegion(id);
                });
              }}
              disabled={selectedRegionIds.length === 0}
              title="Delete Selected Regions"
            >
              ×
            </button>
          </div>
          <LoopToggle />
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-stretch border-b border-base-300">
        <div
          className="h-full border-r border-base-300 bg-base-100 p-2"
          style={{ width: `${TRACK_HEADER_WIDTH}px` }}
        >
          <AddTrackMenu />
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
          className="flex flex-col overflow-y-auto border-r border-base-300 bg-base-100"
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
                  selectRegion(regionId, additive ?? false);
                  setActiveRegion(regionId);

                  // Automatically select the track that the region belongs to
                  const region = regions.find(r => r.id === regionId);
                  if (region) {
                    selectTrack(region.trackId);
                  }
                }}
                onToggleRegionSelection={toggleRegionSelection}
                onClearRegionSelection={() => {
                  clearRegionSelection();
                  setActiveRegion(null);
                }}
                onCreateRegion={(trackId, startBeat) => {
                  const region = addRegion(trackId, startBeat);
                  setActiveRegion(region.id);

                  // Automatically select the track
                  selectTrack(trackId);
                }}
                onMoveRegions={moveRegions}
                onResizeRegion={resizeRegion}
                onSetLoopIterations={(regionId, iterations) =>
                  setRegionLoop(regionId, iterations > 1, iterations)
                }
                onMarqueeSelect={(regionIds, additive) => {
                  if (additive) {
                    const combined = Array.from(new Set([...selectedRegionIds, ...regionIds]));
                    selectRegions(combined);
                  } else {
                    selectRegions(regionIds);
                  }
                  const lastRegionId = regionIds.at(-1) ?? null;
                  setActiveRegion(lastRegionId);

                  // Automatically select the track of the last selected region
                  if (lastRegionId) {
                    const region = regions.find(r => r.id === lastRegionId);
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

