import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { SEQUENCER_CONSTANTS } from '@/shared/constants';
import { getGridDimensions } from './constants';
import { StepSequencerCanvas } from './StepSequencerCanvas';
import { BeatHeaderCell } from './dom-overlay/BeatHeaderCell';
import { RowLabelCell } from './dom-overlay/RowLabelCell';
import type { SequencerRow, SequencerStep, EditMode } from '../../types';

interface KonvaStepGridProps {
  rows: SequencerRow[];
  currentBeat: number;
  sequenceLength: number;
  isRecording: boolean;
  editMode: EditMode;
  rootNote?: string;
  selectMode?: boolean;
  selectedSteps?: Set<string>;
  onSelectionChange?: (selection: Set<string>) => void;
  onStepToggle: (beat: number, note: string) => void;
  onBeatSelect: (beat: number) => void;
  onCurrentBeatChange: (beat: number) => void;
  hasStepAt: (beat: number, note: string) => boolean;
  getStepData: (beat: number, note: string) => SequencerStep | null;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onUpdateStep: (beat: number, note: string, updates: Partial<SequencerStep>) => void;
}

export const KonvaStepGrid = memo(({
  rows,
  currentBeat,
  sequenceLength,
  isRecording,
  editMode,
  rootNote,
  selectMode = false,
  selectedSteps = new Set(),
  onSelectionChange,
  onStepToggle,
  onBeatSelect,
  onCurrentBeatChange,
  hasStepAt,
  getStepData,
  onPlayNotes,
  onStopNotes,
  onUpdateStep,
}: KonvaStepGridProps) => {
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const labelScrollRef = useRef<HTMLDivElement>(null);
  const lastBeatRef = useRef<number>(currentBeat);
  const userScrolledRef = useRef<boolean>(false);
  
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [viewportHeight, setViewportHeight] = useState(300);
  
  // Grid constants
  const gridConstants = useMemo(() => ({
    gridCellSize: SEQUENCER_CONSTANTS.GRID.GRID_CELL_SIZE,
    noteCellSize: SEQUENCER_CONSTANTS.GRID.NOTE_CELL_SIZE,
    cellGap: SEQUENCER_CONSTANTS.GRID.CELL_GAP,
    labelWidth: SEQUENCER_CONSTANTS.GRID.LABEL_WIDTH,
    beatHeaderHeight: SEQUENCER_CONSTANTS.GRID.BEAT_HEADER_HEIGHT,
  }), []);
  
  // Calculate dimensions
  const { width: canvasWidth, height: canvasHeight } = useMemo(
    () => getGridDimensions(sequenceLength, rows.length),
    [sequenceLength, rows.length]
  );
  
  // Max dimensions for the container
  // Width: limit to 1400px max for large screens, but allow full width for smaller
  const containerWidth = gridConstants.labelWidth + canvasWidth;
  const maxWidth = Math.min(1400, containerWidth);
  
  // Height: use actual content height, capped at 300px for scroll
  const maxContainerHeight = 300 - gridConstants.beatHeaderHeight;
  const maxHeight = Math.min(maxContainerHeight, canvasHeight);
  
  // Calculate actual scrollable content width (for the canvas area, excluding labels)
  const scrollableWidth = maxWidth - gridConstants.labelWidth;
  
  // Handle scroll synchronization
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newScrollLeft = target.scrollLeft;
    // Clamp scroll to not exceed content bounds
    const maxScrollTop = Math.max(0, canvasHeight - maxHeight);
    const newScrollTop = Math.min(target.scrollTop, maxScrollTop);
    
    userScrolledRef.current = true;
    setScrollLeft(newScrollLeft);
    setScrollTop(newScrollTop);
    
    // Sync header scroll
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = newScrollLeft;
    }
    
    // Sync label scroll using transform instead of scrollTop for overflow-hidden
    if (labelScrollRef.current) {
      const labelContent = labelScrollRef.current.firstChild as HTMLElement;
      if (labelContent) {
        labelContent.style.transform = `translateY(-${newScrollTop}px)`;
      }
    }
  }, [canvasHeight, maxHeight]);
  
  // Update viewport dimensions on mount, resize, and when container size changes
  useEffect(() => {
    const updateViewport = () => {
      if (canvasScrollRef.current) {
        setViewportWidth(canvasScrollRef.current.clientWidth);
        setViewportHeight(canvasScrollRef.current.clientHeight);
      }
    };
    
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [scrollableWidth, maxHeight]); // Re-run when container dimensions change
  
  // Auto-scroll to current beat on significant jumps
  useEffect(() => {
    if (!canvasScrollRef.current) return;
    
    const lastBeat = lastBeatRef.current;
    const beatDifference = Math.abs(currentBeat - lastBeat);
    
    const isSignificantJump = beatDifference > 4;
    const isManualSeek = beatDifference > 1 && !isRecording;
    const isStartOfPlayback = lastBeat === 0 && currentBeat > 0;
    
    const shouldScroll = isSignificantJump || isManualSeek || isStartOfPlayback;
    
    if (shouldScroll && !userScrolledRef.current) {
      const cellWidth = gridConstants.gridCellSize + gridConstants.cellGap;
      const targetScrollLeft = currentBeat * cellWidth - viewportWidth / 2 + cellWidth / 2;
      canvasScrollRef.current.scrollLeft = Math.max(0, targetScrollLeft);
    }
    
    lastBeatRef.current = currentBeat;
    
    if (userScrolledRef.current) {
      const timeout = setTimeout(() => {
        userScrolledRef.current = false;
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [currentBeat, isRecording, gridConstants, viewportWidth]);
  
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
        <div className="flex" style={{ width: maxWidth }}>
          {/* Empty corner cell */}
          <div
            className="flex-shrink-0 border-r border-base-200 bg-neutral z-10 sticky left-0"
            style={{
              width: gridConstants.labelWidth,
              height: gridConstants.beatHeaderHeight,
              boxShadow: '2px 0 4px rgba(0, 0, 0, 0.1)'
            }}
          />
          
          {/* Beat header cells - scrollable */}
          <div
            ref={headerScrollRef}
            className="flex overflow-hidden"
            style={{ width: maxWidth - gridConstants.labelWidth }}
          >
            <div className="flex" style={{ width: canvasWidth }}>
              {Array.from({ length: sequenceLength }, (_, beatIndex) => (
                <div
                  key={beatIndex}
                  style={{
                    width: gridConstants.gridCellSize + gridConstants.cellGap,
                    height: gridConstants.beatHeaderHeight,
                    flexShrink: 0,
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
      </div>
      
      {/* Main content area */}
      <div className="flex" style={{ height: maxHeight }}>
        {/* Row labels - fixed left, synced with canvas scroll */}
        <div
          ref={labelScrollRef}
          className="flex-shrink-0 overflow-hidden border-r border-base-200 bg-neutral z-10 sticky left-0"
          style={{ 
            width: gridConstants.labelWidth, 
            height: maxHeight,
            boxShadow: '2px 0 4px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ height: canvasHeight, willChange: 'transform' }}>
            {rows.map((row, index) => (
              <div
                key={index}
                style={{
                  height: gridConstants.gridCellSize + gridConstants.cellGap,
                }}
              >
                <RowLabelCell
                  row={row}
                  rootNote={rootNote}
                  onPlayNotes={onPlayNotes}
                  onStopNotes={onStopNotes}
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Canvas area - scrollable both directions */}
        <div
          ref={canvasScrollRef}
          className="overflow-auto"
          style={{ 
            width: scrollableWidth,
            height: maxHeight,
            // Prevent scroll beyond content
            overflowY: canvasHeight <= maxHeight ? 'hidden' : 'auto',
          }}
          onScroll={handleScroll}
        >
          {/* Wrapper div to constrain scroll area to exact content size */}
          <div style={{ width: canvasWidth, height: canvasHeight, overflow: 'hidden' }}>
            <StepSequencerCanvas
              rows={rows}
              sequenceLength={sequenceLength}
              currentBeat={currentBeat}
              isRecording={isRecording}
              editMode={editMode}
              rootNote={rootNote}
              selectMode={selectMode}
              selectedSteps={selectedSteps}
              onSelectionChange={onSelectionChange}
              scrollLeft={scrollLeft}
              scrollTop={scrollTop}
              viewportWidth={viewportWidth}
              viewportHeight={viewportHeight}
              hasStepAt={hasStepAt}
              getStepData={getStepData}
              onStepToggle={onStepToggle}
              onUpdateStep={onUpdateStep}
            />
          </div>
        </div>
      </div>
      
      {/* Mobile scroll hint */}
      <div className="md:hidden mt-2 text-xs text-base-content/50 text-center">
        Swipe to scroll beats
      </div>
    </div>
  );
});

KonvaStepGrid.displayName = 'KonvaStepGrid';
