import { NOTE_NAMES } from "../utils/musicUtils";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import type { Scale } from "@/shared/types";
import { useEffect } from "react";

export interface ScaleSelectorProps {
  rootNote: string;
  scale: Scale;
  onRootNoteChange: (note: string) => void;
  onScaleChange: (scale: Scale) => void;
  size?: 'sm' | 'xs';
}

export default function ScaleSelector({
  rootNote,
  scale,
  onRootNoteChange,
  onScaleChange,
  size = 'sm',
}: ScaleSelectorProps) {
  const { selectedSlotId, setSlot, isInitialized } = useScaleSlotsStore();

  // Update the selected slot when scale changes, but only after initialization
  useEffect(() => {
    if (selectedSlotId !== null && isInitialized) {
      setSlot(selectedSlotId, rootNote, scale);
    }
  }, [rootNote, scale, selectedSlotId, setSlot, isInitialized]);

  return (
    <div className="flex gap-1 sm:gap-2">
      <select
        value={rootNote}
        onChange={(e) => onRootNoteChange(e.target.value)}
        className={`select select-bordered select-${size} min-w-0 w-14 sm:w-auto`}
      >
        {NOTE_NAMES.map((note) => (
          <option key={note} value={note}>
            {note}
          </option>
        ))}
      </select>
      <div className="join">
        <button
          onClick={() => onScaleChange("major")}
          className={`btn btn-${size} join-item ${
            scale === "major" ? "btn-accent" : "btn-outline"
          }`}
        >
          <span className="hidden sm:inline">Major</span>
          <span className="sm:hidden">Maj</span>
        </button>
        <button
          onClick={() => onScaleChange("minor")}
          className={`btn btn-${size} join-item ${
            scale === "minor" ? "btn-accent" : "btn-outline"
          }`}
        >
          <span className="hidden sm:inline">Minor</span>
          <span className="sm:hidden">Min</span>
        </button>
      </div>
    </div>
  );
}
