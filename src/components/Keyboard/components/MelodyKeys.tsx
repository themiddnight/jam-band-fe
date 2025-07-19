import { memo } from "react";
import type { KeyboardKey } from "../types/keyboard";
import { useTouchEvents } from "../../../hooks/useTouchEvents";

interface MelodyKeysProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  onKeyPress: (key: KeyboardKey) => void;
  onKeyRelease: (key: KeyboardKey) => void;
}

// Memoized key component to prevent unnecessary re-renders
const MelodyKeyButton = memo(({ 
  keyData, 
  isPressed, 
  onPress, 
  onRelease 
}: {
  keyData: KeyboardKey;
  isPressed: boolean;
  onPress: () => void;
  onRelease: () => void;
}) => {
  const touchHandlers = useTouchEvents(onPress, onRelease);

  return (
    <button
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      {...touchHandlers}
      className={`
        w-12 h-24 border-2 border-gray-300 bg-white hover:bg-gray-100 
        transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
        touch-manipulation
        ${isPressed ? "bg-gray-200 transform scale-95" : ""}
      `}
      style={{
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation'
      }}
    >
      <div className="w-full h-full" />
      <span className="text-xs text-gray-600 font-bold">
        <kbd className="kbd kbd-sm">{keyData.keyboardKey?.toUpperCase()}</kbd>
      </span>
      <span className="text-xs text-gray-600">{keyData.note}</span>
    </button>
  );
});

MelodyKeyButton.displayName = 'MelodyKeyButton';

export const MelodyKeys = memo<MelodyKeysProps>(({
  virtualKeys,
  pressedKeys,
  onKeyPress,
  onKeyRelease,
}) => {
  // Separate keys by position for better organization
  const lowerRowKeys = virtualKeys.filter(key => key.position < 100);
  const upperRowKeys = virtualKeys.filter(key => key.position >= 100);

  return (
    <div className="flex flex-col gap-4 w-fit mx-auto">
      {/* Upper row */}
      {upperRowKeys.length > 0 && (
        <div className="flex justify-center gap-1">
          {upperRowKeys.map((key) => (
            <MelodyKeyButton
              key={`${key.note}-${key.keyboardKey}-${key.position}`}
              keyData={key}
              isPressed={pressedKeys.has(key.note)}
              onPress={() => onKeyPress(key)}
              onRelease={() => onKeyRelease(key)}
            />
          ))}
        </div>
      )}

      {/* Lower row */}
      {lowerRowKeys.length > 0 && (
        <div className="flex justify-center gap-1">
          {lowerRowKeys.map((key) => (
            <MelodyKeyButton
              key={`${key.note}-${key.keyboardKey}-${key.position}`}
              keyData={key}
              isPressed={pressedKeys.has(key.note)}
              onPress={() => onKeyPress(key)}
              onRelease={() => onKeyRelease(key)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

MelodyKeys.displayName = 'MelodyKeys';
