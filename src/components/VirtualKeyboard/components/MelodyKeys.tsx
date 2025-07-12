import type { KeyboardKey } from "../types/keyboard";

interface MelodyKeysProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  onKeyPress: (key: KeyboardKey) => void;
}

export const MelodyKeys: React.FC<MelodyKeysProps> = ({
  virtualKeys,
  pressedKeys,
  onKeyPress,
}) => {
  return (
    <div className="text-center">
      <p className="text-white text-sm mb-2">Scale Notes</p>
      <div className="space-y-2">
        {/* Upper row */}
        <div className="flex gap-1 justify-center">
          {virtualKeys
            .filter((key) => key.position >= 100)
            .map((key) => (
              <button
                key={`${key.note}-${key.keyboardKey}`}
                onMouseDown={() => onKeyPress(key)}
                className={`
                  w-12 h-24 border-2 border-gray-300 bg-blue-50 hover:bg-blue-100 
                  transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                  ${
                    pressedKeys.has(key.note)
                      ? "bg-blue-200 transform scale-95"
                      : ""
                  }
                `}
              >
                <span className="text-xs text-blue-800 font-bold">
                  {key.keyboardKey?.toUpperCase()}
                </span>
                <span className="text-xs text-blue-800">{key.note}</span>
              </button>
            ))}
        </div>

        {/* Lower row */}
        <div className="flex gap-1 justify-center">
          {virtualKeys
            .filter((key) => key.position < 100)
            .map((key) => (
              <button
                key={`${key.note}-${key.keyboardKey}`}
                onMouseDown={() => onKeyPress(key)}
                className={`
                  w-12 h-32 border-2 border-gray-300 bg-white hover:bg-gray-100 
                  transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                  ${
                    pressedKeys.has(key.note)
                      ? "bg-gray-200 transform scale-95"
                      : ""
                  }
                `}
              >
                <span className="text-xs text-gray-600 font-bold">
                  {key.keyboardKey?.toUpperCase()}
                </span>
                <span className="text-xs text-gray-600">{key.note}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
