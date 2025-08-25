import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { VariableSizeGrid as Grid } from "react-window";
import type {
  SequencerRow,
  DrumRow,
  NoteRow,
  EditMode,
  SequencerStep,
} from "../types";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";

interface VirtualizedStepGridProps {
  rows: SequencerRow[];
  currentBeat: number;
  sequenceLength: number;
  isRecording: boolean;
  editMode: EditMode;
  onStepToggle: (beat: number, note: string) => void;
  onBeatSelect: (beat: number) => void;
  onCurrentBeatChange: (beat: number) => void;
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

// Cell data interface for react-window
interface CellData {
  rows: SequencerRow[];
  sequenceLength: number;
  isRecording: boolean;
  editMode: EditMode;
  onStepToggle: (beat: number, note: string) => void;
  onBeatSelect: (beat: number) => void;
  onCurrentBeatChange: (beat: number) => void;
  hasStepAt: (beat: number, note: string) => boolean;
  getStepData: (beat: number, note: string) => SequencerStep | null;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onUpdateStep: (beat: number, note: string, updates: Partial<SequencerStep>) => void;
  gridConstants: {
    gridCellSize: number;
    noteCellSize: number;
    cellGap: number;
    labelWidth: number;
    beatHeaderHeight: number;
  };
}

// Type guards
const isDrumRow = (row: SequencerRow): row is DrumRow => {
  return "sampleName" in row;
};

const isNoteRow = (row: SequencerRow): row is NoteRow => {
  return "note" in row && "inScale" in row;
};

// Beat header cell component
const BeatHeaderCell = memo(({ beatIndex, onBeatSelect, onCurrentBeatChange }: {
  beatIndex: number;
  onBeatSelect: (beat: number) => void;
  onCurrentBeatChange: (beat: number) => void;
}) => (
  <button
    onClick={() => {
      onBeatSelect(beatIndex);
      onCurrentBeatChange(beatIndex);
    }}
    className="w-full h-full flex items-center justify-center text-xs font-bold border-b-2 transition-colors cursor-pointer hover:bg-base-200"
    style={{
      borderColor:
        (beatIndex + 1) % 4 === 1
          ? "hsl(var(--bc) / 0.3)"
          : "hsl(var(--bc) / 0.2)",
      color:
        (beatIndex + 1) % 4 === 1
          ? "hsl(var(--bc))"
          : "hsl(var(--bc) / 0.7)",
    }}
    title={`Jump to beat ${beatIndex + 1}`}
  >
    {beatIndex + 1}
  </button>
));

BeatHeaderCell.displayName = "BeatHeaderCell";

// Row label cell component
const RowLabelCell = memo(({ row, onPlayNotes, onStopNotes }: {
  row: SequencerRow;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
}) => {
  const getNoteName = useCallback(() => {
    return isDrumRow(row) ? row.sampleName : row.note;
  }, [row]);

  const getLabelClasses = useCallback(() => {
    const baseClasses = `w-full h-full text-xs text-white font-medium p-2 border-r border-base-200 flex items-center justify-end cursor-pointer transition-colors hover:bg-base-200 active:bg-base-300 select-none`;

    if (isNoteRow(row) && !row.inScale) {
      return `${baseClasses} text-base-content/50`;
    }

    return `${baseClasses} text-base-content`;
  }, [row]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const noteName = getNoteName();
      onPlayNotes([noteName], 80, true);
    },
    [getNoteName, onPlayNotes]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const noteName = getNoteName();
      onStopNotes([noteName]);
    },
    [getNoteName, onStopNotes]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const noteName = getNoteName();
      onStopNotes([noteName]);
    },
    [getNoteName, onStopNotes]
  );

  return (
    <button
      className={getLabelClasses()}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      title={`Preview ${isDrumRow(row) ? row.displayName : row.displayName}`}
    >
      <span className="truncate">
        {isDrumRow(row) ? row.displayName : row.displayName}
      </span>
    </button>
  );
});

RowLabelCell.displayName = "RowLabelCell";

// Step cell component
const StepCell = memo(({ 
  row, 
  beatIndex, 
  isRecording, 
  editMode, 
  hasStepAt, 
  getStepData, 
  onStepToggle, 
  onUpdateStep,
  gridConstants
}: {
  row: SequencerRow;
  beatIndex: number;
  isRecording: boolean;
  editMode: EditMode;
  hasStepAt: (beat: number, note: string) => boolean;
  getStepData: (beat: number, note: string) => SequencerStep | null;
  onStepToggle: (beat: number, note: string) => void;
  onUpdateStep: (beat: number, note: string, updates: Partial<SequencerStep>) => void;
  gridConstants: {
    gridCellSize: number;
    noteCellSize: number;
    cellGap: number;
    labelWidth: number;
    beatHeaderHeight: number;
  };
}) => {
  const note = isDrumRow(row) ? row.sampleName : row.note;
  const isActive = hasStepAt(beatIndex, note);
  const stepData = getStepData(beatIndex, note);

  // Drag state for gate and velocity editing
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStartPos, setDragStartPos] = React.useState({ x: 0, y: 0 });
  const [dragStartValue, setDragStartValue] = React.useState(0);

  // Cell styling based on edit mode
  const getCellClasses = useCallback(() => {
    const baseClasses = `w-full h-full btn btn-sm p-0 border border-white/20 transition-all duration-75 relative overflow-hidden cursor-pointer`;

    if (isActive && stepData) {
      if (editMode === "gate") {
        return `${baseClasses} bg-success/20 border-success text-success-content hover:bg-success/30 active:bg-success/40`;
      } else if (editMode === "velocity") {
        return `${baseClasses} bg-warning/20 border-warning text-warning-content hover:bg-warning/30 active:bg-warning/40`;
      } else {
        if (isDrumRow(row)) {
          return `${baseClasses} btn-accent border-accent-focus text-accent-content`;
        } else if (isNoteRow(row) && !row.inScale) {
          return `${baseClasses} btn-warning border-warning-focus text-warning-content opacity-75`;
        } else {
          return `${baseClasses} btn-accent border-accent-focus text-accent-content`;
        }
      }
    }

    const beatStyle = (beatIndex + 1) % 4 === 1 ? "border-base-300" : "border-base-200";

    if (isNoteRow(row) && !row.inScale) {
      return `${baseClasses} btn-ghost ${beatStyle} opacity-50 hover:opacity-75`;
    }

    return `${baseClasses} btn-ghost ${beatStyle} hover:btn-outline`;
  }, [isActive, stepData, editMode, row, beatIndex]);

  // Cell content based on edit mode
  const getCellContent = useCallback(() => {
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
        const gateWidth = Math.max(10, stepData.gate * 100);
        return (
          <div
            className="absolute left-0 top-0 h-full bg-accent opacity-80 rounded-r-sm"
            style={{ width: `${gateWidth}%` }}
            title={`Gate: ${Math.round(stepData.gate * 100)}%`}
          />
        );
      }

      case "velocity": {
        const velocityHeight = Math.max(10, stepData.velocity * 100);
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
  }, [isActive, stepData, editMode, isRecording]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (editMode === "note") {
        onStepToggle(beatIndex, note);
        return;
      }

      e.preventDefault();
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
    [editMode, stepData, beatIndex, note, onStepToggle]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!isDragging || editMode === "note") return;

      e.preventDefault();

      const deltaX = e.clientX - dragStartPos.x;
      const deltaY = dragStartPos.y - e.clientY;

      let rawValue: number;

      if (editMode === "gate") {
        const sensitivity = 100;
        rawValue = dragStartValue + deltaX / sensitivity;
      } else if (editMode === "velocity") {
        const sensitivity = 80;
        rawValue = dragStartValue + deltaY / sensitivity;
      } else {
        return;
      }

      const minValue =
        editMode === "gate"
          ? SEQUENCER_CONSTANTS.MIN_GATE
          : SEQUENCER_CONSTANTS.MIN_VELOCITY;
      const clampedValue = Math.max(minValue, Math.min(1.0, rawValue));

      const steps =
        editMode === "gate"
          ? SEQUENCER_CONSTANTS.GATE_STEPS
          : SEQUENCER_CONSTANTS.VELOCITY_STEPS;
      const stepSize = (1.0 - minValue) / (steps - 1);
      const stepIndex = Math.round((clampedValue - minValue) / stepSize);
      const steppedValue = minValue + stepIndex * stepSize;

      if (!stepData) return;

      const updates =
        editMode === "gate"
          ? { gate: steppedValue }
          : { velocity: steppedValue };

      onUpdateStep(beatIndex, note, updates);
    },
    [
      isDragging,
      dragStartPos,
      dragStartValue,
      editMode,
      stepData,
      onUpdateStep,
      beatIndex,
      note,
    ]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <button
      className={getCellClasses()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        touchAction: editMode === "note" ? "auto" : "none",
        width: gridConstants.noteCellSize,
        height: gridConstants.noteCellSize,
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
      title={`Beat ${beatIndex + 1}: ${isDrumRow(row) ? row.displayName : note}${isActive ? " (Active)" : ""}`}
      aria-label={`Step ${beatIndex + 1} for ${isDrumRow(row) ? row.displayName : note}`}
      aria-pressed={isActive}
    >
      {getCellContent()}
    </button>
  );
});

StepCell.displayName = "StepCell";

// Individual cell component for react-window
const VirtualizedCell = memo(({ 
  columnIndex, 
  rowIndex, 
  style, 
  data 
}: {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: CellData;
}) => {
  const {
    rows,
    sequenceLength,
    isRecording,
    editMode,
    onStepToggle,
    onBeatSelect,
    onCurrentBeatChange,
    hasStepAt,
    getStepData,
    onPlayNotes,
    onStopNotes,
    onUpdateStep,
    gridConstants,
  } = data;

  // Handle different cell types based on position
  const isHeaderRow = rowIndex === 0;
  const isLabelColumn = columnIndex === 0;
  
  // Beat header cell (top row, except first column)
  if (isHeaderRow && !isLabelColumn) {
    const beatIndex = columnIndex - 1; // Adjust for label column
    if (beatIndex >= sequenceLength) return null;

    return (
      <div style={style}>
        <BeatHeaderCell 
          beatIndex={beatIndex}
          onBeatSelect={onBeatSelect}
          onCurrentBeatChange={onCurrentBeatChange}
        />
      </div>
    );
  }

  // Row label cell (first column, except first row)
  if (isLabelColumn && !isHeaderRow) {
    const actualRowIndex = rowIndex - 1; // Adjust for header row
    const row = rows[actualRowIndex];
    if (!row) return null;

    return (
      <div style={style}>
        <RowLabelCell 
          row={row}
          onPlayNotes={onPlayNotes}
          onStopNotes={onStopNotes}
        />
      </div>
    );
  }

  // Top-left corner cell (empty)
  if (isHeaderRow && isLabelColumn) {
    return <div style={style} />;
  }

  // Step cell (main grid area)
  const actualRowIndex = rowIndex - 1; // Adjust for header row
  const beatIndex = columnIndex - 1; // Adjust for label column
  const row = rows[actualRowIndex];
  
  if (!row || beatIndex >= sequenceLength) return null;

  return (
    <div style={style}>
      <StepCell
        row={row}
        beatIndex={beatIndex}
        isRecording={isRecording}
        editMode={editMode}
        hasStepAt={hasStepAt}
        getStepData={getStepData}
        onStepToggle={onStepToggle}
        onUpdateStep={onUpdateStep}
        gridConstants={gridConstants}
      />
    </div>
  );
});

VirtualizedCell.displayName = "VirtualizedCell";

export const VirtualizedStepGrid = memo(
  ({
    rows,
    currentBeat,
    sequenceLength,
    isRecording,
    editMode,
    onStepToggle,
    onBeatSelect,
    onCurrentBeatChange,
    hasStepAt,
    getStepData,
    onPlayNotes,
    onStopNotes,
    onUpdateStep,
  }: VirtualizedStepGridProps) => {
    const gridRef = useRef<Grid>(null);
    const lastBeatRef = useRef<number>(currentBeat);
    const userScrolledRef = useRef<boolean>(false);
    const [scrollLeft, setScrollLeft] = React.useState(0);

    // Grid dimensions
    const gridConstants = useMemo(() => ({
      gridCellSize: SEQUENCER_CONSTANTS.GRID.GRID_CELL_SIZE,
      noteCellSize: SEQUENCER_CONSTANTS.GRID.NOTE_CELL_SIZE,
      cellGap: SEQUENCER_CONSTANTS.GRID.CELL_GAP,
      labelWidth: SEQUENCER_CONSTANTS.GRID.LABEL_WIDTH,
      beatHeaderHeight: SEQUENCER_CONSTANTS.GRID.BEAT_HEADER_HEIGHT,
    }), []);

    // Total columns = label column + beat columns
    const columnCount = sequenceLength + 1;
    // Total rows = header row + data rows
    const rowCount = rows.length + 1;

    // Grid dimensions
    const gridWidth = Math.min(
      1400, // Max width for desktop
      gridConstants.labelWidth + (sequenceLength * (gridConstants.gridCellSize + gridConstants.cellGap))
    );
    const gridHeight = Math.min(
      400, // Max height for mobile
      gridConstants.beatHeaderHeight + (rows.length * (gridConstants.gridCellSize + gridConstants.cellGap))
    );

    // Column width function - first column is wider for labels
    const getColumnWidth = useCallback((index: number) => {
      return index === 0 ? gridConstants.labelWidth : gridConstants.gridCellSize + gridConstants.cellGap;
    }, [gridConstants]);

    // Row height function - first row is header height
    const getRowHeight = useCallback((index: number) => {
      return index === 0 ? gridConstants.beatHeaderHeight : gridConstants.gridCellSize + gridConstants.cellGap;
    }, [gridConstants]);

    // Cell data for react-window
    const cellData: CellData = useMemo(() => ({
      rows,
      sequenceLength,
      isRecording,
      editMode,
      onStepToggle,
      onBeatSelect,
      onCurrentBeatChange,
      hasStepAt,
      getStepData,
      onPlayNotes,
      onStopNotes,
      onUpdateStep,
      gridConstants,
    }), [
      rows,
      sequenceLength,
      isRecording,
      editMode,
      onStepToggle,
      onBeatSelect,
      onCurrentBeatChange,
      hasStepAt,
      getStepData,
      onPlayNotes,
      onStopNotes,
      onUpdateStep,
      gridConstants,
    ]);

    // Scroll to current beat when it changes, but be smart about it
    useEffect(() => {
      if (!gridRef.current) return;

      const lastBeat = lastBeatRef.current;
      const beatDifference = Math.abs(currentBeat - lastBeat);
      
      // Only auto-scroll if:
      // 1. It's a significant jump (user clicked a beat or seeking)
      // 2. The beat moved forward by more than a few beats (not just normal playback)
      // 3. We're at the beginning and moved significantly forward (start of playback)
      const isSignificantJump = beatDifference > 4;
      const isManualSeek = beatDifference > 1 && !isRecording; // Large jumps when not recording
      const isStartOfPlayback = lastBeat === 0 && currentBeat > 0;
      
      // Don't auto-scroll for normal playback progression or loop-back to 0
      const shouldScroll = isSignificantJump || isManualSeek || isStartOfPlayback;
      
      if (shouldScroll && !userScrolledRef.current) {
        gridRef.current.scrollToItem({
          columnIndex: currentBeat + 1, // +1 for label column
          rowIndex: 0,
          align: "auto", // Use "auto" instead of "center" for less jarring movement
        });
      }
      
      // Update the last beat reference
      lastBeatRef.current = currentBeat;
      
      // Reset user scroll flag after a short delay
      if (userScrolledRef.current) {
        const timeout = setTimeout(() => {
          userScrolledRef.current = false;
        }, 1000);
        return () => clearTimeout(timeout);
      }
    }, [currentBeat, isRecording]);

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
            width: gridConstants.gridCellSize + gridConstants.cellGap,
            height: gridConstants.beatHeaderHeight + (rows.length * (gridConstants.gridCellSize + gridConstants.cellGap)),
            transform: `translateX(${
              gridConstants.labelWidth + 
              (currentBeat * (gridConstants.gridCellSize + gridConstants.cellGap)) -
              scrollLeft
            }px)`,
          }}
        />

        {/* Virtualized Grid */}
        <Grid
          ref={gridRef}
          columnCount={columnCount}
          rowCount={rowCount}
          columnWidth={getColumnWidth}
          rowHeight={getRowHeight}
          width={gridWidth}
          height={gridHeight}
          itemData={cellData}
          overscanColumnCount={2}
          overscanRowCount={3}
          onScroll={({ scrollLeft: newScrollLeft }) => {
            // Mark that user has manually scrolled
            userScrolledRef.current = true;
            // Track scroll position for playhead positioning
            setScrollLeft(newScrollLeft);
          }}
        >
          {VirtualizedCell}
        </Grid>

        {/* Mobile scroll hint */}
        <div className="md:hidden mt-2 text-xs text-base-content/50 text-center">
          Swipe horizontally to scroll beats
        </div>
      </div>
    );
  }
);

VirtualizedStepGrid.displayName = "VirtualizedStepGrid"; 