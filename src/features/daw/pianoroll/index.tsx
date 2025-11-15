import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePianoRollStore } from '../stores/pianoRollStore';
import { useProjectStore } from '../stores/projectStore';
import { useRegionStore } from '../stores/regionStore';
import { useTrackStore } from '../stores/trackStore';
import type { SustainEvent } from '../types/daw';
import { PianoKeys } from './PianoKeys';
import { NoteCanvas } from './NoteCanvas';
import { PianoRollRuler } from './PianoRollRuler';
import { SustainLane } from './SustainLane';
import { VelocityLane } from './VelocityLane';
import {
  KEYBOARD_WIDTH,
  NOTE_HEIGHT,
  RULER_HEIGHT,
  SUSTAIN_LANE_HEIGHT,
  TOTAL_KEYS,
} from './constants';

const TOTAL_HEIGHT = TOTAL_KEYS * NOTE_HEIGHT;

type LaneMode = 'velocity' | 'sustain';

export const PianoRoll = () => {
  const activeRegionId = usePianoRollStore((state) => state.activeRegionId);
  const selectedNoteIds = usePianoRollStore((state) => state.selectedNoteIds);
  const setSelectedNoteIds = usePianoRollStore((state) => state.setSelectedNoteIds);
  const toggleNoteSelection = usePianoRollStore((state) => state.toggleNoteSelection);
  const clearNoteSelection = usePianoRollStore((state) => state.clearSelection);
  const addNote = usePianoRollStore((state) => state.addNote);
  const moveNotes = usePianoRollStore((state) => state.moveNotes);
  const duplicateNotes = usePianoRollStore((state) => state.duplicateNotes);
  const resizeNotes = usePianoRollStore((state) => state.resizeNotes);
  const setNotesVelocity = usePianoRollStore((state) => state.setNotesVelocity);
  const quantizeNotes = usePianoRollStore((state) => state.quantizeNotes);
  const quantizeAllNotes = usePianoRollStore((state) => state.quantizeAllNotes);
  const deleteSelectedNotes = usePianoRollStore((state) => state.deleteSelectedNotes);
  const selectedSustainIds = usePianoRollStore((state) => state.selectedSustainIds);
  const setSelectedSustainIds = usePianoRollStore((state) => state.setSelectedSustainIds);
  const addSustainEvent = usePianoRollStore((state) => state.addSustainEvent);
  const updateSustainEvent = usePianoRollStore((state) => state.updateSustainEvent);
  const removeSustainEvent = usePianoRollStore((state) => state.removeSustainEvent);
  
  const regions = useRegionStore((state) => state.regions);
  const tracks = useTrackStore((state) => state.tracks);
  const timeSignature = useProjectStore((state) => state.timeSignature);
  const playhead = useProjectStore((state) => state.playhead);
  const snapToGridEnabled = useProjectStore((state) => state.snapToGrid);

  const region = regions.find((item) => item.id === activeRegionId);
  
  // Piano roll only works with MIDI regions
  const midiRegion = region?.type === 'midi' ? region : null;
  
  const track = useMemo(() => {
    if (!midiRegion) {
      return null;
    }
    return tracks.find((item) => item.id === midiRegion.trackId) ?? null;
  }, [midiRegion, tracks]);

  const totalBeats = useMemo(() => {
    // Calculate based on ALL regions to match multitrack view
    const furthestRegionBeat = regions.reduce((max, region) => {
      const loopLength = region.loopEnabled ? region.length * region.loopIterations : region.length;
      return Math.max(max, region.start + loopLength);
    }, 0);
    return Math.max(32, Math.ceil(furthestRegionBeat + 8));
  }, [regions]);

  const [velocityPreview, setVelocityPreview] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [laneMode, setLaneMode] = useState<LaneMode>('velocity');
  const [quantizeSize, setQuantizeSize] = useState(16); // Default to 16th notes
  const [viewportWidth, setViewportWidth] = useState(800);
  const noteScrollRef = useRef<HTMLDivElement | null>(null);
  const keyScrollRef = useRef<HTMLDivElement | null>(null);
  const laneScrollRef = useRef<HTMLDivElement | null>(null);
  
  // Track viewport width for performance culling (horizontal only)
  useEffect(() => {
    const updateViewportSize = () => {
      if (noteScrollRef.current) {
        setViewportWidth(noteScrollRef.current.clientWidth);
      }
    };
    
    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  const handleCreateNote = useCallback(
    (pitch: number, absoluteStart: number) => {
      if (!midiRegion) {
        return;
      }
      // Convert absolute position to region-relative position
      const relativeStart = absoluteStart - midiRegion.start;
      const clampedStart = Math.max(0, Math.min(relativeStart, midiRegion.length - 0.25));
      const newNote = addNote({
        pitch,
        start: clampedStart,
        duration: 1,
        velocity: velocityPreview,
      });
      if (newNote) {
        setSelectedNoteIds([newNote.id]);
      }
    },
    [addNote, midiRegion, setSelectedNoteIds, velocityPreview]
  );

  const handleVelocityChange = useCallback(
    (value: number) => {
      setVelocityPreview(value);
      if (selectedNoteIds.length) {
        setNotesVelocity(selectedNoteIds, value);
      }
    },
    [selectedNoteIds, setNotesVelocity]
  );

  const handleAddSustainEvent = useCallback(
    (absoluteStart: number) => {
      if (!midiRegion) {
        return;
      }
      // Convert absolute position to region-relative position
      const relativeStart = absoluteStart - midiRegion.start;
      const created = addSustainEvent({ start: relativeStart, end: relativeStart + 1 });
      if (created) {
        setSelectedSustainIds([created.id]);
      }
    },
    [addSustainEvent, midiRegion, setSelectedSustainIds]
  );
  const handleUpdateSustainEvent = useCallback(
    (eventId: string, updates: Partial<SustainEvent>) => {
      if (!midiRegion) {
        return;
      }
      // Convert absolute positions to region-relative
      const relativeUpdates: Partial<SustainEvent> = {};
      if (typeof updates.start === 'number') {
        relativeUpdates.start = updates.start - midiRegion.start;
      }
      if (typeof updates.end === 'number') {
        relativeUpdates.end = updates.end - midiRegion.start;
      }
      updateSustainEvent(eventId, relativeUpdates);
    },
    [midiRegion, updateSustainEvent]
  );
  const handleRemoveSustainEvent = useCallback(
    (eventId: string) => {
      removeSustainEvent(eventId);
    },
    [removeSustainEvent]
  );
  const handleDeleteSustainEvents = useCallback(() => {
    selectedSustainIds.forEach((id) => removeSustainEvent(id));
    setSelectedSustainIds([]);
  }, [removeSustainEvent, selectedSustainIds, setSelectedSustainIds]);

  useEffect(() => {
    if (!midiRegion || !selectedNoteIds.length) {
      setVelocityPreview(100);
      return;
    }
    const selectedNotes = midiRegion.notes.filter((note) => selectedNoteIds.includes(note.id));
    if (selectedNotes.length) {
      const average =
        selectedNotes.reduce((sum, note) => sum + note.velocity, 0) / selectedNotes.length;
      setVelocityPreview(Math.round(average));
    }
  }, [midiRegion, selectedNoteIds]);

  const pixelsPerBeat = 64;
  
  // Handle zoom changes centered on playhead
  const handleZoomChange = useCallback((newZoom: number) => {
    if (!noteScrollRef.current) {
      setZoom(newZoom);
      return;
    }
    
    // Calculate playhead position in pixels before zoom change
    const oldPlayheadPixels = playhead * pixelsPerBeat * zoom;
    
    // Calculate how far playhead is from left edge of viewport
    const playheadOffsetInViewport = oldPlayheadPixels - scrollLeft;
    
    // Calculate playhead position in pixels after zoom change
    const newPlayheadPixels = playhead * pixelsPerBeat * newZoom;
    
    // Adjust scroll to keep playhead at same position in viewport
    const newScrollLeft = newPlayheadPixels - playheadOffsetInViewport;
    
    setZoom(newZoom);
    
    // Apply new scroll position after zoom updates
    requestAnimationFrame(() => {
      if (noteScrollRef.current) {
        noteScrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
      }
      if (laneScrollRef.current) {
        laneScrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
      }
    });
  }, [playhead, zoom, scrollLeft, pixelsPerBeat]);
  
  // Convert notes to absolute positions for display
  const absoluteNotes = useMemo(() => {
    if (!midiRegion) {
      return [];
    }
    return midiRegion.notes.map((note) => ({
      ...note,
      start: midiRegion.start + note.start,
    }));
  }, [midiRegion]);
  
  // Convert sustain events to absolute positions for display
  const absoluteSustainEvents = useMemo(() => {
    if (!midiRegion) {
      return [];
    }
    return midiRegion.sustainEvents.map((event) => ({
      ...event,
      start: midiRegion.start + event.start,
      end: midiRegion.start + event.end,
    }));
  }, [midiRegion]);

  const scrollRafRef = useRef<number | null>(null);
  
  const handleNoteScroll = useCallback(() => {
    if (!noteScrollRef.current || !keyScrollRef.current || !laneScrollRef.current) {
      return;
    }
    
    // Throttle scroll updates using requestAnimationFrame
    if (scrollRafRef.current !== null) {
      return; // Already scheduled
    }
    
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      
      if (!noteScrollRef.current || !keyScrollRef.current || !laneScrollRef.current) {
        return;
      }
      
      const { scrollLeft: currentScrollLeft, scrollTop: currentScrollTop } = noteScrollRef.current;
      setScrollLeft(currentScrollLeft);
      if (keyScrollRef.current.scrollTop !== currentScrollTop) {
        keyScrollRef.current.scrollTop = currentScrollTop;
      }
      if (laneScrollRef.current.scrollLeft !== currentScrollLeft) {
        laneScrollRef.current.scrollLeft = currentScrollLeft;
      }
    });
  }, []);

  const handleKeyScroll = useCallback(() => {
    if (!noteScrollRef.current || !keyScrollRef.current) {
      return;
    }
    const { scrollTop: currentScrollTop } = keyScrollRef.current;
    if (noteScrollRef.current.scrollTop !== currentScrollTop) {
      noteScrollRef.current.scrollTop = currentScrollTop;
    }
  }, []);
  
  const handleLaneScroll = useCallback(() => {
    if (!noteScrollRef.current || !laneScrollRef.current) {
      return;
    }
    const { scrollLeft: currentScrollLeft } = laneScrollRef.current;
    if (noteScrollRef.current.scrollLeft !== currentScrollLeft) {
      noteScrollRef.current.scrollLeft = currentScrollLeft;
    }
  }, []);

  if (!midiRegion) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-base-300 bg-base-100 text-sm text-base-content/60">
        <p>Select a region to edit in the piano roll.</p>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-80 flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm touch-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-base-300 px-2 sm:px-4 py-1.5 sm:py-2 gap-2">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-base-content">{midiRegion.name}</h3>
            <p className="text-xs text-base-content/60 hidden sm:block">
              Track: {track?.name ?? 'Unknown'}
            </p>
          </div>
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70 w-full sm:w-auto">
          <label className="flex items-center gap-1 sm:gap-2">
            <span className="hidden sm:inline">Velocity</span>
            <span className="sm:hidden">Vel</span>
            <input
              type="range"
              min={0}
              max={127}
              value={velocityPreview}
              onChange={(event) => handleVelocityChange(Number(event.target.value))}
              className="range range-xs w-16 sm:w-24"
            />
          </label>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              className="btn btn-xs btn-outline"
              onClick={() => deleteSelectedNotes()}
              disabled={!selectedNoteIds.length}
            >
              <span className="hidden sm:inline">Delete Notes</span>
              <span className="sm:hidden">Del N</span>
            </button>
            <button
              type="button"
              className="btn btn-xs btn-outline"
              onClick={handleDeleteSustainEvents}
              disabled={!selectedSustainIds.length}
            >
              <span className="hidden sm:inline">Delete Sustain</span>
              <span className="sm:hidden">Del S</span>
            </button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 border-l border-base-300 pl-2">
            <label className="flex items-center gap-1">
              <span className="text-xs hidden sm:inline">Quantize:</span>
              <select
                value={quantizeSize}
                onChange={(e) => setQuantizeSize(Number(e.target.value))}
                className="select select-xs bg-base-200"
              >
                <option value={4}>1/4</option>
                <option value={8}>1/8</option>
                <option value={16}>1/16</option>
                <option value={32}>1/32</option>
                <option value={64}>1/64</option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => quantizeNotes(selectedNoteIds, quantizeSize)}
              disabled={!selectedNoteIds.length}
              title="Quantize selected notes"
            >
              <span className="hidden sm:inline">Q Selected</span>
              <span className="sm:hidden">Q Sel</span>
            </button>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => quantizeAllNotes(quantizeSize)}
              disabled={!midiRegion.notes.length}
              title="Quantize all notes in region"
            >
              <span className="hidden sm:inline">Q All</span>
              <span className="sm:hidden">Q All</span>
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] border-b border-base-300">
        <div className="h-full w-[80px] border-r border-base-300 bg-base-100">
          <div className="h-[32px] border-b border-base-300 bg-base-200/60" />
        </div>
        <div className="overflow-hidden" style={{ height: `${RULER_HEIGHT}px` }}>
          <PianoRollRuler
            totalBeats={totalBeats}
            pixelsPerBeat={pixelsPerBeat}
            zoom={zoom}
            scrollLeft={scrollLeft}
            highlightStart={midiRegion.start}
            highlightEnd={midiRegion.start + midiRegion.length}
            timeSignature={timeSignature}
            playheadBeats={playhead}
          />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden border-b border-base-300">
        <div
          ref={keyScrollRef}
          onScroll={handleKeyScroll}
          className="overflow-y-auto border-r border-base-300 bg-base-100"
          style={{ width: KEYBOARD_WIDTH, height: '100%' }}
        >
          <div style={{ height: TOTAL_HEIGHT }}>
            <PianoKeys />
          </div>
        </div>
        <div
          ref={noteScrollRef}
          onScroll={handleNoteScroll}
          className="relative flex-1 overflow-auto bg-base-200/40"
        >
          <div
            style={{
              width: totalBeats * pixelsPerBeat * zoom,
              height: TOTAL_HEIGHT,
            }}
          >
            <NoteCanvas
              notes={absoluteNotes}
              selectedNoteIds={selectedNoteIds}
              totalBeats={totalBeats}
              pixelsPerBeat={pixelsPerBeat}
              zoom={zoom}
              playheadBeats={playhead}
              scrollLeft={scrollLeft}
              viewportWidth={viewportWidth}
              regionHighlightStart={midiRegion.start}
              regionHighlightEnd={midiRegion.start + midiRegion.length}
              snapToGridEnabled={snapToGridEnabled}
              onSetSelectedNotes={setSelectedNoteIds}
              onToggleNoteSelection={toggleNoteSelection}
              onClearSelection={clearNoteSelection}
              onCreateNote={handleCreateNote}
              onMoveNotes={moveNotes}
              onDuplicateNotes={duplicateNotes}
              onResizeNotes={resizeNotes}
              onPan={(deltaX, deltaY) => {
                if (noteScrollRef.current) {
                  noteScrollRef.current.scrollLeft += deltaX;
                  noteScrollRef.current.scrollTop += deltaY;
                }
              }}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] border-t border-base-300">
        <div className="flex flex-col border-r border-base-300 bg-base-100" style={{ width: KEYBOARD_WIDTH }}>
          <button
            type="button"
            className={`flex-1 text-xs font-medium transition-colors ${
              laneMode === 'velocity' ? 'bg-primary text-white' : 'bg-base-200 hover:bg-base-300'
            }`}
            onClick={() => setLaneMode('velocity')}
          >
            Velocity
          </button>
          <button
            type="button"
            className={`flex-1 text-xs font-medium transition-colors ${
              laneMode === 'sustain' ? 'bg-primary text-white' : 'bg-base-200 hover:bg-base-300'
            }`}
            onClick={() => setLaneMode('sustain')}
          >
            Sustain
          </button>
        </div>
        <div
          ref={laneScrollRef}
          onScroll={handleLaneScroll}
          className="overflow-x-auto overflow-y-hidden"
          style={{ height: `${SUSTAIN_LANE_HEIGHT}px` }}
        >
          <div style={{ width: totalBeats * pixelsPerBeat * zoom }}>
            {laneMode === 'velocity' ? (
              <VelocityLane
                notes={absoluteNotes}
                selectedNoteIds={selectedNoteIds}
                totalBeats={totalBeats}
                pixelsPerBeat={pixelsPerBeat}
                zoom={zoom}
                scrollLeft={scrollLeft}
                viewportWidth={viewportWidth}
                playheadBeats={playhead}
                onSetNotesVelocity={setNotesVelocity}
              />
            ) : (
              <SustainLane
                events={absoluteSustainEvents}
                selectedEventIds={selectedSustainIds}
                totalBeats={totalBeats}
                pixelsPerBeat={pixelsPerBeat}
                zoom={zoom}
                scrollLeft={scrollLeft}
                viewportWidth={viewportWidth}
                playheadBeats={playhead}
                snapToGridEnabled={snapToGridEnabled}
                onAddEvent={handleAddSustainEvent}
                onUpdateEvent={handleUpdateSustainEvent}
                onRemoveEvent={handleRemoveSustainEvent}
                onSetSelectedEvents={setSelectedSustainIds}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PianoRoll;

