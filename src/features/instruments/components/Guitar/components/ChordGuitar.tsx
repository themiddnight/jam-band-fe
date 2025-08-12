import { ChordModifierType, type Scale, useTouchEvents, ChordModifierButton, InstrumentButton, getChordFromDegree, getChordName } from "@/features/ui";
import { DEFAULT_GUITAR_SHORTCUTS, getKeyDisplayName } from "../../../index";
import type { GuitarChord } from "../types/guitar";
import { useMemo, memo } from "react";

interface SimpleChordKeysProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  chordVoicing: number;
  pressedChords: Set<number>;
  chordModifiers: Set<string>;
  powerChordMode: boolean;
  onChordPress: (chordIndex: number) => void;
  onChordRelease: (chordIndex: number) => void;
  onStrumChord: (chordIndex: number, direction: "up" | "down") => void;
  onChordModifierChange: (modifiers: Set<string>) => void;
  onPowerChordModeChange: (powerChordMode: boolean) => void;
  // Add sustain state to prevent mouse leave issues
  sustain?: boolean;
  sustainToggle?: boolean;
}

// Memoized chord button component - moved outside main component
const ChordButton = memo(
  ({
    chordKey,
    chordModifiers,
    shortcuts,
    scaleState,
    powerChordMode,
    onChordPress,
    onChordRelease,
    sustain = false,
    sustainToggle = false,
  }: {
    chordKey: GuitarChord;
    chordModifiers: Set<string>;
    shortcuts: any;
    scaleState: {
      rootNote: string;
      scale: Scale;
    };
    powerChordMode: boolean;
    onChordPress: (chordIndex: number) => void;
    onChordRelease: (chordIndex: number) => void;
    sustain?: boolean;
    sustainToggle?: boolean;
  }) => {
    // Generate chord name based on current modifiers (like Keyboard)
    let chordSuffix = "";

    // For power chords, show just the root note name without any suffix
    if (powerChordMode) {
      chordSuffix = "";
    } else {
      if (chordModifiers.has(shortcuts.sus2.key)) chordSuffix += "sus2";
      else if (chordModifiers.has(shortcuts.sus4.key)) chordSuffix += "sus4";
      if (chordModifiers.has(shortcuts.dominant7.key))
        chordSuffix += chordSuffix ? "+7" : "7";
      else if (chordModifiers.has(shortcuts.major7.key))
        chordSuffix += chordSuffix ? "+M7" : "M7";
      if (chordModifiers.has(shortcuts.majMinToggle.key))
        chordSuffix = chordSuffix.includes("sus")
          ? chordSuffix
          : chordSuffix + (scaleState.scale === "major" ? "m" : "M");
    }

    return (
      <InstrumentButton
        keyboardKey={chordKey.keyboardKey}
        chordName={getChordName(
          scaleState.rootNote,
          scaleState.scale,
          chordKey.degree,
        )}
        chordSuffix={chordSuffix}
        isPressed={chordKey.isPressed}
        onPress={() => onChordPress(chordKey.degree)}
        onRelease={() => onChordRelease(chordKey.degree)}
        variant="chord"
        size="md"
        sustain={sustain}
        sustainToggle={sustainToggle}
      />
    );
  },
);

ChordButton.displayName = "ChordButton";

export const SimpleChordKeys: React.FC<SimpleChordKeysProps> = ({
  scaleState,
  chordVoicing,
  pressedChords,
  chordModifiers,
  powerChordMode,
  onChordPress,
  onChordRelease,
  onStrumChord,
  onChordModifierChange,
  onPowerChordModeChange,
  sustain = false,
  sustainToggle = false,
}) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  // Create touch handlers for strum buttons
  const strumUpTouchHandlers = useTouchEvents({
    onPress: () => {
      // Strum all pressed chords up (,) - uses 70% velocity
      // Call onStrumChord for all pressed chords simultaneously
      pressedChords.forEach((chordIndex) => {
        onStrumChord(chordIndex, "up");
      });
    },
    onRelease: () => {},
    isPlayButton: true,
  });

  const strumDownTouchHandlers = useTouchEvents({
    onPress: () => {
      // Strum all pressed chords down (.)
      // Call onStrumChord for all pressed chords simultaneously
      pressedChords.forEach((chordIndex) => {
        onStrumChord(chordIndex, "down");
      });
    },
    onRelease: () => {},
    isPlayButton: true,
  });

  // Convert shortcut keys to modifier names for chord generation
  const convertChordModifiers = (modifiers: Set<string>): Set<string> => {
    const convertedModifiers = new Set<string>();

    if (modifiers.has(shortcuts.dominant7.key)) {
      convertedModifiers.add(ChordModifierType.DOMINANT_7);
    }
    if (modifiers.has(shortcuts.major7.key)) {
      convertedModifiers.add(ChordModifierType.MAJOR_7);
    }
    if (modifiers.has(shortcuts.sus2.key)) {
      convertedModifiers.add(ChordModifierType.SUS2);
    }
    if (modifiers.has(shortcuts.sus4.key)) {
      convertedModifiers.add(ChordModifierType.SUS4);
    }
    if (modifiers.has(shortcuts.majMinToggle.key)) {
      convertedModifiers.add(ChordModifierType.MAJ_MIN_TOGGLE);
    }
    if (powerChordMode) {
      convertedModifiers.add(ChordModifierType.POWER_CHORD);
    }

    return convertedModifiers;
  };

  // Generate chord keys
  const chordKeys = useMemo(() => {
    const keys: GuitarChord[] = [];
    const chordKeyNames = shortcuts.chordNotes.key.split("");

    // Generate 7 chords (one for each scale degree)
    for (let i = 0; i < 7; i++) {
      const chordNotes = getChordFromDegree(
        scaleState.rootNote,
        scaleState.scale,
        i,
        chordVoicing,
        convertChordModifiers(chordModifiers),
      );

      keys.push({
        rootNote: scaleState.rootNote,
        scale: scaleState.scale,
        degree: i,
        notes: chordNotes,
        isPressed: pressedChords.has(i),
        keyboardKey: chordKeyNames[i],
      });
    }

    return keys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scaleState,
    chordVoicing,
    chordModifiers,
    pressedChords,
    shortcuts,
    powerChordMode,
  ]);

  return (
    <div className="flex justify-center items-center gap-10 flex-col flex-wrap sm:flex-row sm:flex-nowrap w-fit mx-auto">
      <div className="flex flex-col gap-2">
        {/* Chord Modifiers Display - exactly like Keyboard */}
        <div className="text-center">
          <p className="text-white text-sm mb-2">
            Chord Modifiers (hold while playing triads)
          </p>
          <div className="flex justify-center gap-2 mb-4">
            <ChordModifierButton
              modifier={ChordModifierType.DOMINANT_7}
              shortcutKey={shortcuts.dominant7.key}
              isActive={chordModifiers.has(shortcuts.dominant7.key)}
              onPress={() =>
                onChordModifierChange(
                  new Set([...chordModifiers, shortcuts.dominant7.key]),
                )
              }
              onRelease={() =>
                onChordModifierChange(
                  new Set(
                    [...chordModifiers].filter(
                      (m) => m !== shortcuts.dominant7.key,
                    ),
                  ),
                )
              }
            />
            <ChordModifierButton
              modifier={ChordModifierType.MAJOR_7}
              shortcutKey={shortcuts.major7.key}
              isActive={chordModifiers.has(shortcuts.major7.key)}
              onPress={() =>
                onChordModifierChange(
                  new Set([...chordModifiers, shortcuts.major7.key]),
                )
              }
              onRelease={() =>
                onChordModifierChange(
                  new Set(
                    [...chordModifiers].filter(
                      (m) => m !== shortcuts.major7.key,
                    ),
                  ),
                )
              }
            />
            <ChordModifierButton
              modifier={ChordModifierType.SUS2}
              shortcutKey={shortcuts.sus2.key}
              isActive={chordModifiers.has(shortcuts.sus2.key)}
              onPress={() =>
                onChordModifierChange(
                  new Set([...chordModifiers, shortcuts.sus2.key]),
                )
              }
              onRelease={() =>
                onChordModifierChange(
                  new Set(
                    [...chordModifiers].filter((m) => m !== shortcuts.sus2.key),
                  ),
                )
              }
            />
            <ChordModifierButton
              modifier={ChordModifierType.SUS4}
              shortcutKey={shortcuts.sus4.key}
              isActive={chordModifiers.has(shortcuts.sus4.key)}
              onPress={() =>
                onChordModifierChange(
                  new Set([...chordModifiers, shortcuts.sus4.key]),
                )
              }
              onRelease={() =>
                onChordModifierChange(
                  new Set(
                    [...chordModifiers].filter((m) => m !== shortcuts.sus4.key),
                  ),
                )
              }
            />
            <ChordModifierButton
              modifier={ChordModifierType.MAJ_MIN_TOGGLE}
              shortcutKey={shortcuts.majMinToggle.key}
              isActive={chordModifiers.has(shortcuts.majMinToggle.key)}
              onPress={() =>
                onChordModifierChange(
                  new Set([...chordModifiers, shortcuts.majMinToggle.key]),
                )
              }
              onRelease={() =>
                onChordModifierChange(
                  new Set(
                    [...chordModifiers].filter(
                      (m) => m !== shortcuts.majMinToggle.key,
                    ),
                  ),
                )
              }
            />
            <button
              onClick={() => onPowerChordModeChange(!powerChordMode)}
              className={`px-2 py-1 rounded text-xs touch-manipulation ${
                powerChordMode
                  ? "bg-purple-500 text-black"
                  : "bg-gray-600 text-gray-300"
              }`}
            >
              Power{" "}
              <kbd className="kbd kbd-sm">
                {getKeyDisplayName(shortcuts.powerChordToggle.key)}
              </kbd>
            </button>
          </div>
        </div>

        {/* Keys - exactly like Keyboard */}
        <div className="flex flex-col gap-4">
          {/* Triads */}
          <div className="text-center">
            <p className="text-white text-sm mb-2">
              {powerChordMode ? "Power Chords" : "Triads"}
            </p>
            <div className="flex justify-center gap-1">
              {chordKeys.map((chordKey, index) => (
                <ChordButton
                  key={index}
                  chordKey={chordKey}
                  chordModifiers={chordModifiers}
                  shortcuts={shortcuts}
                  scaleState={scaleState}
                  powerChordMode={powerChordMode}
                  onChordPress={onChordPress}
                  onChordRelease={onChordRelease}
                  sustain={sustain}
                  sustainToggle={sustainToggle}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Strum Buttons */}
      <div className="text-center">
        <div className="flex justify-center gap-4 flex-col lg:flex-row">
          <button
            onMouseDown={() => {
              // Strum all pressed chords up (,) - uses 70% velocity
              pressedChords.forEach((chordIndex) => {
                onStrumChord(chordIndex, "up");
              });
            }}
            ref={strumUpTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
            className="btn btn-primary btn-lg lg:btn-sm touch-manipulation"
            style={{
              WebkitTapHighlightColor: "transparent",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              touchAction: "manipulation",
            }}
          >
            Strum Up <kbd className="kbd kbd-sm">{getKeyDisplayName(",")}</kbd>
          </button>
          <button
            onMouseDown={() => {
              // Strum all pressed chords down (.)
              pressedChords.forEach((chordIndex) => {
                onStrumChord(chordIndex, "down");
              });
            }}
            ref={
              strumDownTouchHandlers.ref as React.RefObject<HTMLButtonElement>
            }
            className="btn btn-secondary btn-lg lg:btn-sm touch-manipulation"
            style={{
              WebkitTapHighlightColor: "transparent",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              touchAction: "manipulation",
            }}
          >
            Strum Down{" "}
            <kbd className="kbd kbd-sm">{getKeyDisplayName(".")}</kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
