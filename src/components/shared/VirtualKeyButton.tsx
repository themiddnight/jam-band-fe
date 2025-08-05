import { useTouchEvents } from "../../hooks/useTouchEvents";
import { memo } from "react";

interface VirtualKeyButtonProps {
  keyboardKey?: string;
  note: string;
  isPressed: boolean;
  onPress: () => void;
  onRelease: () => void;
  className?: string;
}

// Helper function to extract octave from note string
const getOctaveFromNote = (note: string): number => {
  return parseInt(note.slice(-1));
};

// Helper function to get background color based on octave
const getOctaveBackgroundColor = (octave: number): string => {
  // Even octaves get white background, odd octaves get accent color
  return octave % 2 === 0 ? "bg-white" : "bg-blue-100";
};

// Helper function to get pressed background color based on octave
const getPressedOctaveBackgroundColor = (octave: number): string => {
  // Even octaves get light gray when pressed, odd octaves get darker accent
  return octave % 2 === 0 ? "bg-gray-200" : "bg-blue-200";
};

export const VirtualKeyButton = memo<VirtualKeyButtonProps>(
  ({ keyboardKey, note, isPressed, onPress, onRelease, className = "" }) => {
    const touchHandlers = useTouchEvents({ onPress, onRelease });
    const octave = getOctaveFromNote(note);
    const baseBgColor = getOctaveBackgroundColor(octave);
    const pressedBgColor = getPressedOctaveBackgroundColor(octave);

    return (
      <button
        ref={touchHandlers.ref as React.RefObject<HTMLButtonElement>}
        onMouseDown={onPress}
        onMouseUp={onRelease}
        onMouseLeave={onRelease}
        className={`
        w-12 h-24 border-2 border-gray-300 hover:bg-gray-100 
        transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
        touch-manipulation
        ${baseBgColor}
        ${isPressed ? `${pressedBgColor} transform scale-95` : ""}
        ${className}
      `}
        style={{
          WebkitTapHighlightColor: "transparent",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          touchAction: "manipulation",
        }}
      >
        <div className="w-full h-full" />
        <span className="text-xs text-gray-600 font-bold">
          <kbd className="kbd kbd-sm">{keyboardKey?.toUpperCase()}</kbd>
        </span>
        <span className="text-xs text-gray-600">{note}</span>
      </button>
    );
  },
);

VirtualKeyButton.displayName = "VirtualKeyButton";
