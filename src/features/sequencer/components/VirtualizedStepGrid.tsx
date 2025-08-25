import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { VariableSizeGrid as Grid } from "react-window";
import { BeatHeaderCell, RowLabelCell, StepCell } from "./grid";
import type {
  SequencerRow,
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
  rootNote?: string;
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
  rootNote?: string;
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
  gridConstants: {
    gridCellSize: number;
    noteCellSize: number;
    cellGap: number;
    labelWidth: number;
    beatHeaderHeight: number;
  };
}



// Individual cell component for react-window
const VirtualizedCell = memo(
  ({
    columnIndex,
    rowIndex,
    style,
    data,
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
      rootNote,
      onStepToggle,
      hasStepAt,
      getStepData,
      onPlayNotes,
      onStopNotes,
      onUpdateStep,
      gridConstants,
    } = data;

    const isLabelColumn = columnIndex === 0;

    // Row label cell (first column)
    if (isLabelColumn) {
      const row = rows[rowIndex];
      if (!row) return null;

      return (
        <div style={style}>
          <RowLabelCell
            row={row}
            rootNote={rootNote}
            onPlayNotes={onPlayNotes}
            onStopNotes={onStopNotes}
          />
        </div>
      );
    }

    // Step cell (main grid area)
    const beatIndex = columnIndex - 1; // Adjust for label column
    const row = rows[rowIndex];

    if (!row || beatIndex >= sequenceLength) return null;

    return (
      <div style={style}>
        <StepCell
          row={row}
          beatIndex={beatIndex}
          isRecording={isRecording}
          editMode={editMode}
          rootNote={rootNote}
          hasStepAt={hasStepAt}
          getStepData={getStepData}
          onStepToggle={onStepToggle}
          onUpdateStep={onUpdateStep}
          gridConstants={gridConstants}
        />
      </div>
    );
  }
);

VirtualizedCell.displayName = "VirtualizedCell";

export const VirtualizedStepGrid = memo(
  ({
    rows,
    currentBeat,
    sequenceLength,
    isRecording,
    editMode,
    rootNote,
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
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const lastBeatRef = useRef<number>(currentBeat);
    const userScrolledRef = useRef<boolean>(false);
    const [scrollLeft, setScrollLeft] = React.useState(0);

    // Grid dimensions
    const gridConstants = useMemo(
      () => ({
        gridCellSize: SEQUENCER_CONSTANTS.GRID.GRID_CELL_SIZE,
        noteCellSize: SEQUENCER_CONSTANTS.GRID.NOTE_CELL_SIZE,
        cellGap: SEQUENCER_CONSTANTS.GRID.CELL_GAP,
        labelWidth: SEQUENCER_CONSTANTS.GRID.LABEL_WIDTH,
        beatHeaderHeight: SEQUENCER_CONSTANTS.GRID.BEAT_HEADER_HEIGHT,
      }),
      []
    );

    // Total columns = label column + beat columns (no header row in virtualized grid now)
    const columnCount = sequenceLength + 1;
    // Total rows = only data rows (header is separate now)
    const rowCount = rows.length;

    // Grid dimensions
    const gridWidth = Math.min(
      1400, // Max width for desktop
      gridConstants.labelWidth +
        sequenceLength * (gridConstants.gridCellSize + gridConstants.cellGap)
    );
    const gridHeight = Math.min(
      300 - gridConstants.beatHeaderHeight, // Subtract header height
      rows.length * (gridConstants.gridCellSize + gridConstants.cellGap)
    );

    // Column width function - first column is wider for labels
    const getColumnWidth = useCallback(
      (index: number) => {
        return index === 0
          ? gridConstants.labelWidth
          : gridConstants.gridCellSize + gridConstants.cellGap;
      },
      [gridConstants]
    );

    // Row height function - all rows are the same height now
    const getRowHeight = useCallback(() => {
      return gridConstants.gridCellSize + gridConstants.cellGap;
    }, [gridConstants]);

    // Cell data for react-window (updated to not include header row)
    const cellData: CellData = useMemo(
      () => ({
        rows,
        sequenceLength,
        isRecording,
        editMode,
        rootNote,
        onStepToggle,
        onBeatSelect,
        onCurrentBeatChange,
        hasStepAt,
        getStepData,
        onPlayNotes,
        onStopNotes,
        onUpdateStep,
        gridConstants,
      }),
      [
        rows,
        sequenceLength,
        isRecording,
        editMode,
        rootNote,
        onStepToggle,
        onBeatSelect,
        onCurrentBeatChange,
        hasStepAt,
        getStepData,
        onPlayNotes,
        onStopNotes,
        onUpdateStep,
        gridConstants,
      ]
    );

    // Sync header scroll with grid scroll
    const handleGridScroll = useCallback(
      ({ scrollLeft: newScrollLeft }: { scrollLeft: number }) => {
        // Mark that user has manually scrolled
        userScrolledRef.current = true;
        // Track scroll position for playhead positioning
        setScrollLeft(newScrollLeft);

        // Sync header scroll
        if (headerScrollRef.current) {
          headerScrollRef.current.scrollLeft = newScrollLeft;
        }
      },
      []
    );

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
      const shouldScroll =
        isSignificantJump || isManualSeek || isStartOfPlayback;

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
        {/* Sticky Header Row */}
        <div className="sticky top-0 z-20 bg-neutral border-b border-base-200">
          <div
            ref={headerScrollRef}
            className="flex overflow-x-hidden"
            style={{ width: gridWidth }}
          >
            {/* Empty corner cell */}
            <div
              className="flex-shrink-0 border-r border-base-200"
              style={{
                width: gridConstants.labelWidth,
                height: gridConstants.beatHeaderHeight,
              }}
            />

            {/* Beat header cells */}
            <div className="flex">
              {Array.from({ length: sequenceLength }, (_, beatIndex) => (
                <div
                  key={beatIndex}
                  style={{
                    width: gridConstants.gridCellSize + gridConstants.cellGap,
                    height: gridConstants.beatHeaderHeight,
                  }}
                >
                  <BeatHeaderCell
                    beatIndex={beatIndex}
                    onBeatSelect={onBeatSelect}
                    onCurrentBeatChange={onCurrentBeatChange}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Playhead Overlay - adjusted for sticky header */}
        <div
          className={`absolute pointer-events-none z-50 rounded-sm ${
            isRecording
              ? "border-2 border-error shadow-lg animate-pulse"
              : "border-2 border-primary shadow-md"
          }`}
          style={{
            width: gridConstants.gridCellSize + gridConstants.cellGap,
            height: gridConstants.beatHeaderHeight + gridHeight,
            top: 0,
            left: 0,
            transform: `translateX(${
              gridConstants.labelWidth +
              currentBeat *
                (gridConstants.gridCellSize + gridConstants.cellGap) -
              scrollLeft
            }px)`,
          }}
        />

        {/* Virtualized Grid - only data rows now */}
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
          onScroll={handleGridScroll}
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
