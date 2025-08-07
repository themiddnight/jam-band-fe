import { useTouchEvents } from "../../hooks/useTouchEvents";
import { memo } from "react";

export interface InstrumentButtonProps {
  // Button identification
  keyboardKey?: string;
  note?: string;
  chordName?: string;
  chordSuffix?: string;
  modifierType?: "dominant7" | "major7" | "sus2" | "sus4" | "majMinToggle";

  // Visual state
  isPressed: boolean;

  // Event handlers
  onPress: () => void;
  onRelease: () => void;

  // Styling
  className?: string;
  variant?: "note" | "chord" | "modifier";
  size?: "sm" | "md" | "lg";
  
  // Sustain state to prevent mouse leave issues
  sustain?: boolean;
  sustainToggle?: boolean;
}

// Helper function to extract octave from note string
const getOctaveFromNote = (note: string): number => {
  return parseInt(note.slice(-1));
};

// Helper function to get background color based on octave and variant
const getBackgroundColor = (
  note: string | undefined,
  variant: "note" | "chord" | "modifier",
  modifierType?: string,
): string => {
  if (variant === "chord") {
    return "bg-purple-100";
  }
  if (variant === "modifier") {
    if (modifierType === "sus2" || modifierType === "sus4") {
      return "bg-gray-600";
    }
    if (modifierType === "dominant7" || modifierType === "major7") {
      return "bg-gray-600";
    }
    if (modifierType === "majMinToggle") {
      return "bg-gray-600";
    }
    return "bg-gray-600";
  }

  // For notes, use octave-based coloring
  if (note) {
    const octave = getOctaveFromNote(note);
    return octave % 2 === 0 ? "bg-white" : "bg-blue-100";
  }

  return "bg-white";
};

// Helper function to get pressed background color
const getPressedBackgroundColor = (
  note: string | undefined,
  variant: "note" | "chord" | "modifier",
  modifierType?: string,
): string => {
  if (variant === "chord") {
    return "bg-purple-300";
  }
  if (variant === "modifier") {
    if (modifierType === "sus2" || modifierType === "sus4") {
      return "bg-green-500";
    }
    if (modifierType === "dominant7" || modifierType === "major7") {
      return "bg-yellow-500";
    }
    if (modifierType === "majMinToggle") {
      return "bg-blue-500";
    }
    return "bg-yellow-500";
  }

  // For notes, use octave-based coloring
  if (note) {
    const octave = getOctaveFromNote(note);
    return octave % 2 === 0 ? "bg-gray-200" : "bg-blue-200";
  }

  return "bg-gray-200";
};

// Helper function to get text color
const getTextColor = (
  variant: "note" | "chord" | "modifier",
  modifierType?: string,
): string => {
  switch (variant) {
    case "chord":
      return "text-purple-800";
    case "modifier":
      // Use modifierType to determine text color when pressed
      if (modifierType === "sus2" || modifierType === "sus4") {
        return "text-gray-300";
      }
      if (modifierType === "dominant7" || modifierType === "major7") {
        return "text-gray-300";
      }
      if (modifierType === "majMinToggle") {
        return "text-gray-300";
      }
      return "text-gray-300";
    default:
      return "text-gray-600";
  }
};

// Helper function to get size classes
const getSizeClasses = (size: "sm" | "md" | "lg"): string => {
  switch (size) {
    case "sm":
      return "w-10 h-16";
    case "lg":
      return "w-14 h-28";
    default:
      return "w-12 h-20";
  }
};

export const InstrumentButton = memo<InstrumentButtonProps>(
  ({
    keyboardKey,
    note,
    chordName,
    chordSuffix,
    modifierType,
    isPressed,
    onPress,
    onRelease,
    className = "",
    variant = "note",
    size = "md",
    sustain = false,
    sustainToggle = false,
  }) => {
    const touchHandlers = useTouchEvents({ onPress, onRelease });
    const baseBgColor = getBackgroundColor(note, variant, modifierType);
    const pressedBgColor = getPressedBackgroundColor(
      note,
      variant,
      modifierType,
    );
    const textColor = getTextColor(variant, modifierType);
    const sizeClasses = getSizeClasses(size);

    // Only call onRelease on mouse leave if sustain is not active
    const handleMouseLeave = () => {
      if (!sustain && !sustainToggle) {
        onRelease();
      }
    };

    return (
      <button
        ref={touchHandlers.ref as React.RefObject<HTMLButtonElement>}
        onMouseDown={onPress}
        onMouseUp={onRelease}
        onMouseLeave={handleMouseLeave}
        className={`
        ${sizeClasses} border-2 border-gray-300 hover:bg-gray-100 
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

        {/* Keyboard key display */}
        {keyboardKey && (
          <span className={`text-xs ${textColor} font-bold`}>
            <kbd className="kbd kbd-sm">{keyboardKey.toUpperCase()}</kbd>
          </span>
        )}

        {/* Content display */}
        {variant === "chord" ? (
          <div className="text-center">
            <div className={`text-xs ${textColor}`}>{chordName}</div>
            {chordSuffix && (
              <div className={`text-xs ${textColor} font-bold`}>
                {chordSuffix}
              </div>
            )}
          </div>
        ) : (
          note && <span className={`text-xs ${textColor}`}>{note}</span>
        )}
      </button>
    );
  },
);

InstrumentButton.displayName = "InstrumentButton";
