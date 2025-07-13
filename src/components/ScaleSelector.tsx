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
    <div className="flex justify-center items-center gap-4 bg-white p-6 rounded-lg shadow-lg mb-6 w-full max-w-4xl">
      <h3 className="font-semibold text-gray-700">Scale</h3>
      <div className="flex gap-2">
        <select
          value={rootNote}
          onChange={(e) => onRootNoteChange(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          {NOTE_NAMES.map((note) => (
            <option key={note} value={note}>
              {note}
            </option>
          ))}
        </select>
        <button
          onClick={() => onScaleChange("major")}
          className={`px-4 py-2 rounded ${
            scale === "major"
              ? "bg-purple-500 text-white"
              : "bg-gray-200"
          }`}
        >
          Major
        </button>
        <button
          onClick={() => onScaleChange("minor")}
          className={`px-4 py-2 rounded ${
            scale === "minor"
              ? "bg-purple-500 text-white"
              : "bg-gray-200"
          }`}
        >
          Minor
        </button>
      </div>
    </div>
  );
} 