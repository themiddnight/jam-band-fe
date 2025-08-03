import React from 'react';
import { useTouchEvents } from '../../../hooks/useTouchEvents';
import type { PadButtonProps } from '../types/drumpad';

export const PadButton: React.FC<PadButtonProps> = ({
  pad,
  isEditMode,
  selectedPadForAssign,
  onPress,
  onRelease,
  onVolumeChange,
  availableSamples = []
}) => {
  const touchHandlers = useTouchEvents({ onPress, onRelease });

  // Handle slider click to preview sound with current volume
  const handleSliderClick = (e: React.MouseEvent) => {
    if (isEditMode && pad.sound) {
      e.stopPropagation(); // Prevent triggering the pad press
      // Pass true to indicate this is a slider click
      onPress(true);
    }
  };

  // Wrapper for button press to pass false for regular pad clicks
  const handleButtonPress = () => {
    onPress(false);
  };

  // Check if the pad's sound is available
  const isSoundAvailable = !pad.sound || availableSamples.includes(pad.sound);

  return (
    <div className="relative">
      <button
        className={`
          w-20 h-20 rounded-lg border-2 transition-all duration-100 flex flex-col items-center justify-center gap-1
          ${pad.isPressed ? 'scale-95 border-gray-800' : 
            isEditMode ? 'border-orange-400 animate-pulse' : 'border-gray-300'}
          ${isSoundAvailable ? pad.color : 'bg-gray-600'} 
          ${isSoundAvailable ? 'hover:brightness-110' : 'opacity-50 cursor-not-allowed'}
          ${isEditMode && selectedPadForAssign === pad.id ? 'ring-4 ring-yellow-400' : ''}
          ${!isSoundAvailable ? 'border-red-500' : ''}
          touch-manipulation
        `}
        ref={touchHandlers.ref as React.RefObject<HTMLButtonElement>}
        onMouseDown={handleButtonPress}
        onMouseUp={onRelease}
        onMouseLeave={onRelease}
        disabled={!isSoundAvailable}
      >
        <span className="text-xs font-bold text-white drop-shadow-lg">
          {pad.label}
        </span>
        <kbd className="kbd kbd-sm">
          {pad.keyboardShortcut.toUpperCase()}
        </kbd>
        {/* Show warning icon if sound is not available */}
        {!isSoundAvailable && (
          <div className="absolute top-1 right-1">
            <span className="text-red-500 text-xs">⚠️</span>
          </div>
        )}
      </button>
      
      {/* Volume Slider - Only show in edit mode */}
      {isEditMode && (
        <div className="absolute bottom-1 left-1 right-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={pad.volume || 1}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            onClick={handleSliderClick}
            className="range range-xs range-primary w-full cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}; 