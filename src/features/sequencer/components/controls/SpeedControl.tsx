import { memo } from "react";
import { SEQUENCER_SPEEDS } from "@/shared/constants";
import type { CSSProperties } from "react";

interface SpeedControlProps {
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export const SpeedControl = memo(({
  currentSpeed,
  onSpeedChange,
}: SpeedControlProps) => {
  const getCurrentSpeedLabel = () => {
    const speedConfig = SEQUENCER_SPEEDS.find(s => s.value === currentSpeed);
    return speedConfig?.label || currentSpeed.toString();
  };

  const mobileButtonStyle: CSSProperties = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    WebkitTouchCallout: "none" as const,
    WebkitUserSelect: "none",
    userSelect: "none",
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-base-content/70">Beat Length:</span>
      <div className="dropdown dropdown-end">
        <button
          tabIndex={0}
          role="button"
          className="btn btn-sm btn-outline touch-manipulation"
          style={mobileButtonStyle}
        >
          {getCurrentSpeedLabel()}
        </button>
        <ul
          tabIndex={0}
          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 max-h-40 overflow-y-auto"
        >
          {SEQUENCER_SPEEDS.map(({ value, label }) => (
            <li key={value}>
              <button
                className={`text-sm touch-manipulation ${currentSpeed === value ? "bg-primary/50" : ""}`}
                onClick={() => onSpeedChange(value)}
                style={mobileButtonStyle}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

SpeedControl.displayName = "SpeedControl";