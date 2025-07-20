import React from 'react';
import { useTouchEvents } from '../../../hooks/useTouchEvents';
import type { PadButtonProps } from '../types/drumpad';

export const PadButton: React.FC<PadButtonProps> = ({
  pad,
  isEditMode,
  selectedPadForAssign,
  onPress,
  onRelease,
  onVolumeChange
}) => {
  const touchHandlers = useTouchEvents(onPress, onRelease);

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

  return (
    <div className="relative">
      <button
        className={`
          w-20 h-20 rounded-lg border-2 transition-all duration-100 flex flex-col items-center justify-center gap-1
          ${pad.isPressed ? 'scale-95 border-gray-800' : 
            isEditMode ? 'border-orange-400 animate-pulse' : 'border-gray-300'}
          ${pad.color} hover:brightness-110
          ${isEditMode && selectedPadForAssign === pad.id ? 'ring-4 ring-yellow-400' : ''}
          touch-manipulation
        `}
        onMouseDown={handleButtonPress}
        onMouseUp={onRelease}
        onMouseLeave={onRelease}
        {...touchHandlers}
      >
        <span className="text-xs font-bold text-white drop-shadow-lg">
          {pad.label}
        </span>
        <kbd className="kbd kbd-sm">
          {pad.keyboardShortcut.toUpperCase()}
        </kbd>
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