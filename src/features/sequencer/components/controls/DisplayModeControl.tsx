import { memo } from "react";
import type { DisplayMode } from "../../types";
import type { CSSProperties } from "react";

interface DisplayModeOption {
  value: DisplayMode;
  label: string;
}

interface DisplayModeControlProps {
  currentMode: DisplayMode;
  options: DisplayModeOption[];
  onModeChange: (mode: DisplayMode) => void;
}

export const DisplayModeControl = memo(({
  currentMode,
  options,
  onModeChange,
}: DisplayModeControlProps) => {
  const mobileButtonStyle: CSSProperties = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    WebkitTouchCallout: "none" as const,
    WebkitUserSelect: "none",
    userSelect: "none",
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-base-content/70">Display:</span>
      <select
        className="select select-sm select-bordered touch-manipulation"
        value={currentMode}
        onChange={(e) => onModeChange(e.target.value as DisplayMode)}
        style={mobileButtonStyle}
      >
        {options.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
});

DisplayModeControl.displayName = "DisplayModeControl";