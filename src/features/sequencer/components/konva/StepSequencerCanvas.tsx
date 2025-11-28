import { memo, useMemo, useRef, useCallback } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { KONVA_GRID, getGridDimensions } from './constants';
import { GridBackground } from './GridBackground';
import { StepNote } from './StepNote';
import { PlayheadIndicator } from './PlayheadIndicator';
import { useStepInteraction } from './useStepInteraction';
import type { SequencerRow, SequencerStep, EditMode, DrumRow, NoteRow } from '../../types';

interface StepSequencerCanvasProps {
  rows: SequencerRow[];
  sequenceLength: number;
  currentBeat: number;
  isRecording: boolean;
  editMode: EditMode;
  rootNote?: string;
  selectMode?: boolean;
  selectedSteps?: Set<string>;
  onSelectionChange?: (selection: Set<string>) => void;
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  hasStepAt: (beat: number, note: string) => boolean;
  getStepData: (beat: number, note: string) => SequencerStep | null;
  onStepToggle: (beat: number, note: string) => void;
  onUpdateStep: (beat: number, note: string, updates: Partial<SequencerStep>) => void;
}

// Type guards
const isDrumRow = (row: SequencerRow): row is DrumRow => {
  return 'sampleName' in row;
};

const isNoteRow = (row: SequencerRow): row is NoteRow => {
  return 'note' in row && 'inScale' in row;
};

export const StepSequencerCanvas = memo(({
  rows,
  sequenceLength,
  currentBeat,
  isRecording,
  editMode,
  rootNote,
  selectMode = false,
  selectedSteps = new Set(),
  onSelectionChange,
  scrollLeft,
  scrollTop,
  viewportWidth,
  viewportHeight,
  hasStepAt,
  getStepData,
  onStepToggle,
  onUpdateStep,
}: StepSequencerCanvasProps) => {
  const stageRef = useRef<any>(null);
  
  // Calculate grid dimensions
  const { width: fullWidth, height: fullHeight } = useMemo(
    () => getGridDimensions(sequenceLength, rows.length),
    [sequenceLength, rows.length]
  );
  
  // Buffer for viewport culling
  const buffer = 50;
  
  // Use actual viewport or fallback to full dimensions if viewport not yet measured
  const effectiveViewportWidth = viewportWidth > 0 ? viewportWidth : fullWidth;
  const effectiveViewportHeight = viewportHeight > 0 ? viewportHeight : fullHeight;
  
  // Calculate stage offset - where to position the stage
  const stageOffsetX = Math.max(0, scrollLeft - buffer);
  const stageOffsetY = Math.max(0, scrollTop - buffer);
  
  // Stage dimensions - render visible area plus buffer, but cap at content bounds
  // Ensure we don't render past the actual content
  const stageWidth = Math.min(fullWidth - stageOffsetX, effectiveViewportWidth + buffer * 2);
  const stageHeight = Math.min(fullHeight - stageOffsetY, effectiveViewportHeight + buffer * 2);
  
  // Calculate visible range for culling - ensure we render at least all visible content
  const cellSize = KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP;
  const visibleStartBeat = Math.max(0, Math.floor((scrollLeft - buffer) / cellSize));
  // Ensure we render up to the edge of the visible area + buffer
  const visibleEndBeat = Math.min(
    sequenceLength - 1, 
    Math.ceil((scrollLeft + effectiveViewportWidth + buffer) / cellSize)
  );
  const visibleStartRow = Math.max(0, Math.floor((scrollTop - buffer) / cellSize));
  const visibleEndRow = Math.min(
    rows.length - 1, 
    Math.ceil((scrollTop + effectiveViewportHeight + buffer) / cellSize)
  );
  
  // Collect all active steps in visible range
  const visibleSteps = useMemo(() => {
    const steps: Array<{
      step: SequencerStep;
      row: SequencerRow;
      rowIndex: number;
      beatIndex: number;
    }> = [];
    
    for (let rowIndex = visibleStartRow; rowIndex <= visibleEndRow && rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row) continue;
      
      const note = isDrumRow(row) ? row.sampleName : isNoteRow(row) ? row.note : null;
      if (!note) continue;
      
      for (let beatIndex = visibleStartBeat; beatIndex <= visibleEndBeat && beatIndex < sequenceLength; beatIndex++) {
        if (hasStepAt(beatIndex, note)) {
          const stepData = getStepData(beatIndex, note);
          if (stepData) {
            steps.push({
              step: stepData,
              row,
              rowIndex,
              beatIndex,
            });
          }
        }
      }
    }
    
    return steps;
  }, [rows, sequenceLength, visibleStartBeat, visibleEndBeat, visibleStartRow, visibleEndRow, hasStepAt, getStepData]);
  
  // Step interaction hook
  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    marqueeState,
    isInteractionActive,
  } = useStepInteraction({
    rows,
    sequenceLength,
    editMode,
    selectMode,
    selectedSteps,
    onSelectionChange,
    getStepData,
    onStepToggle,
    onUpdateStep,
    scrollOffset: { x: stageOffsetX, y: stageOffsetY },
  });
  
  // Helper to get step key for selection check
  const getStepKey = useCallback((beatIndex: number, note: string) => {
    return `${beatIndex}-${note}`;
  }, []);
  
  // Wrap handlers to work with Konva events
  const onPointerDown = useCallback((e: KonvaEventObject<PointerEvent>) => {
    handlePointerDown(e);
  }, [handlePointerDown]);
  
  const onPointerMove = useCallback((e: KonvaEventObject<PointerEvent>) => {
    handlePointerMove(e);
  }, [handlePointerMove]);
  
  const onPointerUp = useCallback(() => {
    handlePointerUp();
  }, [handlePointerUp]);
  
  const onTouchStart = useCallback((e: KonvaEventObject<TouchEvent>) => {
    handlePointerDown(e as unknown as KonvaEventObject<PointerEvent>);
  }, [handlePointerDown]);
  
  const onTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    // Prevent scrolling when marquee or paint is active
    if (marqueeState || isInteractionActive) {
      e.evt.preventDefault();
    }
    handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>);
  }, [handlePointerMove, marqueeState, isInteractionActive]);
  
  const onTouchEnd = useCallback(() => {
    handlePointerUp();
  }, [handlePointerUp]);
  
  return (
    <div 
      style={{ 
        position: 'relative', 
        width: fullWidth, 
        height: fullHeight,
        minHeight: fullHeight, // Ensure exact height
        maxHeight: fullHeight, // Prevent extra space
        // Disable touch scrolling when marquee or paint is active
        touchAction: marqueeState || isInteractionActive ? 'none' : 'pan-x pan-y',
        overflow: 'hidden', // Prevent any overflow
      }}
    >
      <div 
        style={{ 
          position: 'absolute', 
          left: stageOffsetX, 
          top: stageOffsetY,
          // Disable touch scrolling in gate/velocity edit mode, or when interaction (marquee/paint) is active
          touchAction: (editMode !== 'note' && !selectMode) || marqueeState || isInteractionActive ? 'none' : 'pan-x pan-y',
        }}
      >
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          perfectDrawEnabled={false}
        >
          {/* Background Layer: Grid cells */}
          <Layer x={-stageOffsetX} y={-stageOffsetY} listening={false}>
            <GridBackground
              rows={rows}
              sequenceLength={sequenceLength}
              visibleStartBeat={visibleStartBeat}
              visibleEndBeat={visibleEndBeat}
              visibleStartRow={visibleStartRow}
              visibleEndRow={visibleEndRow}
              rootNote={rootNote}
            />
          </Layer>
          
          {/* Notes Layer: Active steps */}
          <Layer x={-stageOffsetX} y={-stageOffsetY}>
            {visibleSteps.map(({ step, row, rowIndex, beatIndex }) => {
              const note = 'sampleName' in row ? row.sampleName : 'note' in row ? row.note : '';
              const isSelected = selectedSteps.has(getStepKey(beatIndex, note));
              return (
                <StepNote
                  key={`step-${beatIndex}-${rowIndex}`}
                  step={step}
                  row={row}
                  rowIndex={rowIndex}
                  beatIndex={beatIndex}
                  editMode={editMode}
                  isRecording={isRecording}
                  isSelected={isSelected}
                  rootNote={rootNote}
                />
              );
            })}
            {/* Marquee Selection */}
            {marqueeState && (
              <Rect
                x={Math.min(marqueeState.startX, marqueeState.currentX)}
                y={Math.min(marqueeState.startY, marqueeState.currentY)}
                width={Math.abs(marqueeState.currentX - marqueeState.startX)}
                height={Math.abs(marqueeState.currentY - marqueeState.startY)}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            )}
          </Layer>
          
          {/* Playhead Layer */}
          <PlayheadIndicator
            currentBeat={currentBeat}
            height={fullHeight}
            isRecording={isRecording}
            layerOffset={stageOffsetX}
          />
        </Stage>
      </div>
    </div>
  );
});

StepSequencerCanvas.displayName = 'StepSequencerCanvas';
