import { memo } from "react";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";

interface LengthControlProps {
  currentLength: number;
  onLengthChange: (length: number) => void;
}

export const LengthControl = memo(({
  currentLength,
  onLengthChange,
}: LengthControlProps) => {
  return (
    <div className="flex items-center gap-2 flex-1">
      <span className="text-xs text-base-content/70 whitespace-nowrap">
        Length: {currentLength} beats
      </span>
      <input
        type="range"
        min={SEQUENCER_CONSTANTS.MIN_BEATS}
        max={SEQUENCER_CONSTANTS.MAX_BEATS}
        value={currentLength}
        onChange={(e) => onLengthChange(parseInt(e.target.value))}
        className="range range-xs range-primary flex-1 max-w-xs"
        style={{ touchAction: "manipulation" }}
      />
      <div className="flex gap-1 text-xs text-base-content/50">
        <span>{SEQUENCER_CONSTANTS.MIN_BEATS}</span>
        <span>-</span>
        <span>{SEQUENCER_CONSTANTS.MAX_BEATS}</span>
      </div>
    </div>
  );
});

LengthControl.displayName = "LengthControl";