import { useMemo, memo } from "react";
import { getKeyDisplayName, DEFAULT_GUITAR_SHORTCUTS } from "../../../constants/guitarShortcuts";
import { getChordFromDegree, getChordName } from "../../../utils/musicUtils";
import type { Scale } from "../../../hooks/useScaleState";
import type { GuitarChord } from "../types/guitar";
import { useTouchEvents } from "../../../hooks/useTouchEvents";
import { InstrumentButton } from "../../shared/InstrumentButton";

interface SimpleChordKeysProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  chordVoicing: number;
  pressedChords: Set<number>;
  chordModifiers: Set<string>;
  onChordPress: (chordIndex: number) => void;
  onChordRelease: (chordIndex: number) => void;
  onStrumChord: (chordIndex: number, direction: 'up' | 'down') => void;
  onChordModifierChange: (modifiers: Set<string>) => void;
}

// Memoized chord button component - moved outside main component
const ChordButton = memo(({
  chordKey,
  chordModifiers,
  shortcuts,
  scaleState,
  onChordPress,
  onChordRelease
}: {
  chordKey: GuitarChord;
  chordModifiers: Set<string>;
  shortcuts: any;
  scaleState: {
    rootNote: string;
    scale: Scale;
  };
  onChordPress: (chordIndex: number) => void;
  onChordRelease: (chordIndex: number) => void;
}) => {
  // Generate chord name based on current modifiers (like Keyboard)
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
      : chordSuffix + (scaleState.scale === "major" ? "m" : "M");

  return (
    <InstrumentButton
      keyboardKey={chordKey.keyboardKey}
      chordName={getChordName(scaleState.rootNote, scaleState.scale, chordKey.degree)}
      chordSuffix={chordSuffix}
      isPressed={chordKey.isPressed}
      onPress={() => onChordPress(chordKey.degree)}
      onRelease={() => onChordRelease(chordKey.degree)}
      variant="chord"
      size="md"
    />
  );
});

ChordButton.displayName = 'ChordButton';

export const SimpleChordKeys: React.FC<SimpleChordKeysProps> = ({
  scaleState,
  chordVoicing,
  pressedChords,
  chordModifiers,
  onChordPress,
  onChordRelease,
  onStrumChord,
  onChordModifierChange,
}) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  // Create touch handlers for strum buttons
  const strumUpTouchHandlers = useTouchEvents({
    onPress: () => {
      // Strum all pressed chords up (,) - uses 70% velocity
      for (const chordIndex of pressedChords) {
        onStrumChord(chordIndex, 'up');
      }
    },
    onRelease: () => { },
    isPlayButton: true
  });

  const strumDownTouchHandlers = useTouchEvents({
    onPress: () => {
      // Strum all pressed chords down (.)
      for (const chordIndex of pressedChords) {
        onStrumChord(chordIndex, 'down');
      }
    },
    onRelease: () => { },
    isPlayButton: true
  });

  // Convert shortcut keys to modifier names for chord generation
  const convertChordModifiers = (modifiers: Set<string>): Set<string> => {
    const convertedModifiers = new Set<string>();

    if (modifiers.has('q')) {
      convertedModifiers.add("dominant7");
    }
    if (modifiers.has('w')) {
      convertedModifiers.add("major7");
    }
    if (modifiers.has('e')) {
      convertedModifiers.add("sus2");
    }
    if (modifiers.has('r')) {
      convertedModifiers.add("sus4");
    }
    if (modifiers.has('t')) {
      convertedModifiers.add("majMinToggle");
    }

    return convertedModifiers;
  };

  // Generate chord keys
  const chordKeys = useMemo(() => {
    const keys: GuitarChord[] = [];
    const chordKeyNames = shortcuts.chordNotes.key.split('');

    // Generate 7 chords (one for each scale degree)
    for (let i = 0; i < 7; i++) {
      const chordNotes = getChordFromDegree(
        scaleState.rootNote,
        scaleState.scale,
        i,
        chordVoicing,
        convertChordModifiers(chordModifiers)
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
  }, [scaleState, chordVoicing, chordModifiers, pressedChords, shortcuts]);

  // Create touch handlers for modifiers (exactly like Keyboard)
  const dominant7TouchHandlers = useTouchEvents({
    onPress: () => onChordModifierChange(new Set([...chordModifiers, shortcuts.dominant7.key])),
    onRelease: () => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.dominant7.key)))
  });

  const major7TouchHandlers = useTouchEvents({
    onPress: () => onChordModifierChange(new Set([...chordModifiers, shortcuts.major7.key])),
    onRelease: () => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.major7.key)))
  });

  const sus2TouchHandlers = useTouchEvents({
    onPress: () => onChordModifierChange(new Set([...chordModifiers, shortcuts.sus2.key])),
    onRelease: () => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.sus2.key)))
  });

  const sus4TouchHandlers = useTouchEvents({
    onPress: () => onChordModifierChange(new Set([...chordModifiers, shortcuts.sus4.key])),
    onRelease: () => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.sus4.key)))
  });

  const majMinToggleTouchHandlers = useTouchEvents({
    onPress: () => onChordModifierChange(new Set([...chordModifiers, shortcuts.majMinToggle.key])),
    onRelease: () => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.majMinToggle.key)))
  });

  return (
    <div className="flex justify-center items-center gap-10 flex-col flex-wrap sm:flex-row sm:flex-nowrap w-fit mx-auto">
      <div className="flex flex-col gap-2">
        {/* Chord Modifiers Display - exactly like Keyboard */}
        <div className="text-center">
          <p className="text-white text-sm mb-2">
            Chord Modifiers (hold while playing triads)
          </p>
          <div className="flex justify-center gap-2 mb-4">
            <button
              onMouseDown={() => onChordModifierChange(new Set([...chordModifiers, shortcuts.dominant7.key]))}
              onMouseUp={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.dominant7.key)))}
              onMouseLeave={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.dominant7.key)))}
              ref={dominant7TouchHandlers.ref as React.RefObject<HTMLButtonElement>}
              className={`px-2 py-1 rounded text-xs touch-manipulation ${chordModifiers.has(shortcuts.dominant7.key)
                ? "bg-yellow-500 text-black"
                : "bg-gray-600 text-gray-300"
                }`}
            >
              dom7 <kbd className="kbd kbd-sm">{getKeyDisplayName(shortcuts.dominant7.key)}</kbd>
            </button>
            <button
              onMouseDown={() => onChordModifierChange(new Set([...chordModifiers, shortcuts.major7.key]))}
              onMouseUp={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.major7.key)))}
              onMouseLeave={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.major7.key)))}
              ref={major7TouchHandlers.ref as React.RefObject<HTMLButtonElement>}
              className={`px-2 py-1 rounded text-xs touch-manipulation ${chordModifiers.has(shortcuts.major7.key)
                ? "bg-yellow-500 text-black"
                : "bg-gray-600 text-gray-300"
                }`}
            >
              maj7 <kbd className="kbd kbd-sm">{getKeyDisplayName(shortcuts.major7.key)}</kbd>
            </button>

            <button
              onMouseDown={() => onChordModifierChange(new Set([...chordModifiers, shortcuts.sus2.key]))}
              onMouseUp={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.sus2.key)))}
              onMouseLeave={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.sus2.key)))}
              ref={sus2TouchHandlers.ref as React.RefObject<HTMLButtonElement>}
              className={`px-2 py-1 rounded text-xs touch-manipulation ${chordModifiers.has(shortcuts.sus2.key)
                ? "bg-green-500 text-black"
                : "bg-gray-600 text-gray-300"
                }`}
            >
              sus2 <kbd className="kbd kbd-sm">{getKeyDisplayName(shortcuts.sus2.key)}</kbd>
            </button>
            <button
              onMouseDown={() => onChordModifierChange(new Set([...chordModifiers, shortcuts.sus4.key]))}
              onMouseUp={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.sus4.key)))}
              onMouseLeave={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.sus4.key)))}
              ref={sus4TouchHandlers.ref as React.RefObject<HTMLButtonElement>}
              className={`px-2 py-1 rounded text-xs touch-manipulation ${chordModifiers.has(shortcuts.sus4.key)
                ? "bg-green-500 text-black"
                : "bg-gray-600 text-gray-300"
                }`}
            >
              sus4 <kbd className="kbd kbd-sm">{getKeyDisplayName(shortcuts.sus4.key)}</kbd>
            </button>
            <button
              onMouseDown={() => onChordModifierChange(new Set([...chordModifiers, shortcuts.majMinToggle.key]))}
              onMouseUp={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.majMinToggle.key)))}
              onMouseLeave={() => onChordModifierChange(new Set([...chordModifiers].filter(m => m !== shortcuts.majMinToggle.key)))}
              ref={majMinToggleTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
              className={`px-2 py-1 rounded text-xs touch-manipulation ${chordModifiers.has(shortcuts.majMinToggle.key)
                ? "bg-blue-500 text-black"
                : "bg-gray-600 text-gray-300"
                }`}
            >
              maj/min <kbd className="kbd kbd-sm">{getKeyDisplayName(shortcuts.majMinToggle.key)}</kbd>
            </button>
          </div>
        </div>

        {/* Keys - exactly like Keyboard */}
        <div className="flex flex-col gap-4">
          {/* Triads */}
          <div className="text-center">
            <p className="text-white text-sm mb-2">Triads</p>
            <div className="flex justify-center gap-1">
              {chordKeys.map((chordKey, index) => (
                <ChordButton
                  key={index}
                  chordKey={chordKey}
                  chordModifiers={chordModifiers}
                  shortcuts={shortcuts}
                  scaleState={scaleState}
                  onChordPress={onChordPress}
                  onChordRelease={onChordRelease}
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
              for (const chordIndex of pressedChords) {
                onStrumChord(chordIndex, 'up');
              }
            }}
            ref={strumUpTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
            className="btn btn-primary btn-lg lg:btn-sm touch-manipulation"
            style={{
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'manipulation'
            }}
          >
            Strum Up <kbd className="kbd kbd-sm">{getKeyDisplayName(',')}</kbd>
          </button>
          <button
            onMouseDown={() => {
              // Strum all pressed chords down (.)
              for (const chordIndex of pressedChords) {
                onStrumChord(chordIndex, 'down');
              }
            }}
            ref={strumDownTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
            className="btn btn-secondary btn-lg lg:btn-sm touch-manipulation"
            style={{
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'manipulation'
            }}
          >
            Strum Down <kbd className="kbd kbd-sm">{getKeyDisplayName('.')}</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}; 