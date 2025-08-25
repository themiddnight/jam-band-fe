import React, { memo, useCallback } from "react";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import type { SequencerRow, DrumRow, NoteRow, EditMode, SequencerStep } from "../../types";

// Type guards
const isDrumRow = (row: SequencerRow): row is DrumRow => {
  return "sampleName" in row;
};

const isNoteRow = (row: SequencerRow): row is NoteRow => {
  return "note" in row && "inScale" in row;
};

// Helper function to check if a note matches the root note (ignoring octave)
const isRootNote = (note: string, rootNote?: string): boolean => {
  if (!rootNote) return false;
  // Extract note name without octave (e.g., "C4" -> "C", "F#3" -> "F#")
  const noteNameWithoutOctave = note.replace(/\d+$/, "");
  return noteNameWithoutOctave === rootNote;
};

interface StepCellProps {
  row: SequencerRow;
  beatIndex: number;
  isRecording: boolean;
  editMode: EditMode;
  rootNote?: string;
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
}

export const StepCell = memo(({
  row,
  beatIndex,
  isRecording,
  editMode,
  rootNote,
  hasStepAt,
  getStepData,
  onStepToggle,
  onUpdateStep,
  gridConstants,
}: StepCellProps) => {
  const note = isDrumRow(row) ? row.sampleName : row.note;
  const isActive = hasStepAt(beatIndex, note);
  const stepData = getStepData(beatIndex, note);

  // Drag state for gate and velocity editing
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStartPos, setDragStartPos] = React.useState({ x: 0, y: 0 });
  const [dragStartValue, setDragStartValue] = React.useState(0);

  // Touch gesture detection state
  const [touchStartPos, setTouchStartPos] = React.useState({ x: 0, y: 0 });
  const [touchStartTime, setTouchStartTime] = React.useState(0);
  const [hasMoved, setHasMoved] = React.useState(false);

  // Cell styling based on edit mode
  const getCellClasses = useCallback(() => {
    const baseClasses = `w-full h-full btn btn-sm p-0 border border-white/20 transition-all duration-75 relative overflow-hidden cursor-pointer`;

    // Check if this row represents the root note
    const isRoot = isNoteRow(row) && isRootNote(row.note, rootNote);

    if (isActive && stepData) {
      if (editMode === "gate") {
        return `${baseClasses} bg-success/20 border-success text-success-content hover:bg-success/30 active:bg-success/40 ${isRoot ? "ring-2 ring-primary/50" : ""}`;
      } else if (editMode === "velocity") {
        return `${baseClasses} bg-warning/20 border-warning text-warning-content hover:bg-warning/30 active:bg-warning/40 ${isRoot ? "ring-2 ring-primary/50" : ""}`;
      } else {
        if (isDrumRow(row)) {
          return `${baseClasses} btn-accent border-accent-focus text-accent-content ${isRoot ? "ring-2 ring-primary/50" : ""}`;
        } else if (isNoteRow(row) && !row.inScale) {
          return `${baseClasses} btn-warning border-warning-focus text-warning-content opacity-75 ${isRoot ? "ring-2 ring-primary/50" : ""}`;
        } else {
          return `${baseClasses} btn-accent border-accent-focus text-accent-content ${isRoot ? "ring-2 ring-primary/50" : ""}`;
        }
      }
    }

    const beatStyle = (beatIndex + 1) % 4 === 1 ? "border-base-300" : "border-base-200";

    if (isRoot) {
      return `${baseClasses} btn-ghost ${beatStyle} bg-primary/10 border-primary/30 hover:bg-primary/20`;
    }

    if (isNoteRow(row) && !row.inScale) {
      return `${baseClasses} btn-ghost ${beatStyle} opacity-50 hover:opacity-75`;
    }

    return `${baseClasses} btn-ghost ${beatStyle} hover:btn-outline`;
  }, [isActive, stepData, editMode, row, beatIndex, rootNote]);

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

  // Touch gesture detection constants
  const TOUCH_MOVE_THRESHOLD = 10; // pixels
  const TAP_TIME_THRESHOLD = 300; // milliseconds

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLButtonElement>) => {
      const touch = e.touches[0];
      setTouchStartPos({ x: touch.clientX, y: touch.clientY });
      setTouchStartTime(Date.now());
      setHasMoved(false);

      // For gate and velocity modes, prepare for potential dragging
      if (editMode !== "note") {
        setDragStartPos({ x: touch.clientX, y: touch.clientY });
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
      }
    },
    [editMode, stepData]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLButtonElement>) => {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPos.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.y);
      const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Mark as moved if we've exceeded the threshold
      if (totalMovement > TOUCH_MOVE_THRESHOLD) {
        setHasMoved(true);
      }

      // Handle dragging for gate and velocity modes only if we're intentionally dragging
      if (
        editMode !== "note" &&
        hasMoved &&
        totalMovement > TOUCH_MOVE_THRESHOLD * 2
      ) {
        e.preventDefault(); // Prevent scrolling when intentionally dragging

        if (!isDragging) {
          setIsDragging(true);
        }

        const realDeltaX = touch.clientX - dragStartPos.x;
        const realDeltaY = dragStartPos.y - touch.clientY;

        let rawValue: number;

        if (editMode === "gate") {
          const sensitivity = 100;
          rawValue = dragStartValue + realDeltaX / sensitivity;
        } else if (editMode === "velocity") {
          const sensitivity = 80;
          rawValue = dragStartValue + realDeltaY / sensitivity;
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
      }
    },
    [
      touchStartPos,
      hasMoved,
      editMode,
      isDragging,
      dragStartPos,
      dragStartValue,
      stepData,
      onUpdateStep,
      beatIndex,
      note,
    ]
  );

  const handleTouchEnd = useCallback(
    () => {
      const touchEndTime = Date.now();
      const touchDuration = touchEndTime - touchStartTime;

      // Only trigger tap if:
      // 1. Touch duration was short (less than TAP_TIME_THRESHOLD)
      // 2. No significant movement occurred
      // 3. Not currently dragging
      if (touchDuration < TAP_TIME_THRESHOLD && !hasMoved && !isDragging) {
        // This is a tap, not a scroll
        if (editMode === "note") {
          onStepToggle(beatIndex, note);
        }
      }

      // Reset states
      setIsDragging(false);
      setHasMoved(false);
    },
    [
      touchStartTime,
      hasMoved,
      isDragging,
      editMode,
      onStepToggle,
      beatIndex,
      note,
    ]
  );

  // Fallback pointer events for non-touch devices
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Only handle if it's not a touch event (mouse, pen, etc.)
      if (e.pointerType === "touch") return;

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
      // Only handle if it's not a touch event
      if (e.pointerType === "touch") return;
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

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Only handle if it's not a touch event
      if (e.pointerType === "touch") return;
      setIsDragging(false);
    },
    []
  );

  return (
    <button
      className={getCellClasses()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        touchAction: "pan-x pan-y", // Allow scrolling by default
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