import { NOTE_NAMES } from "../utils/musicUtils";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import type { Scale } from "@/shared/types";
import { useEffect } from "react";

export interface ScaleSelectorProps {
  rootNote: string;
  scale: Scale;
  onRootNoteChange: (note: string) => void;
  onScaleChange: (scale: Scale) => void;
}

export default function ScaleSelector({
  rootNote,
  scale,
  onRootNoteChange,
  onScaleChange,
}: ScaleSelectorProps) {
  const { selectedSlotId, setSlot, isInitialized } = useScaleSlotsStore();

  // Update the selected slot when scale changes, but only after initialization
  useEffect(() => {
    if (selectedSlotId !== null && isInitialized) {
      setSlot(selectedSlotId, rootNote, scale);
    }
  }, [rootNote, scale, selectedSlotId, setSlot, isInitialized]);

  return (
    <div className="flex gap-2">
      <select
        value={rootNote}
        onChange={(e) => onRootNoteChange(e.target.value)}
        className="select select-bordered select-sm"
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
          className={`btn btn-sm join-item ${
            scale === "major" ? "btn-accent" : "btn-outline"
          }`}
        >
          Major
        </button>
        <button
          onClick={() => onScaleChange("minor")}
          className={`btn btn-sm join-item ${
            scale === "minor" ? "btn-accent" : "btn-outline"
          }`}
        >
          Minor
        </button>
      </div>
    </div>
  );
}
