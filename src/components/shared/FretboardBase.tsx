import React from 'react';
import { useTouchEvents } from '../../hooks/useTouchEvents';

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
  mode: 'melody' | 'chord' | 'octave';
  showNoteNames?: boolean;
  showFretNumbers?: boolean;
  highlightScaleNotes?: boolean;
}

export interface FretboardBaseProps {
  config: FretboardConfig;
  positions: FretPosition[];
  onFretPress: (stringIndex: number, fret: number, note: string) => void;
  onFretRelease: (stringIndex: number, fret: number, note: string) => void;
  className?: string;
}

// Separate component for fret button to use hooks properly
const FretButton: React.FC<{
  stringIndex: number;
  fret: number;
  position: FretPosition;
  onPress: () => void;
  onRelease: () => void;
  showNoteNames?: boolean;
}> = ({ stringIndex, fret, position, onPress, onRelease, showNoteNames = true }) => {
  const touchHandlers = useTouchEvents({ onPress, onRelease });

  const isPressed = position.isPressed;
  const isHighlighted = position.isHighlighted;
  const isScaleNote = position.isScaleNote;

  return (
    <button
      key={`${stringIndex}-${fret}`}
      ref={touchHandlers.ref as React.RefObject<HTMLButtonElement>}
      className={`
        relative w-12 h-8 border border-gray-300 transition-all duration-100
        ${isPressed ? 'bg-blue-500 scale-95' : 'bg-gray-100 hover:bg-gray-200'}
        ${isHighlighted ? 'ring-2 ring-yellow-400' : ''}
        ${isScaleNote ? 'bg-green-100' : ''}
        ${fret === 0 ? 'border-l-4 border-l-gray-800' : ''}
        touch-manipulation
      `}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
    >
      {showNoteNames && (
        <span className={`text-xs ${isPressed ? 'text-white' : 'text-gray-700'}`}>
          {position.note}
        </span>
      )}
    </button>
  );
};

export const FretboardBase: React.FC<FretboardBaseProps> = ({
  config,
  positions,
  onFretPress,
  onFretRelease,
  className = "",
}) => {
  const { strings, frets, showNoteNames = true, showFretNumbers = true } = config;

  const getFretPosition = (stringIndex: number, fret: number): FretPosition | undefined => {
    return positions.find(pos => pos.string === stringIndex && pos.fret === fret);
  };

  const renderFret = (stringIndex: number, fret: number) => {
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
      />
    );
  };

  const renderFretNumbers = () => {
    if (!showFretNumbers) return null;
    
    return (
      <div className="flex mb-2 ml-10">
        {Array.from({ length: frets + 1 }, (_, fret) => (
          <div key={fret} className="w-12 text-center text-xs text-gray-500">
            {fret}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`fretboard-base mx-auto ${className}`}>
      {renderFretNumbers()}
      <div className="fretboard-grid">
        {strings.map((stringName, stringIndex) => (
          <div key={stringIndex} className="flex items-center mb-1">
            <div className="w-8 text-right text-sm text-gray-600 mr-2">
              {stringName}
            </div>
            <div className="flex">
              {Array.from({ length: frets + 1 }, (_, fret) => 
                renderFret(stringIndex, fret)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 