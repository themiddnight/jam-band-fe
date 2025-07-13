import type { KeyboardKey } from "../types/keyboard";

interface AdvancedKeysProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  onKeyPress: (key: KeyboardKey) => void;
}

export const AdvancedKeys: React.FC<AdvancedKeysProps> = ({
  virtualKeys,
  pressedKeys,
  onKeyPress,
}) => {
  return (
    <div className="relative flex justify-center">
      <div className="relative flex">
        {virtualKeys
          .filter((key) => !key.isBlack)
          .map((key) => (
            <button
              key={`${key.note}-${key.keyboardKey}`}
              onMouseDown={() => onKeyPress(key)}
              className={`
              w-12 h-40 border-2 border-gray-300 bg-white hover:bg-gray-100 
              transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
              ${
                pressedKeys.has(key.note)
                  ? "bg-gray-200 transform scale-95"
                  : ""
              }
            `}
              style={{ zIndex: 1 }}
            >
              <div className="w-full h-full" />
              <span className="text-xs text-gray-600 font-bold">
                {key.keyboardKey?.toUpperCase()}
              </span>
              <span className="text-xs text-gray-600">{key.note}</span>
            </button>
          ))}

        {virtualKeys
          .filter((key) => key.isBlack)
          .map((key) => (
            <button
              key={`${key.note}-${key.keyboardKey}`}
              onMouseDown={() => onKeyPress(key)}
              className={`
              absolute w-8 h-24 bg-black hover:bg-gray-800 border border-gray-600
              transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
              ${
                pressedKeys.has(key.note)
                  ? "bg-gray-600 transform scale-95"
                  : ""
              }
            `}
              style={{
                left: `${key.position * 48 + 8}px`,
                zIndex: 2,
              }}
            >
              <div className="w-full h-full" />
              <span className="text-xs text-white font-bold">
                {key.keyboardKey?.toUpperCase()}
              </span>
              <span className="text-xs text-white">{key.note}</span>
            </button>
          ))}
      </div>
    </div>
  );
};
