import React from 'react';
import { useTouchEvents } from '../../hooks/useTouchEvents';

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

// Separate component for piano key to use hooks properly
const PianoKey: React.FC<{
  virtualKey: VirtualKey;
  onPress: () => void;
  onRelease: () => void;
  showKeyLabels?: boolean;
  showNoteNames?: boolean;
}> = ({ virtualKey, onPress, onRelease, showKeyLabels = true, showNoteNames = true }) => {
  const touchHandlers = useTouchEvents(onPress, onRelease);

  const isBlack = virtualKey.isBlack;
  const isPressed = virtualKey.isPressed;
  const isHighlighted = virtualKey.isHighlighted;
  const isScaleNote = virtualKey.isScaleNote;

  return (
    <button
      key={virtualKey.id}
      className={`
        ${isBlack ? 'w-8 h-24 -mx-1 z-10' : 'w-12 h-40 z-0'}
        ${isBlack ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'}
        ${isPressed ? (isBlack ? 'bg-gray-600' : 'bg-gray-200') : ''}
        ${isHighlighted ? 'ring-2 ring-yellow-400' : ''}
        ${isScaleNote && !isBlack ? 'bg-blue-50' : ''}
        border-2 border-gray-300 transition-all duration-75 
        focus:outline-none flex flex-col justify-between p-1
        ${isPressed ? 'transform scale-95' : ''}
        touch-manipulation
      `}
      style={{
        position: 'relative',
        left: isBlack ? `${-4}px` : '0px',
        marginLeft: isBlack ? '0' : '1px',
        marginRight: isBlack ? '0' : '1px',
      }}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      {...touchHandlers}
    >
      <div className="w-full h-full" />
      {showKeyLabels && virtualKey.keyboardShortcut && (
        <span className={`text-xs font-bold ${isBlack ? 'text-white' : 'text-gray-600'}`}>
          {virtualKey.keyboardShortcut.toUpperCase()}
        </span>
      )}
      {showNoteNames && (
        <span className={`text-xs ${isBlack ? 'text-white' : 'text-gray-600'}`}>
          {virtualKey.note}
        </span>
      )}
    </button>
  );
};

// Separate component for scale key to use hooks properly
const ScaleKey: React.FC<{
  virtualKey: VirtualKey;
  onPress: () => void;
  onRelease: () => void;
  showKeyLabels?: boolean;
  showNoteNames?: boolean;
}> = ({ virtualKey, onPress, onRelease, showKeyLabels = true, showNoteNames = true }) => {
  const touchHandlers = useTouchEvents(onPress, onRelease);

  const isPressed = virtualKey.isPressed;
  const isHighlighted = virtualKey.isHighlighted;

  return (
    <button
      key={virtualKey.id}
      className={`
        w-12 h-24 border-2 border-gray-300 transition-all duration-75 
        focus:outline-none flex flex-col justify-between p-1
        ${isPressed ? 'bg-blue-200 transform scale-95' : 'bg-blue-50 hover:bg-blue-100'}
        ${isHighlighted ? 'ring-2 ring-yellow-400' : ''}
        touch-manipulation
      `}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      {...touchHandlers}
    >
      {showKeyLabels && virtualKey.keyboardShortcut && (
        <span className="text-xs text-blue-800 font-bold">
          {virtualKey.keyboardShortcut.toUpperCase()}
        </span>
      )}
      {showNoteNames && (
        <span className="text-xs text-blue-800">{virtualKey.note}</span>
      )}
    </button>
  );
};

// Separate component for chord key to use hooks properly
const ChordKey: React.FC<{
  virtualKey: VirtualKey;
  onPress: () => void;
  onRelease: () => void;
  showKeyLabels?: boolean;
  showNoteNames?: boolean;
}> = ({ virtualKey, onPress, onRelease, showKeyLabels = true, showNoteNames = true }) => {
  const touchHandlers = useTouchEvents(onPress, onRelease);

  const isPressed = virtualKey.isPressed;
  const isHighlighted = virtualKey.isHighlighted;

  return (
    <button
      key={virtualKey.id}
      className={`
        w-16 h-24 border-2 border-gray-300 transition-all duration-75 
        focus:outline-none flex flex-col justify-between p-1
        ${isPressed ? 'bg-purple-200 transform scale-95' : 'bg-purple-50 hover:bg-purple-100'}
        ${isHighlighted ? 'ring-2 ring-yellow-400' : ''}
        touch-manipulation
      `}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      {...touchHandlers}
    >
      {showKeyLabels && virtualKey.keyboardShortcut && (
        <span className="text-xs text-purple-800 font-bold">
          {virtualKey.keyboardShortcut.toUpperCase()}
        </span>
      )}
      {showNoteNames && (
        <span className="text-xs text-purple-800">{virtualKey.note}</span>
      )}
    </button>
  );
};

export const VirtualKeyboardBase: React.FC<VirtualKeyboardBaseProps> = ({
  config,
  keys,
  onKeyPress,
  onKeyRelease,
  className = "",
}) => {
  const { layout, showKeyLabels = true, showNoteNames = true } = config;

  const renderPianoKey = (key: VirtualKey) => (
    <PianoKey
      key={key.id}
      virtualKey={key}
      onPress={() => onKeyPress(key)}
      onRelease={() => onKeyRelease(key)}
      showKeyLabels={showKeyLabels}
      showNoteNames={showNoteNames}
    />
  );

  const renderScaleKey = (key: VirtualKey) => (
    <ScaleKey
      key={key.id}
      virtualKey={key}
      onPress={() => onKeyPress(key)}
      onRelease={() => onKeyRelease(key)}
      showKeyLabels={showKeyLabels}
      showNoteNames={showNoteNames}
    />
  );

  const renderChordKey = (key: VirtualKey) => (
    <ChordKey
      key={key.id}
      virtualKey={key}
      onPress={() => onKeyPress(key)}
      onRelease={() => onKeyRelease(key)}
      showKeyLabels={showKeyLabels}
      showNoteNames={showNoteNames}
    />
  );

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