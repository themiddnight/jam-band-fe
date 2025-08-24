/* eslint-disable react-hooks/exhaustive-deps */
import React, { memo, useCallback, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import type {
  SequencerRow,
  DrumRow,
  NoteRow,
  EditMode,
  SequencerStep,
} from "../types";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";

// Remove pxToTailwind function - we'll use inline styles instead

interface StepGridProps {
  rows: SequencerRow[];
  currentBeat: number;
  sequenceLength: number;
  isRecording: boolean;
  editMode: EditMode;
  onStepToggle: (beat: number, note: string) => void;
  onBeatSelect: (beat: number) => void;
  hasStepAt: (beat: number, note: string) => boolean;
  getStepData: (beat: number, note: string) => SequencerStep | null;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onUpdateStep: (
    beat: number,
    note: string,
    updates: Partial<SequencerStep>
  ) => void;
}

// Optimize step data lookup - create a stable lookup function
const createStepDataLookup = (
  hasStepAt: (beat: number, note: string) => boolean,
  getStepData: (beat: number, note: string) => SequencerStep | null
) => {
  return (beat: number, note: string) => {
    // Only call getStepData if we know there's a step (performance optimization)
    return hasStepAt(beat, note) ? getStepData(beat, note) : null;
  };
};

const StepCell = memo(
  ({
    beat,
    note,
    isActive,
    isRecording,
    editMode,
    row,
    stepData,
    cellSize,
    onToggle,
    onBeatSelect,
    onUpdateStep,
  }: {
    beat: number;
    note: string;
    isActive: boolean;
    isRecording: boolean;
    editMode: EditMode;
    row: SequencerRow;
    stepData: SequencerStep | null;
    cellSize: string;
    onToggle: () => void;
    onBeatSelect: () => void;
    onUpdateStep: (
      beat: number,
      note: string,
      updates: Partial<SequencerStep>
    ) => void;
  }) => {
    // Touch event handlers for mobile interaction

    const isDrumRow = (row: SequencerRow): row is DrumRow => {
      return "sampleName" in row;
    };

    const isNoteRow = (row: SequencerRow): row is NoteRow => {
      return "note" in row && "inScale" in row;
    };

    // Determine cell styling based on edit mode
    const getCellClasses = () => {
      const baseClasses = `btn btn-sm p-0 border border-white/20 transition-all duration-75 relative overflow-hidden cursor-pointer`;

      if (isActive && stepData) {
        if (editMode === "gate") {
          // Gate mode: Green color scheme
          return `${baseClasses} bg-success/20 border-success text-success-content hover:bg-success/30 active:bg-success/40`;
        } else if (editMode === "velocity") {
          // Velocity mode: Orange color scheme
          return `${baseClasses} bg-warning/20 border-warning text-warning-content hover:bg-warning/30 active:bg-warning/40`;
        } else {
          // Note mode: Traditional accent colors
          if (isDrumRow(row)) {
            return `${baseClasses} btn-accent border-accent-focus text-accent-content`;
          } else if (isNoteRow(row) && !row.inScale) {
            return `${baseClasses} btn-warning border-warning-focus text-warning-content opacity-75`;
          } else {
            return `${baseClasses} btn-accent border-accent-focus text-accent-content`;
          }
        }
      }

      // Beat column styling
      const beatStyle =
        (beat + 1) % 4 === 1 ? "border-base-300" : "border-base-200";

      // Row styling for out-of-scale notes
      if (isNoteRow(row) && !row.inScale) {
        return `${baseClasses} btn-ghost ${beatStyle} opacity-50 hover:opacity-75`;
      }

      return `${baseClasses} btn-ghost ${beatStyle} hover:btn-outline`;
    };

    // Get cell content based on edit mode
    const getCellContent = () => {
      if (!isActive || !stepData) {
        return null;
      }

      switch (editMode) {
        case "note":
          return isRecording ? (
            <span className="text-xs font-bold">●</span>
          ) : (
            <span className="text-xs font-bold">■</span>
          );

        case "gate": {
          const gateWidth = Math.max(10, stepData.gate * 100); // 10% minimum
          return (
            <div
              className="absolute left-0 top-0 h-full bg-accent opacity-80 rounded-r-sm"
              style={{ width: `${gateWidth}%` }}
              title={`Gate: ${Math.round(stepData.gate * 100)}%`}
            />
          );
        }

        case "velocity": {
          const velocityHeight = Math.max(10, stepData.velocity * 100); // 10% minimum
          return (
            <div
              className="absolute left-0 bottom-0 w-full bg-accent opacity-80 rounded-t-sm"
              style={{ height: `${velocityHeight}%` }}
              title={`Velocity: ${Math.round(stepData.velocity * 100)}%`}
            />
          );
        }

        default:
          return <span className="text-xs font-bold">■</span>;
      }
    };

    const handleInteraction = useCallback(
      (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();

        // Handle touch events differently for better mobile UX
        if (e.type === "touchend") {
          // Get touch duration for long press detection
          const touchDuration = Date.now() - (e.target as any)._touchStartTime;

          if (touchDuration > 500) {
            // Long press: select beat
            onBeatSelect();
          } else {
            // Short tap: toggle step
            onToggle();
          }
          return;
        }

        // Mouse events
        if (e.type === "click") {
          onToggle();
        } else if (e.type === "contextmenu") {
          e.preventDefault();
          onBeatSelect();
        }
      },
      [onToggle, onBeatSelect]
    );

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      // Store touch start time for duration calculation
      (e.target as any)._touchStartTime = Date.now();
    }, []);

    // Drag state for gate and velocity editing
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStartPos, setDragStartPos] = React.useState({ x: 0, y: 0 });
    const [dragStartValue, setDragStartValue] = React.useState(0);

    // Handle pointer down for drag start (unified mouse/touch/pen events)
    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLButtonElement>) => {
        if (editMode === "note") return;

        e.preventDefault();
        // Capture pointer to ensure we receive events even when cursor moves outside element
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setIsDragging(true);

        setDragStartPos({ x: e.clientX, y: e.clientY });

        if (stepData) {
          setDragStartValue(
            editMode === "gate" ? stepData.gate : stepData.velocity
          );
        } else {
          setDragStartValue(
            editMode === "gate"
              ? SEQUENCER_CONSTANTS.DEFAULT_GATE
              : SEQUENCER_CONSTANTS.DEFAULT_VELOCITY
          );
        }
      },
      [editMode, stepData]
    );

    // Handle pointer move for drag
    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isDragging || editMode === "note") return;

        e.preventDefault();

        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = dragStartPos.y - e.clientY; // Invert Y for intuitive up = increase

        let rawValue: number;

        if (editMode === "gate") {
          // Horizontal drag for gate (pixels to percentage)
          const sensitivity = 100; // 100px = 100% change
          rawValue = dragStartValue + deltaX / sensitivity;
        } else if (editMode === "velocity") {
          // Vertical drag for velocity (pixels to percentage)
          const sensitivity = 80; // 80px = 100% change
          rawValue = dragStartValue + deltaY / sensitivity;
        } else {
          return;
        }

        // Clamp raw value between minimum and 1.0
        const minValue =
          editMode === "gate"
            ? SEQUENCER_CONSTANTS.MIN_GATE
            : SEQUENCER_CONSTANTS.MIN_VELOCITY;
        const clampedValue = Math.max(minValue, Math.min(1.0, rawValue));

        // Apply stepping (10 steps from min to 1.0)
        const steps =
          editMode === "gate"
            ? SEQUENCER_CONSTANTS.GATE_STEPS
            : SEQUENCER_CONSTANTS.VELOCITY_STEPS;
        const stepSize = (1.0 - minValue) / (steps - 1);
        const stepIndex = Math.round((clampedValue - minValue) / stepSize);
        const steppedValue = minValue + stepIndex * stepSize;

        // Update the step data only if we don't have a step yet (for creating new steps)
        if (!stepData) {
          // In gate/velocity mode, can't create new steps, only edit existing ones
          return;
        }

        // Update the specific property
        const updates =
          editMode === "gate"
            ? { gate: steppedValue }
            : { velocity: steppedValue };

        onUpdateStep(beat, note, updates);
      },
      [
        isDragging,
        dragStartPos,
        dragStartValue,
        editMode,
        stepData,
        onUpdateStep,
        beat,
        note,
      ]
    );

    // Handle pointer up for drag end
    const handlePointerUp = useCallback(() => {
      setIsDragging(false);
    }, []);

    return (
      <button
        className={getCellClasses()}
        onClick={editMode === "note" ? onToggle : onBeatSelect}
        onTouchEnd={handleInteraction}
        onTouchStart={handleTouchStart}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          touchAction: editMode === "note" ? "auto" : "none", // Prevent scrolling during drag in gate/velocity modes
          width: cellSize,
          height: cellSize,
          minWidth: cellSize,
          minHeight: cellSize,
        }}
        title={`Beat ${beat + 1}: ${isDrumRow(row) ? row.displayName : note}${isActive ? " (Active)" : ""}`}
        aria-label={`Step ${beat + 1} for ${isDrumRow(row) ? row.displayName : note}`}
        aria-pressed={isActive}
      >
        {getCellContent()}
      </button>
    );
  }
);

StepCell.displayName = "StepCell";

const RowLabel = memo(
  ({
    row,
    labelWidth,
    onPlayNotes,
    onStopNotes,
  }: {
    row: SequencerRow;
    labelWidth: string;
    onPlayNotes: (
      notes: string[],
      velocity: number,
      isKeyHeld: boolean
    ) => void;
    onStopNotes: (notes: string[]) => void;
  }) => {
    const isDrumRow = (row: SequencerRow): row is DrumRow => {
      return "sampleName" in row;
    };

    const isNoteRow = (row: SequencerRow): row is NoteRow => {
      return "note" in row && "inScale" in row;
    };

    const getLabelClasses = () => {
      const baseClasses = `text-xs text-white font-medium text-right p-2 border-r border-base-200 flex items-center justify-end cursor-pointer transition-colors hover:bg-base-200 active:bg-base-300 select-none`;

      if (isNoteRow(row) && !row.inScale) {
        return `${baseClasses} text-base-content/50`;
      }

      return `${baseClasses} text-base-content`;
    };

    const getNoteName = () => {
      return isDrumRow(row) ? row.sampleName : row.note;
    };

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        const noteName = getNoteName();
        onPlayNotes([noteName], 80, true); // velocity 80, isKeyHeld true for preview
      },
      [onPlayNotes]
    );

    const handleMouseUp = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        const noteName = getNoteName();
        onStopNotes([noteName]);
      },
      [onStopNotes]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        const noteName = getNoteName();
        onStopNotes([noteName]);
      },
      [onStopNotes]
    );

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        e.preventDefault();
        const noteName = getNoteName();
        onPlayNotes([noteName], 80, true);
      },
      [onPlayNotes]
    );

    const handleTouchEnd = useCallback(
      (e: React.TouchEvent) => {
        e.preventDefault();
        const noteName = getNoteName();
        onStopNotes([noteName]);
      },
      [onStopNotes]
    );

    return (
      <button
        className={getLabelClasses()}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          width: labelWidth,
          minWidth: labelWidth,
        }}
        title={`Preview ${isDrumRow(row) ? row.displayName : row.displayName}`}
      >
        <span className="truncate">
          {isDrumRow(row) ? row.displayName : row.displayName}
        </span>
      </button>
    );
  }
);

RowLabel.displayName = "RowLabel";

// Virtual row component for react-window
interface VirtualRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    rows: Array<{ row: SequencerRow; rowIndex: number; key: string }>;
    gridStyles: any;
    beatNumbers: number[];
    sequenceLength: number;
    currentBeat: number;
    isRecording: boolean;
    editMode: EditMode;
    stepDataLookup: (beat: number, note: string) => SequencerStep | null;
    hasStepAt: (beat: number, note: string) => boolean;
    onStepToggle: (beat: number, note: string) => void;
    onBeatSelect: (beat: number) => void;
    onUpdateStep: (beat: number, note: string, updates: Partial<SequencerStep>) => void;
    onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
    onStopNotes: (notes: string[]) => void;
  };
}

const VirtualRow = memo(({ index, style, data }: VirtualRowProps) => {
  const { 
    rows, 
    gridStyles, 
    beatNumbers, 
    stepDataLookup, 
    hasStepAt, 
    onStepToggle, 
    onBeatSelect, 
    onUpdateStep, 
    onPlayNotes, 
    onStopNotes,
    isRecording,
    editMode
  } = data;
  
  const rowData = rows[index];
  if (!rowData) return null;
  
  const { row } = rowData;
  const note = 'sampleName' in row ? row.sampleName : row.note;

  return (
    <div style={style} className="flex items-center">
      <RowLabel 
        row={row} 
        labelWidth={gridStyles.labelWidth}
        onPlayNotes={onPlayNotes} 
        onStopNotes={onStopNotes} 
      />
      <div 
        className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-100"
        style={{ gap: gridStyles.cellGap }}
      >
        {beatNumbers.map((beatIndex) => {
          const stepData = stepDataLookup(beatIndex, note);
          
          return (
            <StepCell
              key={`${note}-${beatIndex}`}
              beat={beatIndex}
              note={note}
              isActive={hasStepAt(beatIndex, note)}
              isRecording={isRecording}
              editMode={editMode}
              row={row}
              stepData={stepData}
              cellSize={gridStyles.cellSize}
              onToggle={() => onStepToggle(beatIndex, note)}
              onBeatSelect={() => onBeatSelect(beatIndex)}
              onUpdateStep={onUpdateStep}
            />
          );
        })}
      </div>
    </div>
  );
});

VirtualRow.displayName = "VirtualRow";

export const StepGrid = memo(
  ({
    rows,
    currentBeat,
    sequenceLength,
    isRecording,
    editMode,
    onStepToggle,
    onBeatSelect,
    hasStepAt,
    getStepData,
    onPlayNotes,
    onStopNotes,
    onUpdateStep,
  }: StepGridProps) => {
    // Memoize calculated style values to avoid recalculation on every render
    const gridStyles = useMemo(
      () => ({
        cellSize: `${SEQUENCER_CONSTANTS.GRID.CELL_SIZE}px`,
        cellGap: `${SEQUENCER_CONSTANTS.GRID.CELL_GAP}px`,
        labelWidth: `${SEQUENCER_CONSTANTS.GRID.LABEL_WIDTH}px`,
        beatHeaderHeight: `${SEQUENCER_CONSTANTS.GRID.BEAT_HEADER_HEIGHT}px`,
        // Calculate playhead position once
        playheadTransform: `translateX(${currentBeat * (SEQUENCER_CONSTANTS.GRID.CELL_SIZE + SEQUENCER_CONSTANTS.GRID.CELL_GAP) + SEQUENCER_CONSTANTS.GRID.LABEL_WIDTH}px)`,
      }),
      [currentBeat]
    );

    const beatNumbers = useMemo(
      () => Array.from({ length: sequenceLength }, (_, i) => i),
      [sequenceLength]
    );

    // Optimize step toggle and beat select handlers
    const handleStepToggle = useCallback(onStepToggle, [onStepToggle]);
    const handleBeatSelect = useCallback(onBeatSelect, [onBeatSelect]);

    // Memoize row data to prevent unnecessary re-renders
    const memoizedRows = useMemo(() => {
      return rows.map((row, rowIndex) => ({
        row,
        rowIndex,
        key: 'sampleName' in row ? row.sampleName : row.note,
      }));
    }, [rows]);

    // Create stable step data lookup function (FIXED: no more Map recreation)
    const stepDataLookup = useMemo(() => {
      return createStepDataLookup(hasStepAt, getStepData);
    }, [hasStepAt, getStepData]);

    // Use virtualization for large grids (>8 rows)
    const shouldUseVirtualization = memoizedRows.length > 8;
    const rowHeight = SEQUENCER_CONSTANTS.GRID.CELL_SIZE + 4; // cell size + margin
    const maxHeight = shouldUseVirtualization ? 300 : undefined; // 300px max height for virtual list
    const listWidth = shouldUseVirtualization ? 
      SEQUENCER_CONSTANTS.GRID.LABEL_WIDTH + (sequenceLength * (SEQUENCER_CONSTANTS.GRID.CELL_SIZE + SEQUENCER_CONSTANTS.GRID.CELL_GAP)) + 100 : 
      undefined; // Add 100px buffer for scrollbar

    // Virtual list data
    const virtualListData = useMemo(() => ({
      rows: memoizedRows,
      gridStyles,
      beatNumbers,
      sequenceLength,
      currentBeat,
      isRecording,
      editMode,
      stepDataLookup,
      hasStepAt,
      onStepToggle: handleStepToggle,
      onBeatSelect: handleBeatSelect,
      onUpdateStep,
      onPlayNotes,
      onStopNotes,
    }), [
      memoizedRows,
      gridStyles,
      beatNumbers,
      sequenceLength,
      currentBeat,
      isRecording,
      editMode,
      stepDataLookup,
      hasStepAt,
      handleStepToggle,
      handleBeatSelect,
      onUpdateStep,
      onPlayNotes,
      onStopNotes,
    ]);

    // Non-virtualized row component for small grids
    const RegularRow = memo(({ 
      rowData, 
    }: {
      rowData: { row: any; rowIndex: number; key: string };
    }) => {
      const { row } = rowData;
      const note = 'sampleName' in row ? row.sampleName : row.note;
      
      return (
        <div key={rowData.key} className="flex items-center">
          <RowLabel 
            row={row} 
            labelWidth={gridStyles.labelWidth}
            onPlayNotes={onPlayNotes} 
            onStopNotes={onStopNotes} 
          />
          <div 
            className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-100"
            style={{ gap: gridStyles.cellGap }}
          >
            {beatNumbers.map((beatIndex) => {
              const stepData = stepDataLookup(beatIndex, note);
              
              return (
                <StepCell
                  key={`${note}-${beatIndex}`}
                  beat={beatIndex}
                  note={note}
                  isActive={hasStepAt(beatIndex, note)}
                  isRecording={isRecording}
                  editMode={editMode}
                  row={row}
                  stepData={stepData}
                  cellSize={gridStyles.cellSize}
                  onToggle={() => handleStepToggle(beatIndex, note)}
                  onBeatSelect={() => handleBeatSelect(beatIndex)}
                  onUpdateStep={onUpdateStep}
                />
              );
            })}
          </div>
        </div>
      );
    });

    RegularRow.displayName = "RegularRow";

    if (rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-base-content/50">
          <p className="text-sm">
            No rows to display. Adjust your display mode settings.
          </p>
        </div>
      );
    }

    return (
      <div className="w-fit mx-auto relative text-white">
        {/* Playhead Overlay */}
        <div
          className={`absolute top-0 left-0 h-full pointer-events-none z-10 rounded-sm ${
            isRecording
              ? "border-2 border-error shadow-lg animate-pulse"
              : "border-2 border-primary shadow-md"
          }`}
          style={{
            width: gridStyles.cellSize,
            transform: gridStyles.playheadTransform,
          }}
        />

        {/* Beat number header */}
        <div className="flex mb-1">
          <div
            style={{
              width: gridStyles.labelWidth,
              minWidth: gridStyles.labelWidth,
            }}
            className="shrink-0"
          ></div>
          <div
            className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-100"
            style={{ gap: gridStyles.cellGap }}
          >
            {beatNumbers.map((beat) => (
              <button
                key={beat}
                onClick={() => handleBeatSelect(beat)}
                className="flex items-center justify-center text-xs font-bold border-b-2 transition-colors cursor-pointer hover:bg-base-200"
                style={{
                  minWidth: gridStyles.cellSize,
                  width: gridStyles.cellSize,
                  height: gridStyles.beatHeaderHeight,
                  minHeight: gridStyles.beatHeaderHeight,
                  borderColor:
                    (beat + 1) % 4 === 1
                      ? "hsl(var(--bc) / 0.3)"
                      : "hsl(var(--bc) / 0.2)",
                  color:
                    (beat + 1) % 4 === 1
                      ? "hsl(var(--bc))"
                      : "hsl(var(--bc) / 0.7)",
                }}
                title={`Jump to beat ${beat + 1}`}
              >
                {beat + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Step grid rows - virtualized for large grids */}
        {shouldUseVirtualization ? (
          <List
            height={maxHeight!}
            width={listWidth!}
            itemCount={memoizedRows.length}
            itemSize={rowHeight}
            itemData={virtualListData}
            className="scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-100"
          >
            {VirtualRow}
          </List>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-100">
            {memoizedRows.map((rowData) => (
              <RegularRow
                key={rowData.key}
                rowData={rowData}
              />
            ))}
          </div>
        )}

        {/* Mobile scroll hint */}
        <div className="md:hidden mt-2 text-xs text-base-content/50 text-center">
          Swipe horizontally to scroll beats
        </div>
      </div>
    );
  }
);

StepGrid.displayName = "StepGrid";
