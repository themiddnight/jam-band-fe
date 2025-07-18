import React from 'react';

export interface VirtualKey {
  id: string;
  note: string;
  isBlack: boolean;
  position: number;
  keyboardShortcut?: string;
  isPressed: boolean;
  isHighlighted?: boolean;
  isScaleNote?: boolean;
}

export interface VirtualKeyboardConfig {
  layout: 'piano' | 'scale' | 'chord';
  showKeyLabels?: boolean;
  showNoteNames?: boolean;
  highlightScaleNotes?: boolean;
  octaveSpan?: number;
}

export interface VirtualKeyboardBaseProps {
  config: VirtualKeyboardConfig;
  keys: VirtualKey[];
  onKeyPress: (key: VirtualKey) => void;
  onKeyRelease: (key: VirtualKey) => void;
  className?: string;
}

export const VirtualKeyboardBase: React.FC<VirtualKeyboardBaseProps> = ({
  config,
  keys,
  onKeyPress,
  onKeyRelease,
  className = "",
}) => {
  const { layout, showKeyLabels = true, showNoteNames = true } = config;

  const renderPianoKey = (key: VirtualKey) => {
    const isBlack = key.isBlack;
    const isPressed = key.isPressed;
    const isHighlighted = key.isHighlighted;
    const isScaleNote = key.isScaleNote;

    return (
      <button
        key={key.id}
        className={`
          ${isBlack ? 'w-8 h-24 -mx-1 z-10' : 'w-12 h-40 z-0'}
          ${isBlack ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'}
          ${isPressed ? (isBlack ? 'bg-gray-600' : 'bg-gray-200') : ''}
          ${isHighlighted ? 'ring-2 ring-yellow-400' : ''}
          ${isScaleNote && !isBlack ? 'bg-blue-50' : ''}
          border-2 border-gray-300 transition-all duration-75 
          focus:outline-none flex flex-col justify-between p-1
          ${isPressed ? 'transform scale-95' : ''}
        `}
        style={{
          position: 'relative',
          left: isBlack ? `${-4}px` : '0px',
          marginLeft: isBlack ? '0' : '1px',
          marginRight: isBlack ? '0' : '1px',
        }}
        onMouseDown={() => onKeyPress(key)}
        onMouseUp={() => onKeyRelease(key)}
        onMouseLeave={() => onKeyRelease(key)}
      >
        <div className="w-full h-full" />
        {showKeyLabels && key.keyboardShortcut && (
          <span className={`text-xs font-bold ${isBlack ? 'text-white' : 'text-gray-600'}`}>
            {key.keyboardShortcut.toUpperCase()}
          </span>
        )}
        {showNoteNames && (
          <span className={`text-xs ${isBlack ? 'text-white' : 'text-gray-600'}`}>
            {key.note}
          </span>
        )}
      </button>
    );
  };

  const renderScaleKey = (key: VirtualKey) => {
    const isPressed = key.isPressed;
    const isHighlighted = key.isHighlighted;

    return (
      <button
        key={key.id}
        className={`
          w-12 h-24 border-2 border-gray-300 transition-all duration-75 
          focus:outline-none flex flex-col justify-between p-1
          ${isPressed ? 'bg-blue-200 transform scale-95' : 'bg-blue-50 hover:bg-blue-100'}
          ${isHighlighted ? 'ring-2 ring-yellow-400' : ''}
        `}
        onMouseDown={() => onKeyPress(key)}
        onMouseUp={() => onKeyRelease(key)}
        onMouseLeave={() => onKeyRelease(key)}
      >
        {showKeyLabels && key.keyboardShortcut && (
          <span className="text-xs text-blue-800 font-bold">
            {key.keyboardShortcut.toUpperCase()}
          </span>
        )}
        {showNoteNames && (
          <span className="text-xs text-blue-800">{key.note}</span>
        )}
      </button>
    );
  };

  const renderChordKey = (key: VirtualKey) => {
    const isPressed = key.isPressed;
    const isHighlighted = key.isHighlighted;

    return (
      <button
        key={key.id}
        className={`
          w-16 h-24 border-2 border-gray-300 transition-all duration-75 
          focus:outline-none flex flex-col justify-between p-1
          ${isPressed ? 'bg-purple-200 transform scale-95' : 'bg-purple-50 hover:bg-purple-100'}
          ${isHighlighted ? 'ring-2 ring-yellow-400' : ''}
        `}
        onMouseDown={() => onKeyPress(key)}
        onMouseUp={() => onKeyRelease(key)}
        onMouseLeave={() => onKeyRelease(key)}
      >
        {showKeyLabels && key.keyboardShortcut && (
          <span className="text-xs text-purple-800 font-bold">
            {key.keyboardShortcut.toUpperCase()}
          </span>
        )}
        {showNoteNames && (
          <span className="text-xs text-purple-800">{key.note}</span>
        )}
      </button>
    );
  };

  const renderKeys = () => {
    switch (layout) {
      case 'piano':
        return (
          <div className="relative flex justify-center">
            <div className="relative flex">
              {keys.map(renderPianoKey)}
            </div>
          </div>
        );
      case 'scale':
        return (
          <div className="flex gap-1 justify-center flex-wrap">
            {keys.map(renderScaleKey)}
          </div>
        );
      case 'chord':
        return (
          <div className="flex gap-1 justify-center flex-wrap">
            {keys.map(renderChordKey)}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`virtual-keyboard-base ${className}`}>
      {renderKeys()}
    </div>
  );
}; 