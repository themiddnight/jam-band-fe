import { memo } from "react";
import type { KeyboardKey } from "../types/keyboard";
import { VirtualKeyButton } from "../../shared/VirtualKeyButton";

interface MelodyKeysProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  onKeyPress: (key: KeyboardKey) => void;
  onKeyRelease: (key: KeyboardKey) => void;
}

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
            <VirtualKeyButton
              key={`${key.note}-${key.keyboardKey}-${key.position}`}
              keyboardKey={key.keyboardKey}
              note={key.note}
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
            <VirtualKeyButton
              key={`${key.note}-${key.keyboardKey}-${key.position}`}
              keyboardKey={key.keyboardKey}
              note={key.note}
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
