import { useTouchEvents } from "../../../hooks/useTouchEvents";
import type { KeyboardKey } from "../types/keyboard";
import { memo } from "react";

interface AdvancedKeysProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  onKeyPress: (key: KeyboardKey) => void;
  onKeyRelease: (key: KeyboardKey) => void;
}

// Memoized key button component
const KeyButton = memo(
  ({
    keyData,
    isPressed,
    onKeyPress,
    onKeyRelease,
    isBlack = false,
    position = 0,
  }: {
    keyData: KeyboardKey;
    isPressed: boolean;
    onKeyPress: (key: KeyboardKey) => void;
    onKeyRelease: (key: KeyboardKey) => void;
    isBlack?: boolean;
    position?: number;
  }) => {
    const keyTouchHandlers = useTouchEvents({
      onPress: () => onKeyPress(keyData),
      onRelease: () => onKeyRelease(keyData),
    });

    if (isBlack) {
      return (
        <button
          onMouseDown={() => onKeyPress(keyData)}
          onMouseUp={() => onKeyRelease(keyData)}
          onMouseLeave={() => onKeyRelease(keyData)}
          ref={keyTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          className={`
        absolute w-8 h-24 bg-black hover:bg-gray-800 border border-gray-600
        transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
        touch-manipulation
        ${isPressed ? "bg-gray-600 transform scale-95" : ""}
      `}
          style={{
            left: `${position * 48 + 8}px`,
            zIndex: 2,
            WebkitTapHighlightColor: "transparent",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            touchAction: "manipulation",
          }}
        >
          <div className="w-full h-full" />
          <span className="text-xs text-white font-bold">
            <kbd className="kbd kbd-sm">
              {keyData.keyboardKey?.toUpperCase()}
            </kbd>
          </span>
          <span className="text-xs text-white">{keyData.note}</span>
        </button>
      );
    }

    return (
      <button
        onMouseDown={() => onKeyPress(keyData)}
        onMouseUp={() => onKeyRelease(keyData)}
        onMouseLeave={() => onKeyRelease(keyData)}
        ref={keyTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
        className={`
      w-12 h-40 border-2 border-gray-300 bg-white hover:bg-gray-100 
      transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
      touch-manipulation
      ${isPressed ? "bg-gray-200 transform scale-95" : ""}
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
          <kbd className="kbd kbd-sm">{keyData.keyboardKey?.toUpperCase()}</kbd>
        </span>
        <span className="text-xs text-gray-600">{keyData.note}</span>
      </button>
    );
  },
);

KeyButton.displayName = "KeyButton";

export const AdvancedKeys: React.FC<AdvancedKeysProps> = ({
  virtualKeys,
  pressedKeys,
  onKeyPress,
  onKeyRelease,
}) => {
  return (
    <div className="relative flex justify-center w-fit mx-auto">
      <div className="relative flex">
        {virtualKeys
          .filter((key) => !key.isBlack)
          .map((key) => (
            <KeyButton
              key={`${key.note}-${key.keyboardKey}`}
              keyData={key}
              isPressed={pressedKeys.has(key.note)}
              onKeyPress={onKeyPress}
              onKeyRelease={onKeyRelease}
            />
          ))}

        {virtualKeys
          .filter((key) => key.isBlack)
          .map((key) => (
            <KeyButton
              key={`${key.note}-${key.keyboardKey}`}
              keyData={key}
              isPressed={pressedKeys.has(key.note)}
              onKeyPress={onKeyPress}
              onKeyRelease={onKeyRelease}
              isBlack={true}
              position={key.position}
            />
          ))}
      </div>
    </div>
  );
};
