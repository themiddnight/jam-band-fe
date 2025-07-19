import { NOTE_NAMES } from "../hooks/useScaleState";
import type { Scale } from "../hooks/useScaleState";

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
  return (
    <div className="card bg-base-100 shadow-lg grow">
      <div className="card-body p-3">
        <div className="flex justify-center items-center gap-3">
          <label className="label py-1">
            <span className="label-text text-xs">Root</span>
          </label>
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
                  scale === "major" ? "btn-primary" : "btn-outline"
                }`}
              >
                Major
              </button>
              <button
                onClick={() => onScaleChange("minor")}
                className={`btn btn-sm join-item ${
                  scale === "minor" ? "btn-primary" : "btn-outline"
                }`}
              >
                Minor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 