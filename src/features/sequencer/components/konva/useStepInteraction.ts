import { useCallback, useRef, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { KONVA_GRID, INTERACTION } from './constants';
import type { SequencerStep, SequencerRow, EditMode } from '../../types';

interface DragState {
  isDragging: boolean;
  startPos: { x: number; y: number };
  startValue: number;
  beatIndex: number;
  rowIndex: number;
  note: string;
}

interface TouchState {
  startPos: { x: number; y: number };
  startTime: number;
  hasMoved: boolean;
  targetCell: { beatIndex: number; rowIndex: number; note: string } | null;
}

// Paint mode for drag drawing/erasing
type PaintMode = 'draw' | 'erase' | null;

interface PaintState {
  mode: PaintMode;
  visitedCells: Set<string>; // Track visited cells to avoid duplicate toggles
}

// Marquee selection state
export interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface UseStepInteractionProps {
  rows: SequencerRow[];
  sequenceLength: number;
  editMode: EditMode;
  selectMode?: boolean;
  selectedSteps?: Set<string>;
  onSelectionChange?: (selection: Set<string>) => void;
  getStepData: (beat: number, note: string) => SequencerStep | null;
  onStepToggle: (beat: number, note: string) => void;
  onUpdateStep: (beat: number, note: string, updates: Partial<SequencerStep>) => void;
  scrollOffset: { x: number; y: number };
}

// Type guards
const isDrumRow = (row: SequencerRow): row is { sampleName: string; displayName: string; visible: boolean } => {
  return 'sampleName' in row;
};

const isNoteRow = (row: SequencerRow): row is { note: string; octave: number; displayName: string; inScale: boolean; visible: boolean } => {
  return 'note' in row && 'inScale' in row;
};

export const useStepInteraction = ({
  rows,
  sequenceLength,
  editMode,
  selectMode = false,
  selectedSteps = new Set(),
  onSelectionChange,
  getStepData,
  onStepToggle,
  onUpdateStep,
  scrollOffset,
}: UseStepInteractionProps) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  // Track if a long-press interaction (paint or marquee) is active to disable scrolling
  const [isInteractionActive, setIsInteractionActive] = useState(false);
  
  const touchStateRef = useRef<TouchState | null>(null);
  const paintStateRef = useRef<PaintState | null>(null);
  const shiftKeyRef = useRef<boolean>(false);
  const isTouchInteractionRef = useRef<boolean>(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const lastTapRef = useRef<{ time: number; cellKey: string } | null>(null);
  
  // Helper to create cell key for tracking
  const getCellKey = useCallback((beatIndex: number, note: string) => {
    return `${beatIndex}-${note}`;
  }, []);
  
  // Check if a cell has a step
  const hasStepAt = useCallback((beatIndex: number, note: string) => {
    return getStepData(beatIndex, note) !== null;
  }, [getStepData]);
  
  // Convert pointer position to grid cell
  const pointerToCell = useCallback((clientX: number, clientY: number, stageX: number, stageY: number) => {
    const x = clientX - stageX + scrollOffset.x;
    const y = clientY - stageY + scrollOffset.y;
    
    const cellWidth = KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP;
    const cellHeight = KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP;
    
    const beatIndex = Math.floor(x / cellWidth);
    const rowIndex = Math.floor(y / cellHeight);
    
    if (beatIndex < 0 || beatIndex >= sequenceLength || rowIndex < 0 || rowIndex >= rows.length) {
      return null;
    }
    
    const row = rows[rowIndex];
    const note = isDrumRow(row) ? row.sampleName : isNoteRow(row) ? row.note : null;
    
    if (!note) return null;
    
    return { beatIndex, rowIndex, note };
  }, [rows, sequenceLength, scrollOffset]);
  
  // Calculate stepped value for gate/velocity
  const getSteppedValue = useCallback((rawValue: number, mode: 'gate' | 'velocity') => {
    const minValue = mode === 'gate' ? INTERACTION.MIN_GATE : INTERACTION.MIN_VELOCITY;
    const steps = mode === 'gate' ? INTERACTION.GATE_STEPS : INTERACTION.VELOCITY_STEPS;
    
    const clampedValue = Math.max(minValue, Math.min(1.0, rawValue));
    const stepSize = (1.0 - minValue) / (steps - 1);
    const stepIndex = Math.round((clampedValue - minValue) / stepSize);
    
    return minValue + stepIndex * stepSize;
  }, []);
  
  // Handle pointer down (start of interaction)
  const handlePointerDown = useCallback((e: KonvaEventObject<PointerEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    const stageRect = stage.container().getBoundingClientRect();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const clientX = pointer.x + stageRect.left;
    const clientY = pointer.y + stageRect.top;
    
    // Detect if this is a touch event (for touch-friendly multi-select)
    const isTouchEvent = e.evt instanceof TouchEvent || e.evt.pointerType === 'touch';
    isTouchInteractionRef.current = isTouchEvent;
    
    // Track shift key for multi-select (only works for mouse/pointer)
    const isShiftKey = !isTouchEvent && e.evt instanceof PointerEvent && e.evt.shiftKey;
    shiftKeyRef.current = isShiftKey;
    
    const cell = pointerToCell(pointer.x, pointer.y, 0, 0);
    
    // Store touch start for gesture detection
    touchStateRef.current = {
      startPos: { x: clientX, y: clientY },
      startTime: Date.now(),
      hasMoved: false,
      targetCell: cell,
    };
    
    // Handle select mode (works in any edit mode - note, gate, velocity)
    if (selectMode) {
      // Clear any existing long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressTriggeredRef.current = false;
      
      if (cell) {
        const { beatIndex, note } = cell;
        const hasStep = hasStepAt(beatIndex, note);
        
        if (hasStep) {
          // For touch: don't select on down, wait for tap (pointer up)
          // For mouse: select immediately
          if (!isTouchEvent) {
            const stepKey = getCellKey(beatIndex, note);
            if (isShiftKey) {
              // Toggle mode - add or remove from current selection
              const newSelection = new Set(selectedSteps);
              if (newSelection.has(stepKey)) {
                newSelection.delete(stepKey);
              } else {
                newSelection.add(stepKey);
              }
              onSelectionChange?.(newSelection);
            } else {
              // Replace mode - select only this note
              onSelectionChange?.(new Set([stepKey]));
            }
          }
          // For touch, selection happens on pointer up (tap)
          return;
        }
      }
      
      // Empty space - start marquee selection
      const x = pointer.x + scrollOffset.x;
      const y = pointer.y + scrollOffset.y;
      
      if (isTouchEvent) {
        // Touch: start long press timer for marquee
        longPressTimerRef.current = setTimeout(() => {
          longPressTriggeredRef.current = true;
          setIsInteractionActive(true);
          setMarqueeState({
            startX: x,
            startY: y,
            currentX: x,
            currentY: y,
          });
        }, INTERACTION.LONG_PRESS_DELAY);
      } else {
        // Mouse: start marquee immediately
        setMarqueeState({
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
        });
        
        // Clear selection unless shift is held
        if (!isShiftKey) {
          onSelectionChange?.(new Set());
        }
      }
      return;
    }
    
    if (!cell) return;
    
    const { beatIndex, rowIndex, note } = cell;
    
    // For note mode (not select mode), handle drawing/erasing
    if (editMode === 'note') {
      const hasStep = hasStepAt(beatIndex, note);
      const paintMode: PaintMode = hasStep ? 'erase' : 'draw';
      
      if (isTouchEvent) {
        // For touch: don't toggle immediately
        // Start long press timer for paint mode (hold + drag)
        
        // Clear any existing long press timer
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        longPressTriggeredRef.current = false;
        
        longPressTimerRef.current = setTimeout(() => {
          longPressTriggeredRef.current = true;
          setIsInteractionActive(true);
          // Start paint mode
          paintStateRef.current = {
            mode: paintMode,
            visitedCells: new Set([getCellKey(beatIndex, note)]),
          };
          // Toggle the initial cell when drag starts
          onStepToggle(beatIndex, note);
        }, INTERACTION.LONG_PRESS_DELAY);
        
        return;
      }
      
      // For mouse: behave as before (toggle immediately + drag)
      // Initialize paint state
      paintStateRef.current = {
        mode: paintMode,
        visitedCells: new Set([getCellKey(beatIndex, note)]),
      };
      
      // Toggle the initial cell
      onStepToggle(beatIndex, note);
      return;
    }
    
    // For gate/velocity mode, prepare for potential drag
    const stepData = getStepData(beatIndex, note);
    const startValue = stepData 
      ? (editMode === 'gate' ? stepData.gate : stepData.velocity)
      : (editMode === 'gate' ? INTERACTION.DEFAULT_GATE : INTERACTION.DEFAULT_VELOCITY);
    
    setDragState({
      isDragging: false,
      startPos: { x: clientX, y: clientY },
      startValue,
      beatIndex,
      rowIndex,
      note,
    });
  }, [editMode, selectMode, selectedSteps, onSelectionChange, getStepData, onStepToggle, pointerToCell, hasStepAt, getCellKey, scrollOffset]);
  
  // Handle pointer move (dragging for gate/velocity)
  const handlePointerMove = useCallback((e: KonvaEventObject<PointerEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    const stageRect = stage.container().getBoundingClientRect();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const clientX = pointer.x + stageRect.left;
    const clientY = pointer.y + stageRect.top;
    
    // Update touch state movement
    if (touchStateRef.current) {
      const deltaX = Math.abs(clientX - touchStateRef.current.startPos.x);
      const deltaY = Math.abs(clientY - touchStateRef.current.startPos.y);
      const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (totalMovement > INTERACTION.TOUCH_MOVE_THRESHOLD) {
        touchStateRef.current.hasMoved = true;
        
        // Cancel long press timer if user moved (scrolling)
        if (longPressTimerRef.current && !longPressTriggeredRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    }
    
    // Handle marquee selection in select mode (only if marquee is active)
    if (selectMode && marqueeState) {
      const x = pointer.x + scrollOffset.x;
      const y = pointer.y + scrollOffset.y;
      setMarqueeState(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
      return;
    }
    
    // Handle paint mode (draw/erase) in note edit mode (only when not in select mode)
    if (!selectMode && editMode === 'note' && paintStateRef.current) {
      const cell = pointerToCell(pointer.x, pointer.y, 0, 0);
      if (cell) {
        const cellKey = getCellKey(cell.beatIndex, cell.note);
        
        // Only process if we haven't visited this cell yet
        if (!paintStateRef.current.visitedCells.has(cellKey)) {
          paintStateRef.current.visitedCells.add(cellKey);
          
          const hasStep = hasStepAt(cell.beatIndex, cell.note);
          const { mode } = paintStateRef.current;
          
          // In draw mode, only create notes on empty cells
          // In erase mode, only remove notes from filled cells
          if ((mode === 'draw' && !hasStep) || (mode === 'erase' && hasStep)) {
            onStepToggle(cell.beatIndex, cell.note);
          }
        }
      }
      return;
    }
    
    // Handle gate/velocity dragging (editMode is 'gate' or 'velocity' here)
    if (!dragState) return;
    
    const deltaX = clientX - dragState.startPos.x;
    const deltaY = dragState.startPos.y - clientY; // Invert Y for natural feel
    
    // Check if we've moved enough to consider it a drag
    const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (totalDelta < INTERACTION.TOUCH_MOVE_THRESHOLD * 2 && !dragState.isDragging) {
      return;
    }
    
    // Mark as dragging
    if (!dragState.isDragging) {
      setDragState(prev => prev ? { ...prev, isDragging: true } : null);
    }
    
    // Check if step exists
    const stepData = getStepData(dragState.beatIndex, dragState.note);
    if (!stepData) return;
    
    // Calculate new value based on drag direction
    let rawValue: number;
    if (editMode === 'gate') {
      rawValue = dragState.startValue + deltaX / INTERACTION.GATE_SENSITIVITY;
    } else {
      rawValue = dragState.startValue + deltaY / INTERACTION.VELOCITY_SENSITIVITY;
    }
    
    const steppedValue = getSteppedValue(rawValue, editMode as 'gate' | 'velocity');
    const updates = editMode === 'gate' ? { gate: steppedValue } : { velocity: steppedValue };
    
    onUpdateStep(dragState.beatIndex, dragState.note, updates);
  }, [dragState, editMode, getStepData, getSteppedValue, onUpdateStep, getCellKey, hasStepAt, onStepToggle, pointerToCell, selectMode, marqueeState, scrollOffset]);
  
  // Helper to get steps in marquee area
  const getStepsInMarquee = useCallback((marquee: MarqueeState): Set<string> => {
    const result = new Set<string>();
    const cellSize = KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP;
    
    const minX = Math.min(marquee.startX, marquee.currentX);
    const maxX = Math.max(marquee.startX, marquee.currentX);
    const minY = Math.min(marquee.startY, marquee.currentY);
    const maxY = Math.max(marquee.startY, marquee.currentY);
    
    const startBeat = Math.floor(minX / cellSize);
    const endBeat = Math.ceil(maxX / cellSize);
    const startRow = Math.floor(minY / cellSize);
    const endRow = Math.ceil(maxY / cellSize);
    
    for (let rowIndex = startRow; rowIndex < endRow && rowIndex < rows.length; rowIndex++) {
      if (rowIndex < 0) continue;
      const row = rows[rowIndex];
      const note = isDrumRow(row) ? row.sampleName : isNoteRow(row) ? row.note : null;
      if (!note) continue;
      
      for (let beatIndex = startBeat; beatIndex < endBeat && beatIndex < sequenceLength; beatIndex++) {
        if (beatIndex < 0) continue;
        if (hasStepAt(beatIndex, note)) {
          result.add(getCellKey(beatIndex, note));
        }
      }
    }
    
    return result;
  }, [rows, sequenceLength, hasStepAt, getCellKey]);
  
  // Handle pointer up (end of interaction)
  const handlePointerUp = useCallback(() => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // Handle touch tap selection (if user tapped on a note without moving)
    if (selectMode && isTouchInteractionRef.current && touchStateRef.current) {
      const { targetCell, hasMoved } = touchStateRef.current;
      
      // Only handle tap if user didn't move and long press wasn't triggered
      if (!hasMoved && !longPressTriggeredRef.current && targetCell) {
        const { beatIndex, note } = targetCell;
        if (hasStepAt(beatIndex, note)) {
          const stepKey = getCellKey(beatIndex, note);
          // Toggle selection on tap
          const newSelection = new Set(selectedSteps);
          if (newSelection.has(stepKey)) {
            newSelection.delete(stepKey);
          } else {
            newSelection.add(stepKey);
          }
          onSelectionChange?.(newSelection);
        }
      }
    }
    
    // Handle touch interactions in note mode
    if (!selectMode && editMode === 'note' && isTouchInteractionRef.current && touchStateRef.current) {
      const { targetCell, hasMoved } = touchStateRef.current;
      
      // If user tapped (didn't move and long press wasn't triggered)
      if (!hasMoved && !longPressTriggeredRef.current && targetCell) {
        const currentTime = Date.now();
        const { beatIndex, note } = targetCell;
        const cellKey = getCellKey(beatIndex, note);
        
        // Check for double tap
        if (lastTapRef.current && 
            lastTapRef.current.cellKey === cellKey && 
            currentTime - lastTapRef.current.time < INTERACTION.DOUBLE_TAP_DELAY) {
          
          // Double tap detected - toggle note
          onStepToggle(beatIndex, note);
          lastTapRef.current = null; // Reset tap state
        } else {
          // First tap
          lastTapRef.current = {
            time: currentTime,
            cellKey,
          };
        }
      }
    }

    // Finalize marquee selection
    if (selectMode && marqueeState) {
      const marqueeSelection = getStepsInMarquee(marqueeState);
      
      // Touch or shift: add to existing selection
      // Mouse without shift: replace selection
      const shouldAddToSelection = isTouchInteractionRef.current || shiftKeyRef.current;
      
      if (shouldAddToSelection) {
        const newSelection = new Set(selectedSteps);
        marqueeSelection.forEach(key => newSelection.add(key));
        onSelectionChange?.(newSelection);
      } else {
        onSelectionChange?.(marqueeSelection);
      }
      
      setMarqueeState(null);
    }
    
    // Reset all states
    touchStateRef.current = null;
    paintStateRef.current = null;
    shiftKeyRef.current = false;
    isTouchInteractionRef.current = false;
    longPressTriggeredRef.current = false;
    setIsInteractionActive(false);
    setDragState(null);
  }, [selectMode, marqueeState, getStepsInMarquee, selectedSteps, onSelectionChange, hasStepAt, getCellKey, editMode, onStepToggle]);
  
  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    dragState,
    marqueeState,
    isInteractionActive,
  };
};
