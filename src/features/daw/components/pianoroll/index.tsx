import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { usePianoRollStore } from '../../stores/pianoRollStore';
import { useRegionStore } from '../../stores/regionStore';
import { useTrackStore } from '../../stores/trackStore';
import type { MidiNote, SustainEvent } from '../../types/daw';
import { useProjectStore } from '../../stores/projectStore';
import { useDAWCollaborationContext } from '../../contexts/useDAWCollaborationContext';
import { MAX_CANVAS_WIDTH, MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM } from '../../constants/canvas';

const TOTAL_HEIGHT = TOTAL_KEYS * NOTE_HEIGHT;

type LaneMode = 'velocity' | 'sustain';

const PianoRollComponent = () => {
  const activeRegionId = usePianoRollStore((state) => state.activeRegionId);
  const selectedNoteIds = usePianoRollStore((state) => state.selectedNoteIds);
  const setSelectedNoteIds = usePianoRollStore((state) => state.setSelectedNoteIds);
  const toggleNoteSelection = usePianoRollStore((state) => state.toggleNoteSelection);
  const clearNoteSelection = usePianoRollStore((state) => state.clearSelection);
  const moveNotes = usePianoRollStore((state) => state.moveNotes);
  const duplicateNotes = usePianoRollStore((state) => state.duplicateNotes);
  const resizeNotes = usePianoRollStore((state) => state.resizeNotes);
  const setNotesVelocity = usePianoRollStore((state) => state.setNotesVelocity);
  const quantizeNotes = usePianoRollStore((state) => state.quantizeNotes);
  const quantizeAllNotes = usePianoRollStore((state) => state.quantizeAllNotes);
  const deleteSelectedNotes = usePianoRollStore((state) => state.deleteSelectedNotes);
  const viewMode = usePianoRollStore((state) => state.viewMode);
  const setViewMode = usePianoRollStore((state) => state.setViewMode);
  
  // Use collaboration handlers if available
  const {
    handleNoteAdd,
    handleNoteUpdate,
    handleNoteDelete,
    handleRegionUpdate,
    handleRegionRealtimeUpdates,
    handleRegionRealtimeFlush,
    handleNoteRealtimeUpdates,
    handleNoteRealtimeFlush,
  } = useDAWCollaborationContext();
  const syncRegionNotes = useCallback(() => {
    if (!activeRegionId) {
      return;
    }
    const region = useRegionStore.getState().regions.find((r) => r.id === activeRegionId);
    if (!region || region.type !== 'midi') {
      return;
    }
    handleRegionUpdate(activeRegionId, { notes: region.notes });
  }, [activeRegionId, handleRegionUpdate]);

  const syncSustainEvents = useCallback(() => {
    if (!activeRegionId) {
      return;
    }
    const region = useRegionStore.getState().regions.find((r) => r.id === activeRegionId);
    if (!region || region.type !== 'midi') {
      return;
    }
    handleRegionUpdate(activeRegionId, { sustainEvents: region.sustainEvents });
  }, [activeRegionId, handleRegionUpdate]);
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

  const handleRealtimeNoteUpdates = useCallback(
    (updates: Array<{ noteId: string; updates: Partial<MidiNote> }>) => {
      if (!midiRegion || !updates.length) {
        return;
      }

      const regionStart = midiRegion.start;
      handleNoteRealtimeUpdates(
        updates.map(({ noteId, updates: noteUpdates }) => {
          const adjustedUpdates: Partial<MidiNote> = { ...noteUpdates };
          if (typeof adjustedUpdates.start === 'number') {
            adjustedUpdates.start = adjustedUpdates.start - regionStart;
          }
          return {
            regionId: midiRegion.id,
            noteId,
            updates: adjustedUpdates,
          };
        })
      );
    },
    [handleNoteRealtimeUpdates, midiRegion]
  );

  const flushRealtimeNotes = useCallback(() => {
    handleNoteRealtimeFlush();
  }, [handleNoteRealtimeFlush]);

  const handleRealtimeSustainEvent = useCallback(
    (eventId: string, updates: Partial<SustainEvent>) => {
      if (!midiRegion) {
        return;
      }

      const relativeUpdates: Partial<SustainEvent> = {};
      if (typeof updates.start === 'number') {
        relativeUpdates.start = updates.start - midiRegion.start;
      }
      if (typeof updates.end === 'number') {
        relativeUpdates.end = updates.end - midiRegion.start;
      }

      const nextEvents = midiRegion.sustainEvents.map((event) =>
        event.id === eventId ? { ...event, ...relativeUpdates } : event
      );

      handleRegionRealtimeUpdates([
        {
          regionId: midiRegion.id,
          updates: { sustainEvents: nextEvents },
        },
      ]);
    },
    [handleRegionRealtimeUpdates, midiRegion]
  );

  const flushRealtimeSustainEvents = useCallback(() => {
    handleRegionRealtimeFlush();
  }, [handleRegionRealtimeFlush]);

  const handleSetNotesVelocity = useCallback(
    (noteIds: string[], velocity: number, options?: { commit?: boolean }) => {
      if (!midiRegion || !noteIds.length) {
        return;
      }

      const clampedVelocity = Math.min(127, Math.max(0, Math.round(velocity)));
      setNotesVelocity(noteIds, clampedVelocity);

      if (options?.commit) {
        flushRealtimeNotes();
        noteIds.forEach((noteId) => {
          handleNoteUpdate(noteId, { velocity: clampedVelocity });
        });
        return;
      }

      handleRealtimeNoteUpdates(
        noteIds.map((noteId) => ({
          noteId,
          updates: { velocity: clampedVelocity },
        }))
      );
    },
    [flushRealtimeNotes, handleNoteUpdate, handleRealtimeNoteUpdates, midiRegion, setNotesVelocity]
  );

  const handleCreateNote = useCallback(
    (pitch: number, absoluteStart: number) => {
      if (!midiRegion) {
        return;
      }
      // Convert absolute position to region-relative position
      const relativeStart = absoluteStart - midiRegion.start;
      const clampedStart = Math.max(0, Math.min(relativeStart, midiRegion.length - 0.25));
      const newNote = handleNoteAdd({
        pitch,
        start: clampedStart,
        duration: 1,
        velocity: velocityPreview,
      });
      if (newNote) {
        setSelectedNoteIds([newNote.id]);
      }
    },
    [handleNoteAdd, midiRegion, setSelectedNoteIds, velocityPreview]
  );

  const handleVelocityChange = useCallback(
    (value: number) => {
      setVelocityPreview(value);
      if (!selectedNoteIds.length) {
        return;
      }
      handleSetNotesVelocity(selectedNoteIds, value, { commit: true });
    },
    [handleSetNotesVelocity, selectedNoteIds]
  );

  // Wrapper for moveNotes that syncs each note individually
  const handleMoveNotes = useCallback(
    (noteIds: string[], deltaBeats: number, deltaPitch: number) => {
      if (!midiRegion) return;
      // Get current note values before update
      const region = useRegionStore.getState().regions.find((r) => r.id === midiRegion.id);
      if (!region || region.type !== 'midi') return;
      
      const notesToUpdate = region.notes.filter((note) => noteIds.includes(note.id));
      // Update locally first
      moveNotes(noteIds, deltaBeats, deltaPitch);
      // Then sync each note individually with calculated new values
      notesToUpdate.forEach((note) => {
        handleNoteUpdate(note.id, {
          start: Math.max(0, note.start + deltaBeats),
          pitch: Math.min(127, Math.max(0, note.pitch + deltaPitch)),
        });
      });
    },
    [moveNotes, handleNoteUpdate, midiRegion]
  );

  // Wrapper for resizeNotes that syncs each note individually
  const handleResizeNotes = useCallback(
    (noteIds: string[], deltaBeats: number) => {
      if (!midiRegion) return;
      // Get current note values before update
      const region = useRegionStore.getState().regions.find((r) => r.id === midiRegion.id);
      if (!region || region.type !== 'midi') return;
      
      const notesToUpdate = region.notes.filter((note) => noteIds.includes(note.id));
      // Update locally first
      resizeNotes(noteIds, deltaBeats);
      // Then sync each note individually with calculated new values
      notesToUpdate.forEach((note) => {
        handleNoteUpdate(note.id, {
          duration: Math.max(0.25, note.duration + deltaBeats),
        });
      });
    },
    [resizeNotes, handleNoteUpdate, midiRegion]
  );

  // Wrapper for deleteSelectedNotes that syncs each note individually
  const handleDeleteSelectedNotes = useCallback(() => {
    if (!selectedNoteIds.length) return;
    // Delete locally first
    deleteSelectedNotes();
    // Then sync each note deletion
    selectedNoteIds.forEach((noteId) => {
      handleNoteDelete(noteId);
    });
  }, [deleteSelectedNotes, handleNoteDelete, selectedNoteIds]);

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
        syncSustainEvents();
      }
    },
    [addSustainEvent, midiRegion, setSelectedSustainIds, syncSustainEvents]
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
      syncSustainEvents();
    },
    [midiRegion, updateSustainEvent, syncSustainEvents]
  );
  const handleRemoveSustainEvent = useCallback(
    (eventId: string) => {
      removeSustainEvent(eventId);
      syncSustainEvents();
    },
    [removeSustainEvent, syncSustainEvents]
  );
  const handleDeleteSustainEvents = useCallback(() => {
    selectedSustainIds.forEach((id) => removeSustainEvent(id));
    setSelectedSustainIds([]);
    syncSustainEvents();
  }, [removeSustainEvent, selectedSustainIds, setSelectedSustainIds, syncSustainEvents]);

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

  const baseTimelineWidth = totalBeats * pixelsPerBeat;

  const maxZoom = useMemo(() => {
    if (baseTimelineWidth <= 0) {
      return MAX_TIMELINE_ZOOM;
    }
    const widthLimitedZoom = MAX_CANVAS_WIDTH / baseTimelineWidth;
    if (!Number.isFinite(widthLimitedZoom) || widthLimitedZoom <= 0) {
      return MAX_TIMELINE_ZOOM;
    }
    return Math.min(MAX_TIMELINE_ZOOM, widthLimitedZoom);
  }, [baseTimelineWidth]);

  const minZoom = useMemo(() => {
    return Math.min(MIN_TIMELINE_ZOOM, maxZoom);
  }, [maxZoom]);

  const clampZoom = useCallback((value: number) => {
    const upperBound = maxZoom > 0 ? maxZoom : MIN_TIMELINE_ZOOM;
    const lowerBound = Math.min(minZoom, upperBound);
    const withinUpper = Math.min(upperBound, value);
    return Math.max(lowerBound, withinUpper);
  }, [maxZoom, minZoom]);

  // Handle zoom changes centered on cursor or playhead
  const handleZoomChange = useCallback((newZoom: number, cursorX?: number) => {
    if (!noteScrollRef.current) {
      setZoom(clampZoom(newZoom));
      return;
    }
    const clampedZoom = clampZoom(newZoom);

    // Use cursor position if provided, otherwise use playhead
    const focusPoint = cursorX !== undefined 
      ? (scrollLeft + cursorX) / (pixelsPerBeat * zoom)
      : playhead;
    
    // Calculate focus point position in pixels before zoom change
    const oldFocusPixels = focusPoint * pixelsPerBeat * zoom;
    
    // Calculate how far focus point is from left edge of viewport
    const focusOffsetInViewport = cursorX !== undefined ? cursorX : oldFocusPixels - scrollLeft;
    
    // Calculate focus point position in pixels after zoom change
    const newFocusPixels = focusPoint * pixelsPerBeat * clampedZoom;

    // Adjust scroll to keep focus point at same position in viewport
    const newScrollLeft = newFocusPixels - focusOffsetInViewport;

    setZoom(clampedZoom);

    // Apply new scroll position after zoom updates
    requestAnimationFrame(() => {
      if (noteScrollRef.current) {
        noteScrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
      }
      if (laneScrollRef.current) {
        laneScrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
      }
    });
  }, [playhead, zoom, scrollLeft, pixelsPerBeat, clampZoom]);

  useEffect(() => {
    setZoom((prev) => {
      const clamped = clampZoom(prev);
      return clamped === prev ? prev : clamped;
    });
  }, [clampZoom]);

  // Handle wheel zoom with Ctrl key
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        const delta = -e.deltaY;
        const zoomSpeed = 0.001;
        const newZoom = zoom + delta * zoomSpeed;

        // Get cursor position relative to note canvas
        const rect = noteScrollRef.current?.getBoundingClientRect();
        const cursorX = rect ? e.clientX - rect.left : undefined;

        handleZoomChange(newZoom, cursorX);
      }
    };

    const noteCanvas = noteScrollRef.current;
    if (noteCanvas) {
      noteCanvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => noteCanvas.removeEventListener('wheel', handleWheel);
    }
  }, [zoom, handleZoomChange]);
  
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
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-base-content/70">
              <span className="hidden sm:inline">View:</span>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
                className="select select-xs bg-base-200"
              >
                <option value="all-keys">All Keys</option>
                <option value="scale-keys">Scale Keys</option>
                <option value="only-notes">Only Notes</option>
              </select>
            </label>
            <span className="text-xs text-base-content/50 hidden lg:inline">
              Ctrl+Scroll to zoom
            </span>
          </div>
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
              onClick={handleDeleteSelectedNotes}
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
              onClick={() => {
                quantizeNotes(selectedNoteIds, quantizeSize);
                syncRegionNotes();
              }}
              disabled={!selectedNoteIds.length}
              title="Quantize selected notes"
            >
              <span className="hidden sm:inline">Q Selected</span>
              <span className="sm:hidden">Q Sel</span>
            </button>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => {
                quantizeAllNotes(quantizeSize);
                syncRegionNotes();
              }}
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
              onMoveNotes={handleMoveNotes}
              onDuplicateNotes={duplicateNotes}
              onResizeNotes={handleResizeNotes}
              onPan={(deltaX, deltaY) => {
                if (noteScrollRef.current) {
                  noteScrollRef.current.scrollLeft += deltaX;
                  noteScrollRef.current.scrollTop += deltaY;
                }
              }}
              onRealtimeNoteUpdates={handleRealtimeNoteUpdates}
              onRealtimeNotesFlush={flushRealtimeNotes}
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
                onSetNotesVelocity={handleSetNotesVelocity}
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
                onRealtimeEventUpdate={handleRealtimeSustainEvent}
                onRealtimeFlush={flushRealtimeSustainEvents}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export const PianoRoll = memo(PianoRollComponent);

