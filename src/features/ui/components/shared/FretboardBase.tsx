import { useTouchEvents } from "../../hooks/useTouchEvents";
import React from "react";

export interface FretPosition {
  string: number;
  fret: number;
  note: string;
  isPressed: boolean;
  isHighlighted?: boolean;
  isScaleNote?: boolean;
}

export interface FretboardConfig {
  strings: string[];
  frets: number;
  openNotes: string[];
  mode: "melody" | "chord" | "octave";
  showNoteNames?: boolean;
  showFretNumbers?: boolean;
  highlightScaleNotes?: boolean;
  highlightFrets?: number[];
}

export interface FretboardBaseProps {
  config: FretboardConfig;
  positions: FretPosition[];
  onFretPress: (stringIndex: number, fret: number, note: string) => void;
  onFretRelease: (stringIndex: number, fret: number, note: string) => void;
  className?: string;
  // Add sustain state to prevent mouse leave issues
  sustain?: boolean;
  sustainToggle?: boolean;
}

// Memoized fret button component for performance
const FretButton = React.memo<{
  stringIndex: number;
  fret: number;
  position: FretPosition;
  onPress: () => void;
  onRelease: () => void;
  showNoteNames?: boolean;
  sustain?: boolean;
  sustainToggle?: boolean;
}>(
  ({
    stringIndex,
    fret,
    position,
    onPress,
    onRelease,
    showNoteNames = true,
    sustain = false,
    sustainToggle = false,
  }) => {
    const touchHandlers = useTouchEvents({ onPress, onRelease });

    const isPressed = position.isPressed;
    const isHighlighted = position.isHighlighted;
    const isScaleNote = position.isScaleNote;

    // Only call onRelease on mouse leave if sustain is not active
    const handleMouseLeave = () => {
      if (!sustain && !sustainToggle) {
        onRelease();
      }
    };

    return (
      <button
        key={`${stringIndex}-${fret}`}
        ref={touchHandlers.ref as React.RefObject<HTMLButtonElement>}
        className={`
        relative w-12 h-8 border border-gray-300 transition-all duration-100
        ${isPressed ? "bg-blue-500 scale-95" : "bg-gray-100 hover:bg-gray-200"}
        ${isHighlighted ? "ring-2 ring-yellow-400" : ""}
        ${isScaleNote ? "bg-green-100" : ""}
        ${fret === 0 ? "brightness-70" : ""}
        touch-manipulation
      `}
        onMouseDown={onPress}
        onMouseUp={onRelease}
        onMouseLeave={handleMouseLeave}
      >
        {showNoteNames && (
          <span
            className={`text-xs ${isPressed ? "text-white" : "text-gray-700"}`}
          >
            {position.note}
          </span>
        )}
      </button>
    );
  },
);

export const FretboardBase = React.memo<FretboardBaseProps>(
  ({
    config,
    positions,
    onFretPress,
    onFretRelease,
    className = "",
    sustain = false,
    sustainToggle = false,
  }) => {
    const {
      strings,
      frets,
      showNoteNames = true,
      showFretNumbers = true,
      highlightFrets = [],
    } = config;

    // Memoize expensive computations
    const getFretPosition = React.useCallback(
      (stringIndex: number, fret: number): FretPosition | undefined => {
        return positions.find(
          (pos) => pos.string === stringIndex && pos.fret === fret,
        );
      },
      [positions],
    );

    // Memoize fret rendering to avoid unnecessary re-renders
    const renderFret = React.useCallback(
      (stringIndex: number, fret: number) => {
        const position = getFretPosition(stringIndex, fret);
        if (!position) return null;

        return (
          <FretButton
            key={`${stringIndex}-${fret}`}
            stringIndex={stringIndex}
            fret={fret}
            position={position}
            onPress={() => onFretPress(stringIndex, fret, position.note)}
            onRelease={() => onFretRelease(stringIndex, fret, position.note)}
            showNoteNames={showNoteNames}
            sustain={sustain}
            sustainToggle={sustainToggle}
          />
        );
      },
      [
        getFretPosition,
        onFretPress,
        onFretRelease,
        showNoteNames,
        sustain,
        sustainToggle,
      ],
    );

    // Memoize fret numbers rendering
    const renderFretNumbers = React.useMemo(() => {
      if (!showFretNumbers) return null;

      return (
        <div className="flex mb-2">
          {Array.from({ length: frets + 1 }, (_, fret) => (
            <div key={fret} className="w-12 text-center text-xs text-gray-500">
              {highlightFrets?.includes(fret) ? (
                <span className="text-yellow-500">{fret}</span>
              ) : (
                fret
              )}
            </div>
          ))}
        </div>
      );
    }, [showFretNumbers, frets, highlightFrets]);

    return (
      <div className={`fretboard-base mx-auto p-3 ${className}`}>
        {renderFretNumbers}
        <div className="fretboard-grid">
          {strings.map((_stringName, stringIndex) => (
            <div key={stringIndex} className="flex items-center mb-1">
              <div className="flex">
                {Array.from({ length: frets + 1 }, (_, fret) =>
                  renderFret(stringIndex, fret),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);
