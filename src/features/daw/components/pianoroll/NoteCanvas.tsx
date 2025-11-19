import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Line, Stage } from 'react-konva';

import {
  HIGHEST_MIDI,
  NOTE_HEIGHT,
  LOWEST_MIDI,
} from './constants';
import type { MidiNote, NoteId } from '../../types/daw';
import { snapToGrid } from '../../utils/timeUtils';
import { getGridDivisionForZoom, getGridInterval } from '../../utils/gridUtils';
import {
  BaseNote,
  NoteResizeHandle,
  DuplicateNotePreview,
  NoteGridBackground,
  MarqueeSelection,
} from './notes';
import { usePianoRollStore } from '../../stores/pianoRollStore';
import { useArrangeRoomScaleStore } from '../../stores/arrangeRoomStore';
import { getVisibleMidiNumbers } from '../../utils/pianoRollViewUtils';

interface NoteCanvasProps {
  notes: MidiNote[];
  selectedNoteIds: NoteId[];
  totalBeats: number;
  pixelsPerBeat: number;
  zoom: number;
  playheadBeats?: number;
  scrollLeft: number;
  viewportWidth: number;
  regionHighlightStart?: number;
  regionHighlightEnd?: number;
  snapToGridEnabled: boolean;
  onSetSelectedNotes: (noteIds: NoteId[]) => void;
  onToggleNoteSelection: (noteId: NoteId) => void;
  onClearSelection: () => void;
  onCreateNote: (pitch: number, start: number) => void;
  onMoveNotes: (noteIds: NoteId[], deltaBeats: number, deltaPitch: number) => void;
  onResizeNotes: (noteIds: NoteId[], deltaBeats: number) => void;
  onDuplicateNotes: (noteIds: NoteId[], deltaBeats: number, deltaPitch: number) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
}

const clampPitch = (pitch: number) => Math.min(127, Math.max(0, pitch));

interface DragState {
  noteIds: NoteId[];
  originBeat: number;
  originPitch: number;
  deltaBeats: number;
  deltaPitch: number;
  isDuplicate: boolean;
  initial: Record<NoteId, { start: number; pitch: number }>;
}

interface ResizeState {
  noteIds: NoteId[];
  originBeat: number;
  deltaBeats: number;
  initialDurations: Record<NoteId, number>;
  previewDurations: Record<NoteId, number>;
}

interface MarqueeState {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
}

interface PanState {
  startX: number;
  startY: number;
}

interface HoldState {
  x: number;
  y: number;
  startTime: number;
}

const HOLD_DURATION = 400; // ms - duration to hold before starting marquee
const HOLD_MOVE_THRESHOLD = 10; // pixels - max movement during hold

// Memoized playhead component to prevent unnecessary parent re-renders
const PlayheadIndicator = React.memo<{ x: number; height: number; width: number }>(
  ({ x, height, width }) => {
    if (x < 0 || x > width) return null;
    
    return (
      <Layer listening={false}>
        <Line
          points={[x, 0, x, height]}
          stroke="#3b82f6"
          strokeWidth={2}
          listening={false}
        />
      </Layer>
    );
  }
);
PlayheadIndicator.displayName = 'PlayheadIndicator';

export const NoteCanvas = ({
  notes,
  selectedNoteIds,
  totalBeats,
  pixelsPerBeat,
  zoom,
  playheadBeats = 0,
  scrollLeft,
  viewportWidth,
  regionHighlightStart = 0,
  regionHighlightEnd = 0,
  snapToGridEnabled,
  onSetSelectedNotes,
  onToggleNoteSelection,
  onClearSelection,
  onCreateNote,
  onMoveNotes,
  onResizeNotes,
  onDuplicateNotes,
  onPan,
}: NoteCanvasProps) => {
  const viewMode = usePianoRollStore((state) => state.viewMode);
  const rootNote = useArrangeRoomScaleStore((state) => state.rootNote);
  const scale = useArrangeRoomScaleStore((state) => state.scale);
  
  // Import the scale checking function
  const { isNoteOutOfScale: checkIsNoteOutOfScale } = useMemo(() => {
    return {
      isNoteOutOfScale: (midiNumber: number) => {
        // Only check if in scale-keys mode
        if (viewMode !== 'scale-keys') return false;
        
        const noteInOctave = midiNumber % 12;
        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const SCALES = {
          major: [0, 2, 4, 5, 7, 9, 11],
          minor: [0, 2, 3, 5, 7, 8, 10],
        } as const;
        
        const rootIndex = NOTE_NAMES.indexOf(rootNote);
        const scaleIntervals = SCALES[scale];
        
        for (const interval of scaleIntervals) {
          if ((rootIndex + interval) % 12 === noteInOctave) {
            return false; // In scale
          }
        }
        
        return true; // Out of scale
      }
    };
  }, [viewMode, rootNote, scale]);
  
  // Get visible MIDI numbers based on view mode
  const visibleMidiNumbers = useMemo(() => {
    return getVisibleMidiNumbers(
      viewMode,
      rootNote,
      scale,
      notes,
      LOWEST_MIDI,
      HIGHEST_MIDI
    );
  }, [viewMode, rootNote, scale, notes]);
  
  // Create a map from MIDI number to row index for positioning
  const midiToRowIndex = useMemo(() => {
    const map = new Map<number, number>();
    visibleMidiNumbers.forEach((midi, index) => {
      map.set(midi, index);
    });
    return map;
  }, [visibleMidiNumbers]);
  
  // Helper function to get Y position for a pitch
  const getNoteY = useCallback((pitch: number) => {
    const rowIndex = midiToRowIndex.get(pitch);
    if (rowIndex === undefined) {
      // If pitch is not visible, return a position off-screen
      return -NOTE_HEIGHT;
    }
    return rowIndex * NOTE_HEIGHT;
  }, [midiToRowIndex]);
  
  // Helper function to get pitch from Y position
  const getPitchFromY = useCallback((y: number) => {
    const rowIndex = Math.floor(y / NOTE_HEIGHT);
    if (rowIndex < 0 || rowIndex >= visibleMidiNumbers.length) {
      return null;
    }
    return visibleMidiNumbers[rowIndex];
  }, [visibleMidiNumbers]);
  
  const width = totalBeats * pixelsPerBeat * zoom;
  const height = visibleMidiNumbers.length * NOTE_HEIGHT;
  const beatWidth = pixelsPerBeat * zoom;
  // Since notes are now in absolute positions, playhead should also be absolute
  const playheadX = playheadBeats * beatWidth;
  
  // Dynamic grid division based on zoom level
  const dynamicGridDivision = useMemo(() => getGridDivisionForZoom(zoom), [zoom]);
  const gridInterval = useMemo(() => getGridInterval(dynamicGridDivision), [dynamicGridDivision]);
  const snapBeat = useCallback(
    (value: number) => (snapToGridEnabled ? snapToGrid(value, dynamicGridDivision) : value),
    [dynamicGridDivision, snapToGridEnabled]
  );
  
  // Viewport culling - calculate visible range considering zoom
  const { visibleStartBeat, visibleEndBeat } = useMemo(() => {
    const buffer = 16; // Larger buffer to ensure all notes are rendered at high zoom
    const startBeat = Math.max(0, (scrollLeft / beatWidth) - buffer);
    const endBeat = Math.min(totalBeats, ((scrollLeft + viewportWidth) / beatWidth) + buffer);
    
    return {
      visibleStartBeat: startBeat,
      visibleEndBeat: endBeat
    };
  }, [scrollLeft, beatWidth, viewportWidth, totalBeats]);
  
  // Filter notes to only visible ones (always include selected)
  const visibleNotes = useMemo(() => {
    return notes.filter(note => {
      if (selectedNoteIds.includes(note.id)) return true; // Always render selected
      const noteEnd = note.start + note.duration;
      return noteEnd >= visibleStartBeat && note.start <= visibleEndBeat;
    });
  }, [notes, visibleStartBeat, visibleEndBeat, selectedNoteIds]);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
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
      const beat = pointer.x / beatWidth;
      const pitch = getPitchFromY(pointer.y);
      if (pitch === null) {
        return null;
      }
      return {
        beat,
        pitch: clampPitch(pitch),
        pointer,
      };
    },
    [beatWidth, getPitchFromY]
  );

  const handleBackgroundDoubleClick = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const data = getPointerData(event as unknown as KonvaEventObject<PointerEvent>);
      if (!data) {
        return;
      }
      const targetBeat = Math.max(0, snapBeat(data.beat));
      onCreateNote(data.pitch, targetBeat);
    },
    [getPointerData, onCreateNote, snapBeat]
  );

  const handleNotePointerDown = useCallback(
    (note: MidiNote, event: KonvaEventObject<PointerEvent>) => {
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
        onToggleNoteSelection(note.id);
      } else if (!selectedNoteIds.includes(note.id)) {
        onSetSelectedNotes([note.id]);
      }
      const noteIds =
        event.evt.shiftKey || selectedNoteIds.includes(note.id)
          ? Array.from(new Set([...selectedNoteIds, note.id]))
          : [note.id];
      const data = getPointerData(event);
      if (!data) {
        return;
      }
      const pointerBeat = snapBeat(data.beat);
      setDragState({
        noteIds,
        originBeat: pointerBeat,
        originPitch: data.pitch,
        deltaBeats: 0,
        deltaPitch: 0,
        isDuplicate: event.evt.altKey, // Alt key for duplication
        initial: noteIds.reduce<Record<NoteId, { start: number; pitch: number }>>(
          (acc, id) => {
            const target = notes.find((n) => n.id === id);
            if (target) {
              acc[id] = { start: target.start, pitch: target.pitch };
            }
            return acc;
          },
          {}
        ),
      });
    },
    [getPointerData, notes, onSetSelectedNotes, onToggleNoteSelection, selectedNoteIds, snapBeat]
  );

  const handleResizeHandleDown = useCallback(
    (note: MidiNote, event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      const noteIds = selectedNoteIds.includes(note.id) ? selectedNoteIds : [note.id];
      const data = getPointerData(event);
      if (!data) {
        return;
      }
      const originBeat = snapBeat(data.beat);
      const initialDurations = noteIds.reduce<Record<NoteId, number>>((acc, id) => {
        const target = notes.find((n) => n.id === id);
        if (target) {
          acc[id] = target.duration;
        }
        return acc;
      }, {});
      setResizeState({
        noteIds,
        originBeat,
        deltaBeats: 0,
        initialDurations,
        previewDurations: { ...initialDurations },
      });
    },
    [getPointerData, notes, selectedNoteIds, snapBeat]
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
        const pointerBeat = snapBeat(data.beat);
        const deltaBeats = pointerBeat - dragState.originBeat;
        const deltaPitch = clampPitch(data.pitch) - dragState.originPitch;
        const minStart = dragState.noteIds.reduce((minValue, id) => {
          const { start } = dragState.initial[id];
          return Math.min(minValue, start);
        }, Infinity);
        const clampedDeltaBeats = Math.max(deltaBeats, -minStart);
        const minPitch = dragState.noteIds.reduce((minValue, id) => {
          const { pitch } = dragState.initial[id];
          return Math.min(minValue, pitch);
        }, Infinity);
        const maxPitch = dragState.noteIds.reduce((maxValue, id) => {
          const { pitch } = dragState.initial[id];
          return Math.max(maxValue, pitch);
        }, -Infinity);
        const clampedDeltaPitch = Math.max(
          Math.min(deltaPitch, 127 - maxPitch),
          0 - minPitch
        );
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                deltaBeats: clampedDeltaBeats,
                deltaPitch: clampedDeltaPitch,
              }
            : prev
        );
      } else if (resizeState) {
        const data = getPointerData(event);
        if (!data) {
          return;
        }
        const pointerBeat = snapBeat(data.beat);
        let deltaBeats = pointerBeat - resizeState.originBeat;
        const minDelta = resizeState.noteIds.reduce((minValue, id) => {
          const initial = resizeState.initialDurations[id];
          return Math.min(minValue, initial - 0.25);
        }, Infinity);
        if (minDelta !== Infinity) {
          deltaBeats = Math.max(deltaBeats, -minDelta);
        }
        const previewDurations = resizeState.noteIds.reduce<Record<NoteId, number>>(
          (acc, id) => {
            const initial = resizeState.initialDurations[id];
            acc[id] = Math.max(0.25, initial + deltaBeats);
            return acc;
          },
          {}
        );
        setResizeState((prev) =>
          prev
            ? {
                ...prev,
                deltaBeats,
                previewDurations,
              }
            : prev
        );
      } else if (marqueeState) {
        const stage = event.target.getStage();
        if (!stage) {
          return;
        }
        const pointer = stage.getPointerPosition();
        if (!pointer) {
          return;
        }
        setMarqueeState((prev) =>
          prev
            ? {
                ...prev,
                currentX: pointer.x,
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
    [dragState, getPointerData, holdState, marqueeState, onPan, panState, resizeState, snapBeat]
  );

  const handlePointerUp = useCallback(() => {
      if (dragState) {
        if (dragState.deltaBeats !== 0 || dragState.deltaPitch !== 0) {
          if (dragState.isDuplicate) {
            // Alt+drag: Duplicate notes
            onDuplicateNotes(dragState.noteIds, dragState.deltaBeats, dragState.deltaPitch);
          } else {
            // Normal drag: Move notes
            onMoveNotes(dragState.noteIds, dragState.deltaBeats, dragState.deltaPitch);
          }
        }
        setDragState(null);
      }
      if (panState) {
        setPanState(null);
      }
      if (resizeState) {
        if (resizeState.deltaBeats !== 0) {
          onResizeNotes(resizeState.noteIds, resizeState.deltaBeats);
        }
        setResizeState(null);
      }
      if (marqueeState) {
        const x1 = Math.min(marqueeState.originX, marqueeState.currentX);
        const x2 = Math.max(marqueeState.originX, marqueeState.currentX);
        const y1 = Math.min(marqueeState.originY, marqueeState.currentY);
        const y2 = Math.max(marqueeState.originY, marqueeState.currentY);
        const selected = notes
          .filter((note) => {
            const noteX = note.start * beatWidth;
            const noteWidth = note.duration * beatWidth;
            const noteY = getNoteY(note.pitch);
            return (
              noteX < x2 &&
              noteX + noteWidth > x1 &&
              noteY < y2 &&
              noteY + NOTE_HEIGHT > y1
            );
          })
          .map((note) => note.id);
        const combined = marqueeState.additive
          ? Array.from(new Set([...selectedNoteIds, ...selected]))
          : selected;
        onSetSelectedNotes(combined);
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
    },
    [
      beatWidth,
      dragState,
      getNoteY,
      holdState,
      marqueeState,
      notes,
      onDuplicateNotes,
      onMoveNotes,
      onResizeNotes,
      onSetSelectedNotes,
      panState,
      resizeState,
      selectedNoteIds,
    ]
  );

  const handleMarqueeStart = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (!stage) {
        return;
      }
      const target = event.target;
      const isBackground = target === stage || target.name() === 'note-background';
      if (!isBackground) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      
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
        // For touch: start hold timer for marquee selection
        setHoldState({
          x: pointer.x,
          y: pointer.y,
          startTime: Date.now(),
        });
        
        holdTimerRef.current = window.setTimeout(() => {
          // After hold duration, start marquee selection
          setMarqueeState({
            originX: pointer.x,
            originY: pointer.y,
            currentX: pointer.x,
            currentY: pointer.y,
            additive: event.evt.shiftKey,
          });
          setHoldState(null);
          holdTimerRef.current = null;
        }, HOLD_DURATION);
      } else {
        // For mouse: immediately start marquee selection
        setMarqueeState({
          originX: pointer.x,
          originY: pointer.y,
          currentX: pointer.x,
          currentY: pointer.y,
          additive: event.evt.shiftKey,
        });
      }
    },
    []
  );

  const dragOffsets = useMemo(() => {
    if (!dragState) {
      return {};
    }
    return dragState.noteIds.reduce<Record<NoteId, { beat: number; pitch: number }>>(
      (acc, id) => {
        acc[id] = {
          beat: dragState.deltaBeats,
          pitch: dragState.deltaPitch,
        };
        return acc;
      },
      {}
    );
  }, [dragState]);

  const previewDurations = useMemo(() => {
    if (!resizeState) {
      return {};
    }
    return resizeState.previewDurations;
  }, [resizeState]);


  return (
    <Stage
      width={width}
      height={height}
      onPointerMove={handlePointerMove}
      onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
      onPointerUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
      onMouseDown={handleMarqueeStart}
      onTouchStart={(e) => handleMarqueeStart(e as unknown as KonvaEventObject<PointerEvent>)}
      onDblClick={handleBackgroundDoubleClick}
      perfectDrawEnabled={false}
    >
      {/* Static Layer: Background and grid - rarely changes */}
      <Layer>
        <NoteGridBackground
          width={width}
          height={height}
          beatWidth={beatWidth}
          totalBeats={totalBeats}
          visibleStartBeat={visibleStartBeat}
          visibleEndBeat={visibleEndBeat}
          gridInterval={gridInterval}
          regionHighlightStart={regionHighlightStart}
          regionHighlightEnd={regionHighlightEnd}
          visibleMidiNumbers={visibleMidiNumbers}
          midiToRowIndex={midiToRowIndex}
        />
      </Layer>
      
      {/* Dynamic Layer: Notes and interactive elements */}
      <Layer
        onPointerDown={(event) => {
          // Event delegation: find which element was clicked
          const target = event.target;
          const targetName = target.name();
          
          if (targetName && targetName.startsWith('note-')) {
            const noteId = targetName.replace('note-', '');
            const note = visibleNotes.find((n) => n.id === noteId);
            if (note) {
              handleNotePointerDown(note, event);
            }
          } else if (targetName && targetName.startsWith('handle-')) {
            const noteId = targetName.replace('handle-', '');
            const note = visibleNotes.find((n) => n.id === noteId);
            if (note) {
              handleResizeHandleDown(note, event);
            }
          } else if (targetName === 'note-background' && !event.evt.shiftKey) {
            // Clear selection when clicking background without shift
            onClearSelection();
          }
        }}
      >
        {/* Regular editable notes - only visible */}
        {visibleNotes.map((note) => {
          const isDragging = Boolean(dragState?.noteIds.includes(note.id));
          const isDuplicating = isDragging && dragState?.isDuplicate;
          const dragOffset = isDuplicating ? undefined : dragOffsets[note.id];
          const previewDuration = previewDurations[note.id];
          const isSelected = selectedNoteIds.includes(note.id);
          
          // Check if note is out of scale (considering drag offset)
          const effectivePitch = dragOffset 
            ? clampPitch(note.pitch + dragOffset.pitch)
            : note.pitch;
          const isOutOfScale = checkIsNoteOutOfScale(effectivePitch);
          
          return (
            <BaseNote
              key={note.id}
              note={note}
              beatWidth={beatWidth}
              isSelected={isSelected}
              isDragging={isDragging}
              dragOffset={dragOffset}
              previewDuration={previewDuration}
              getNoteY={getNoteY}
              isOutOfScale={isOutOfScale}
            />
          );
        })}
        {/* Resize handles - only for visible selected notes (not when duplicating) */}
        {!dragState?.isDuplicate && visibleNotes
          .filter(note => selectedNoteIds.includes(note.id))
          .map((note) => {
            const dragOffset = dragOffsets[note.id];
            const previewDuration = previewDurations[note.id];
            
            return (
              <NoteResizeHandle
                key={`handle-${note.id}`}
                note={note}
                beatWidth={beatWidth}
                dragOffset={dragOffset}
                previewDuration={previewDuration}
                getNoteY={getNoteY}
              />
            );
          })}
        
        {/* Duplicate previews when Alt+dragging */}
        {dragState?.isDuplicate && visibleNotes
          .filter(note => dragState.noteIds.includes(note.id))
          .map((note) => {
            const dragOffset = dragOffsets[note.id];
            if (!dragOffset) {
              return null;
            }
            
            // Check if the duplicated note will be out of scale at its new position
            const newPitch = clampPitch(note.pitch + dragOffset.pitch);
            const isOutOfScale = checkIsNoteOutOfScale(newPitch);
            
            return (
              <DuplicateNotePreview
                key={`duplicate-preview-${note.id}`}
                note={note}
                beatWidth={beatWidth}
                dragOffset={dragOffset}
                getNoteY={getNoteY}
                isOutOfScale={isOutOfScale}
              />
            );
          })}
        
        {marqueeState && (
          <MarqueeSelection
            originX={marqueeState.originX}
            originY={marqueeState.originY}
            currentX={marqueeState.currentX}
            currentY={marqueeState.currentY}
          />
        )}
      </Layer>
      
      {/* Playhead Layer: Separate memoized component for independent updates */}
      <PlayheadIndicator x={playheadX} height={height} width={width} />
    </Stage>
  );
};

