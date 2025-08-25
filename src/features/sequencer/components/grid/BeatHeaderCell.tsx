import { memo } from "react";

interface BeatHeaderCellProps {
  beatIndex: number;
  onBeatSelect: (beat: number) => void;
  onCurrentBeatChange: (beat: number) => void;
}

export const BeatHeaderCell = memo(({
  beatIndex,
  onBeatSelect,
  onCurrentBeatChange,
}: BeatHeaderCellProps) => (
  <button
    onClick={() => {
      onBeatSelect(beatIndex);
      onCurrentBeatChange(beatIndex);
    }}
    className="w-full h-full flex items-center justify-center text-xs font-bold border-b-2 transition-colors cursor-pointer hover:bg-base-200"
    style={{
      borderColor:
        (beatIndex + 1) % 4 === 1
          ? "hsl(var(--bc) / 0.3)"
          : "hsl(var(--bc) / 0.2)",
      color:
        (beatIndex + 1) % 4 === 1 ? "hsl(var(--bc))" : "hsl(var(--bc) / 0.7)",
    }}
    title={`Jump to beat ${beatIndex + 1}`}
  >
    {beatIndex + 1}
  </button>
));

BeatHeaderCell.displayName = "BeatHeaderCell";