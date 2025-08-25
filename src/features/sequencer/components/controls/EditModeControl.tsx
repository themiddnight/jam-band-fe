import { memo } from "react";
import { useTouchEvents } from "@/features/ui";
import type { EditMode } from "../../types";
import type { CSSProperties } from "react";

interface EditModeControlProps {
  currentMode: EditMode;
  onModeChange: (mode: EditMode) => void;
}

export const EditModeControl = memo(({
  currentMode,
  onModeChange,
}: EditModeControlProps) => {
  const noteModeTouchHandlers = useTouchEvents({
    onPress: () => onModeChange("note"),
    onRelease: () => {},
    isPlayButton: true,
  });

  const gateModeTouchHandlers = useTouchEvents({
    onPress: () => onModeChange("gate"),
    onRelease: () => {},
    isPlayButton: true,
  });

  const velocityModeTouchHandlers = useTouchEvents({
    onPress: () => onModeChange("velocity"),
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
      <span className="text-xs text-base-content/70">Edit:</span>
      <div className="join">
        <button
          className={`btn btn-sm join-item touch-manipulation ${
            currentMode === "note" ? "btn-primary" : "btn-outline"
          }`}
          onMouseDown={() => onModeChange("note")}
          ref={noteModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          style={mobileButtonStyle}
          title="Note Mode - Toggle notes on/off"
        >
          📝
        </button>
        <button
          className={`btn btn-sm join-item touch-manipulation ${
            currentMode === "gate" ? "btn-primary" : "btn-outline"
          }`}
          onMouseDown={() => onModeChange("gate")}
          ref={gateModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          style={mobileButtonStyle}
          title="Gate Mode - Adjust note length (drag left-right)"
        >
          ⏱️
        </button>
        <button
          className={`btn btn-sm join-item touch-manipulation ${
            currentMode === "velocity" ? "btn-primary" : "btn-outline"
          }`}
          onMouseDown={() => onModeChange("velocity")}
          ref={velocityModeTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          style={mobileButtonStyle}
          title="Velocity Mode - Adjust note volume (drag up-down)"
        >
          🔊
        </button>
      </div>
    </div>
  );
});

EditModeControl.displayName = "EditModeControl";