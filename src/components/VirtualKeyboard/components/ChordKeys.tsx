import type { Scale } from "../../../hooks/useScaleState";
import { chordTriadKeys } from "../hooks/useVirtualKeyboard";
import type { KeyboardKey } from "../types/keyboard";

interface ChordKeysProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  pressedTriads: Set<number>;
  chordModifiers: Set<string>;
  scale: Scale;
  onKeyPress: (key: KeyboardKey) => void;
  onTriadPress: (index: number) => void;
}

export const ChordKeys: React.FC<ChordKeysProps> = ({
  virtualKeys,
  pressedKeys,
  pressedTriads,
  chordModifiers,
  scale,
  onKeyPress,
  onTriadPress,
}) => {
  return (
    <div className="flex justify-around gap-4">
      {/* Keys */}
      <div className="flex flex-col gap-4">
        {/* Triads */}
        <div className="text-center">
          <p className="text-white text-sm mb-2">Triads</p>
          <div className="flex justify-center gap-1">
            {chordTriadKeys.map((key, index) => {
              const isPressed = pressedTriads.has(index);

              // Generate chord name based on current modifiers
              let chordSuffix = "";
              if (chordModifiers.has("n")) chordSuffix += "sus2";
              else if (chordModifiers.has("m")) chordSuffix += "sus4";
              if (chordModifiers.has("i"))
                chordSuffix += chordSuffix ? "+7" : "7";
              else if (chordModifiers.has("o"))
                chordSuffix += chordSuffix ? "+M7" : "M7";
              if (chordModifiers.has("."))
                chordSuffix = chordSuffix.includes("sus")
                  ? chordSuffix
                  : chordSuffix + (scale === "major" ? "m" : "M");

              return (
                <button
                  key={key}
                  onMouseDown={() => onTriadPress(index)}
                  className={`w-12 h-20 border-2 border-gray-300 bg-purple-100 hover:bg-purple-200 
                          transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
                          ${
                            isPressed
                              ? "bg-purple-300 transform scale-95"
                              : ""
                          }`}
                >
                  <span className="text-xs text-purple-800 font-bold">
                    {key.toUpperCase()}
                  </span>
                  <div className="text-center">
                    <div className="text-xs text-purple-800">
                      {["I", "ii", "iii", "IV", "V", "vi", "vii"][index]}
                    </div>
                    {chordSuffix && (
                      <div className="text-xs text-purple-600 font-bold">
                        {chordSuffix}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Root Notes */}
        <div className="text-center">
          <p className="text-white text-sm mb-2">
            Root Notes
          </p>
          <div className="flex justify-center gap-1">
            {virtualKeys.map((key) => (
              <button
                key={`${key.note}-${key.keyboardKey}`}
                onMouseDown={() => onKeyPress(key)}
                className={`
                  w-12 h-20 border-2 border-gray-300 bg-white hover:bg-gray-100 
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

      {/* Chord Modifiers Display */}
      <div className="text-center">
        <p className="text-white text-sm mb-2">
          Chord Modifiers (hold while playing triads)
        </p>
        <div className="flex gap-2 mb-4">
          <div
            className={`px-2 py-1 rounded text-xs ${
              chordModifiers.has("i")
                ? "bg-yellow-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            I (dom7)
          </div>
          <div
            className={`px-2 py-1 rounded text-xs ${
              chordModifiers.has("o")
                ? "bg-yellow-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            O (maj7)
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div
            className={`px-2 py-1 rounded text-xs ${
              chordModifiers.has("n")
                ? "bg-green-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            N (sus2)
          </div>
          <div
            className={`px-2 py-1 rounded text-xs ${
              chordModifiers.has("m")
                ? "bg-green-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            M (sus4)
          </div>
          <div
            className={`px-2 py-1 rounded text-xs ${
              chordModifiers.has(".")
                ? "bg-blue-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            . (maj/min)
          </div>
        </div>
      </div>
      
    </div>
  );
};
