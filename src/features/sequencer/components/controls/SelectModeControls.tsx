import { memo, useState, useCallback, useEffect, useRef } from 'react';
import type { SequencerStep } from '../../types';

interface SelectModeControlsProps {
  selectMode: boolean;
  onSelectModeChange: (enabled: boolean) => void;
  selectedSteps: Set<string>;
  onUpdateSelectedSteps: (updates: Partial<SequencerStep>) => void;
  getStepData: (beat: number, note: string) => SequencerStep | null;
}

export const SelectModeControls = memo(({
  selectMode,
  onSelectModeChange,
  selectedSteps,
  onUpdateSelectedSteps,
  getStepData,
}: SelectModeControlsProps) => {
  // Track slider values for immediate feedback
  const [gateValue, setGateValue] = useState(0.5);
  const [velocityValue, setVelocityValue] = useState(0.8);
  
  // Track if user is currently dragging to prevent value reset
  const isDraggingGateRef = useRef(false);
  const isDraggingVelocityRef = useRef(false);
  
  // Track previous selection to detect changes
  const prevSelectionRef = useRef<Set<string>>(new Set());
  
  // Calculate average and sync slider values when selection changes
  useEffect(() => {
    // Check if selection actually changed
    const prevKeys = Array.from(prevSelectionRef.current).sort().join(',');
    const currentKeys = Array.from(selectedSteps).sort().join(',');
    
    if (prevKeys === currentKeys) {
      return; // No change in selection
    }
    
    prevSelectionRef.current = new Set(selectedSteps);
    
    // Don't reset if user is dragging
    if (isDraggingGateRef.current || isDraggingVelocityRef.current) {
      return;
    }
    
    if (selectedSteps.size === 0) {
      setGateValue(0.5);
      setVelocityValue(0.8);
      return;
    }
    
    let totalGate = 0;
    let totalVelocity = 0;
    let count = 0;
    
    selectedSteps.forEach((stepKey) => {
      const [beat, ...noteParts] = stepKey.split('-');
      const note = noteParts.join('-'); // Handle notes with dashes
      const step = getStepData(parseInt(beat), note);
      if (step) {
        totalGate += step.gate;
        totalVelocity += step.velocity;
        count++;
      }
    });
    
    if (count > 0) {
      setGateValue(totalGate / count);
      setVelocityValue(totalVelocity / count);
    }
  }, [selectedSteps, getStepData]);
  
  // Handle gate drag start
  const handleGateDragStart = useCallback(() => {
    isDraggingGateRef.current = true;
  }, []);
  
  // Handle gate change during drag
  const handleGateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setGateValue(value);
    // Apply immediately for smooth feedback
    if (selectedSteps.size > 0) {
      onUpdateSelectedSteps({ gate: value });
    }
  }, [selectedSteps.size, onUpdateSelectedSteps]);
  
  // Handle gate drag end
  const handleGateDragEnd = useCallback(() => {
    isDraggingGateRef.current = false;
  }, []);
  
  // Handle velocity drag start
  const handleVelocityDragStart = useCallback(() => {
    isDraggingVelocityRef.current = true;
  }, []);
  
  // Handle velocity change during drag
  const handleVelocityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVelocityValue(value);
    // Apply immediately for smooth feedback
    if (selectedSteps.size > 0) {
      onUpdateSelectedSteps({ velocity: value });
    }
  }, [selectedSteps.size, onUpdateSelectedSteps]);
  
  // Handle velocity drag end
  const handleVelocityDragEnd = useCallback(() => {
    isDraggingVelocityRef.current = false;
  }, []);

  return (
    <div className="flex items-center flex-wrap gap-3">
      {/* Select Mode Toggle */}
      <button
        className={`btn btn-xs gap-2 ${selectMode ? 'btn-primary' : 'btn-outline'}`}
        onClick={() => onSelectModeChange(!selectMode)}
        title="Toggle Select Mode"
      >
        <span className="text-base">⎄</span>
        <span>Select Mode</span>
      </button>
      
      {/* Gate and Velocity Sliders - only show when select mode is enabled */}
      {selectMode && (
        <div className="flex items-center gap-4">
          {/* Gate Slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-base-content/70 w-8">Gate</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={gateValue}
              onMouseDown={handleGateDragStart}
              onTouchStart={handleGateDragStart}
              onChange={handleGateChange}
              onMouseUp={handleGateDragEnd}
              onTouchEnd={handleGateDragEnd}
              className="range range-xs range-primary w-20"
              disabled={selectedSteps.size === 0}
            />
          </div>
          
          {/* Velocity Slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-base-content/70 w-6">Vel</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={velocityValue}
              onMouseDown={handleVelocityDragStart}
              onTouchStart={handleVelocityDragStart}
              onChange={handleVelocityChange}
              onMouseUp={handleVelocityDragEnd}
              onTouchEnd={handleVelocityDragEnd}
              className="range range-xs range-warning w-20"
              disabled={selectedSteps.size === 0}
            />
          </div>
          
          {/* Selection count */}
          {selectedSteps.size > 0 && (
            <span className="text-xs text-base-content/50">
              {selectedSteps.size} selected
            </span>
          )}
        </div>
      )}
    </div>
  );
});

SelectModeControls.displayName = 'SelectModeControls';
