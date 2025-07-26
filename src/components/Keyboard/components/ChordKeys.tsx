import { useKeyboardShortcutsStore } from "../../../stores/keyboardShortcutsStore";
import type { Scale } from "../../../hooks/useScaleState";
import { chordTriadKeys } from "../../../constants/virtualKeyboardKeys";
import type { KeyboardKey } from "../types/keyboard";
import { useTouchEvents } from "../../../hooks/useTouchEvents";
import { memo } from "react";
import { getChordName } from "../../../utils/musicUtils";

// Memoized triad button component
const TriadButton = memo(({
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
  const triadTouchHandlers = useTouchEvents(
    () => onTriadPress(index),
    () => onTriadRelease(index)
  );

  return (
    <button
      onMouseDown={() => onTriadPress(index)}
      onMouseUp={() => onTriadRelease(index)}
      onMouseLeave={() => onTriadRelease(index)}
      {...triadTouchHandlers}
      className={`w-12 h-20 border-2 border-gray-300 bg-purple-100 hover:bg-purple-200 
              transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
              touch-manipulation
              ${
                isPressed
                  ? "bg-purple-300 transform scale-95"
                  : ""
              }`}
      style={{
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation'
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
});

TriadButton.displayName = 'TriadButton';

// Memoized root note button component
const RootNoteButton = memo(({ 
  keyData, 
  isPressed, 
  onKeyPress, 
  onKeyRelease 
}: {
  keyData: KeyboardKey;
  isPressed: boolean;
  onKeyPress: (key: KeyboardKey) => void;
  onKeyRelease: (key: KeyboardKey) => void;
}) => {
  const keyTouchHandlers = useTouchEvents(
    () => onKeyPress(keyData),
    () => onKeyRelease(keyData)
  );

  return (
    <button
      onMouseDown={() => onKeyPress(keyData)}
      onMouseUp={() => onKeyRelease(keyData)}
      onMouseLeave={() => onKeyRelease(keyData)}
      {...keyTouchHandlers}
      className={`
        w-12 h-20 border-2 border-gray-300 bg-white hover:bg-gray-100 
        transition-colors duration-75 focus:outline-none flex flex-col justify-between p-1
        touch-manipulation
        ${
          isPressed
            ? "bg-gray-200 transform scale-95"
            : ""
        }
      `}
      style={{
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation'
      }}
    >
      <span className="text-xs text-gray-600 font-bold">
        <kbd className="kbd kbd-sm">{keyData.keyboardKey?.toUpperCase()}</kbd>
      </span>
      <span className="text-xs text-gray-600">{keyData.note}</span>
    </button>
  );
});

RootNoteButton.displayName = 'RootNoteButton';

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
  const shortcuts = useKeyboardShortcutsStore((state) => state.shortcuts);
  
  // Create touch handlers for modifiers
  const dominant7TouchHandlers = useTouchEvents(
    () => onModifierPress(shortcuts.dominant7.key),
    () => onModifierRelease(shortcuts.dominant7.key)
  );
  
  const major7TouchHandlers = useTouchEvents(
    () => onModifierPress(shortcuts.major7.key),
    () => onModifierRelease(shortcuts.major7.key)
  );
  
  const sus2TouchHandlers = useTouchEvents(
    () => onModifierPress(shortcuts.sus2.key),
    () => onModifierRelease(shortcuts.sus2.key)
  );
  
  const sus4TouchHandlers = useTouchEvents(
    () => onModifierPress(shortcuts.sus4.key),
    () => onModifierRelease(shortcuts.sus4.key)
  );
  
  const majMinToggleTouchHandlers = useTouchEvents(
    () => onModifierPress(shortcuts.majMinToggle.key),
    () => onModifierRelease(shortcuts.majMinToggle.key)
  );
  
  return (
    <div className="flex justify-center gap-10 flex-wrap sm:flex-nowrap w-fit mx-auto">
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
              else if (chordModifiers.has(shortcuts.sus4.key)) chordSuffix += "sus4";
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
          <p className="text-white text-sm mb-2">
            Root Notes
          </p>
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

      {/* Chord Modifiers Display */}
      <div className="text-center">
        <p className="text-white text-sm mb-2">
          Chord Modifiers (hold while playing triads)
        </p>
        <div className="flex gap-2 mb-4">
          <button
            onMouseDown={() => onModifierPress(shortcuts.dominant7.key)}
            onMouseUp={() => onModifierRelease(shortcuts.dominant7.key)}
            onMouseLeave={() => onModifierRelease(shortcuts.dominant7.key)}
            {...dominant7TouchHandlers}
            className={`px-2 py-1 rounded text-xs touch-manipulation ${
              chordModifiers.has(shortcuts.dominant7.key)
                ? "bg-yellow-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            dom7 <kbd className="kbd kbd-sm">{shortcuts.dominant7.key.toUpperCase()}</kbd>
          </button>
          <button
            onMouseDown={() => onModifierPress(shortcuts.major7.key)}
            onMouseUp={() => onModifierRelease(shortcuts.major7.key)}
            onMouseLeave={() => onModifierRelease(shortcuts.major7.key)}
            {...major7TouchHandlers}
            className={`px-2 py-1 rounded text-xs touch-manipulation ${
              chordModifiers.has(shortcuts.major7.key)
                ? "bg-yellow-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            maj7 <kbd className="kbd kbd-sm">{shortcuts.major7.key.toUpperCase()}</kbd>
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onMouseDown={() => onModifierPress(shortcuts.sus2.key)}
            onMouseUp={() => onModifierRelease(shortcuts.sus2.key)}
            onMouseLeave={() => onModifierRelease(shortcuts.sus2.key)}
            {...sus2TouchHandlers}
            className={`px-2 py-1 rounded text-xs touch-manipulation ${
              chordModifiers.has(shortcuts.sus2.key)
                ? "bg-green-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            sus2 <kbd className="kbd kbd-sm">{shortcuts.sus2.key.toUpperCase()}</kbd>
          </button>
          <button
            onMouseDown={() => onModifierPress(shortcuts.sus4.key)}
            onMouseUp={() => onModifierRelease(shortcuts.sus4.key)}
            onMouseLeave={() => onModifierRelease(shortcuts.sus4.key)}
            {...sus4TouchHandlers}
            className={`px-2 py-1 rounded text-xs touch-manipulation ${
              chordModifiers.has(shortcuts.sus4.key)
                ? "bg-green-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            sus4 <kbd className="kbd kbd-sm">{shortcuts.sus4.key.toUpperCase()}</kbd>
          </button>
          <button
            onMouseDown={() => onModifierPress(shortcuts.majMinToggle.key)}
            onMouseUp={() => onModifierRelease(shortcuts.majMinToggle.key)}
            onMouseLeave={() => onModifierRelease(shortcuts.majMinToggle.key)}
            {...majMinToggleTouchHandlers}
            className={`px-2 py-1 rounded text-xs touch-manipulation ${
              chordModifiers.has(shortcuts.majMinToggle.key)
                ? "bg-blue-500 text-black"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            maj/min <kbd className="kbd kbd-sm">{shortcuts.majMinToggle.key.toUpperCase()}</kbd>
          </button>
        </div>
      </div>
      
    </div>
  );
};
