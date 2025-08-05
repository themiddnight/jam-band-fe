import { ChordModifierType } from "../../../constants/chordModifierConfig";
import { DEFAULT_KEYBOARD_SHORTCUTS } from "../../../constants/keyboardShortcuts";
import { chordTriadKeys } from "../../../constants/virtualKeyboardKeys";
import type { Scale } from "../../../hooks/useScaleState";
import { useTouchEvents } from "../../../hooks/useTouchEvents";
import { getChordName } from "../../../utils/musicUtils";
import { ChordModifierButton } from "../../shared/ChordModifierButton";
import type { KeyboardKey } from "../types/keyboard";
import { memo } from "react";

// Memoized triad button component
const TriadButton = memo(
  ({
    keyName,
    index,
    isPressed,
    chordSuffix,
    rootNote,
    scale,
    onTriadPress,
    onTriadRelease,
  }: {
    keyName: string;
    index: number;
    isPressed: boolean;
    chordSuffix: string;
    rootNote: string;
    scale: Scale;
    onTriadPress: (index: number) => void;
    onTriadRelease: (index: number) => void;
  }) => {
    const triadTouchHandlers = useTouchEvents({
      onPress: () => onTriadPress(index),
      onRelease: () => onTriadRelease(index),
    });

    return (
      <button
        onMouseDown={() => onTriadPress(index)}
        onMouseUp={() => onTriadRelease(index)}
        onMouseLeave={() => onTriadRelease(index)}
        ref={triadTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
        className={`w-12 h-20 border-2 border-gray-300 bg-purple-100 hover:bg-purple-200 
              transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
              touch-manipulation
              ${isPressed ? "bg-purple-300 transform scale-95" : ""}`}
        style={{
          WebkitTapHighlightColor: "transparent",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          touchAction: "manipulation",
        }}
      >
        <span className="text-xs text-purple-800 font-bold">
          <kbd className="kbd kbd-sm">{keyName.toUpperCase()}</kbd>
        </span>
        <div className="text-center">
          <div className="text-xs text-purple-800">
            {getChordName(rootNote, scale, index)}
          </div>
          {chordSuffix && (
            <div className="text-xs text-purple-600 font-bold">
              {chordSuffix}
            </div>
          )}
        </div>
      </button>
    );
  },
);

TriadButton.displayName = "TriadButton";

// Memoized root note button component
const RootNoteButton = memo(
  ({
    keyData,
    isPressed,
    onKeyPress,
    onKeyRelease,
  }: {
    keyData: KeyboardKey;
    isPressed: boolean;
    onKeyPress: (key: KeyboardKey) => void;
    onKeyRelease: (key: KeyboardKey) => void;
  }) => {
    const keyTouchHandlers = useTouchEvents({
      onPress: () => onKeyPress(keyData),
      onRelease: () => onKeyRelease(keyData),
    });

    return (
      <button
        onMouseDown={() => onKeyPress(keyData)}
        onMouseUp={() => onKeyRelease(keyData)}
        onMouseLeave={() => onKeyRelease(keyData)}
        ref={keyTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
        className={`
        w-12 h-20 border-2 border-gray-300 bg-white hover:bg-gray-100 
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
        <span className="text-xs text-gray-600 font-bold">
          <kbd className="kbd kbd-sm">{keyData.keyboardKey?.toUpperCase()}</kbd>
        </span>
        <span className="text-xs text-gray-600">{keyData.note}</span>
      </button>
    );
  },
);

RootNoteButton.displayName = "RootNoteButton";

interface ChordKeysProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  pressedTriads: Set<number>;
  chordModifiers: Set<string>;
  scale: Scale;
  rootNote: string;
  onKeyPress: (key: KeyboardKey) => void;
  onKeyRelease: (key: KeyboardKey) => void;
  onTriadPress: (index: number) => void;
  onTriadRelease: (index: number) => void;
  onModifierPress: (modifier: string) => void;
  onModifierRelease: (modifier: string) => void;
}

export const ChordKeys: React.FC<ChordKeysProps> = ({
  virtualKeys,
  pressedKeys,
  pressedTriads,
  chordModifiers,
  scale,
  rootNote,
  onKeyPress,
  onKeyRelease,
  onTriadPress,
  onTriadRelease,
  onModifierPress,
  onModifierRelease,
}) => {
  const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;

  return (
    <div className="flex justify-center gap-10 flex-col-reverse flex-wrap sm:flex-row sm:flex-nowrap w-fit mx-auto">
      {/* Chord Modifiers Display */}
      <div className="text-center">
        <p className="text-white text-sm mb-2">
          Chord Modifiers (hold while playing triads)
        </p>
        <div className="flex gap-2 mb-4">
          <ChordModifierButton
            modifier={ChordModifierType.DOMINANT_7}
            shortcutKey={shortcuts.dominant7.key}
            isActive={chordModifiers.has(shortcuts.dominant7.key)}
            onPress={() => onModifierPress(shortcuts.dominant7.key)}
            onRelease={() => onModifierRelease(shortcuts.dominant7.key)}
          />
          <ChordModifierButton
            modifier={ChordModifierType.MAJOR_7}
            shortcutKey={shortcuts.major7.key}
            isActive={chordModifiers.has(shortcuts.major7.key)}
            onPress={() => onModifierPress(shortcuts.major7.key)}
            onRelease={() => onModifierRelease(shortcuts.major7.key)}
          />
        </div>

        <div className="flex gap-2 mb-4">
          <ChordModifierButton
            modifier={ChordModifierType.SUS2}
            shortcutKey={shortcuts.sus2.key}
            isActive={chordModifiers.has(shortcuts.sus2.key)}
            onPress={() => onModifierPress(shortcuts.sus2.key)}
            onRelease={() => onModifierRelease(shortcuts.sus2.key)}
          />
          <ChordModifierButton
            modifier={ChordModifierType.SUS4}
            shortcutKey={shortcuts.sus4.key}
            isActive={chordModifiers.has(shortcuts.sus4.key)}
            onPress={() => onModifierPress(shortcuts.sus4.key)}
            onRelease={() => onModifierRelease(shortcuts.sus4.key)}
          />
          <ChordModifierButton
            modifier={ChordModifierType.MAJ_MIN_TOGGLE}
            shortcutKey={shortcuts.majMinToggle.key}
            isActive={chordModifiers.has(shortcuts.majMinToggle.key)}
            onPress={() => onModifierPress(shortcuts.majMinToggle.key)}
            onRelease={() => onModifierRelease(shortcuts.majMinToggle.key)}
          />
        </div>
      </div>

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
              if (chordModifiers.has(shortcuts.sus2.key)) chordSuffix += "sus2";
              else if (chordModifiers.has(shortcuts.sus4.key))
                chordSuffix += "sus4";
              if (chordModifiers.has(shortcuts.dominant7.key))
                chordSuffix += chordSuffix ? "+7" : "7";
              else if (chordModifiers.has(shortcuts.major7.key))
                chordSuffix += chordSuffix ? "+M7" : "M7";
              if (chordModifiers.has(shortcuts.majMinToggle.key))
                chordSuffix = chordSuffix.includes("sus")
                  ? chordSuffix
                  : chordSuffix + (scale === "major" ? "m" : "M");

              return (
                <TriadButton
                  key={key}
                  keyName={key}
                  index={index}
                  isPressed={isPressed}
                  chordSuffix={chordSuffix}
                  rootNote={rootNote}
                  scale={scale}
                  onTriadPress={onTriadPress}
                  onTriadRelease={onTriadRelease}
                />
              );
            })}
          </div>
        </div>

        {/* Root Notes */}
        <div className="text-center">
          <p className="text-white text-sm mb-2">Root Notes</p>
          <div className="flex justify-center gap-1">
            {virtualKeys.map((key) => (
              <RootNoteButton
                key={`${key.note}-${key.keyboardKey}`}
                keyData={key}
                isPressed={pressedKeys.has(key.note)}
                onKeyPress={onKeyPress}
                onKeyRelease={onKeyRelease}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
