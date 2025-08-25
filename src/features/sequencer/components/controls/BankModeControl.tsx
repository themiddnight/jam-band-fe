import { memo } from "react";
import { useTouchEvents } from "@/features/ui";
import type { CSSProperties } from "react";

interface BankModeControlProps {
  currentMode: "single" | "continuous";
  onModeChange: (mode: "single" | "continuous") => void;
}

export const BankModeControl = memo(({
  currentMode,
  onModeChange,
}: BankModeControlProps) => {
  const singleModeTouchHandlers = useTouchEvents({
    onPress: () => onModeChange("single"),
    onRelease: () => {},
    isPlayButton: true,
  });

  const continuousModeTouchHandlers = useTouchEvents({
    onPress: () => onModeChange("continuous"),
    onRelease: () => {},
    isPlayButton: true,
  });

  const mobileButtonStyle: CSSProperties = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    WebkitTouchCallout: "none" as const,
    WebkitUserSelect: "none",
    userSelect: "none",
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-base-content/70">Loop Mode:</span>
      <div className="join">
        <button
          className={`btn btn-sm join-item touch-manipulation ${
            currentMode === "single" ? "btn-primary" : "btn-outline"
          }`}
          onMouseDown={() => onModeChange("single")}
          ref={singleModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          style={mobileButtonStyle}
        >
          Single
        </button>
        <button
          className={`btn btn-sm join-item touch-manipulation ${
            currentMode === "continuous" ? "btn-primary" : "btn-outline"
          }`}
          onMouseDown={() => onModeChange("continuous")}
          ref={continuousModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          style={mobileButtonStyle}
        >
          Continuous
        </button>
      </div>
    </div>
  );
});

BankModeControl.displayName = "BankModeControl";