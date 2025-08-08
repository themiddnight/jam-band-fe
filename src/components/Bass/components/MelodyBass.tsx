import { useMemo } from "react";
import { DEFAULT_BASS_SHORTCUTS } from "../../../constants/bassShortcuts";
import { getKeyDisplayName } from "../../../constants/utils/displayUtils";
import type { Scale } from "../../../hooks/useScaleState";
import { useTouchEvents } from "../../../hooks/useTouchEvents";
import { SharedNoteKeys } from "../../shared/NoteKeys";

interface MelodyBassProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  currentOctave: number;
  velocity: number;
  alwaysRoot: boolean;
  handleNotePress: (stringId: "lower" | "higher", note: string) => void;
  handleNoteRelease: (stringId: "lower" | "higher", note: string) => void;
  handlePlayButtonPress: (
    stringId: "lower" | "higher",
    customVelocity?: number,
  ) => void;
  handleHammerOnPress: (stringId: "lower" | "higher", note: string) => void;
  bassState: {
    sustain: boolean;
    sustainToggle: boolean;
    strings: {
      lower: { pressedNotes: Set<string>; lastPlayTime: number; lastPlayedNote: string | null; isHammerOnEnabled: boolean };
      higher: { pressedNotes: Set<string>; lastPlayTime: number; lastPlayedNote: string | null; isHammerOnEnabled: boolean };
    };
    hammerOnState: { windowMs: number };
  };
}

export const MelodyBass: React.FC<MelodyBassProps> = ({
  scaleState,
  currentOctave,
  velocity,
  alwaysRoot,
  handleNotePress,
  handleNoteRelease,
  handlePlayButtonPress,
  handleHammerOnPress,
  bassState,
}) => {
  const shortcuts = DEFAULT_BASS_SHORTCUTS;

  const playNotes70TouchHandlers = useTouchEvents({
    onPress: () => {
      handlePlayButtonPress("lower", velocity * 0.7);
      handlePlayButtonPress("higher", velocity * 0.7);
    },
    onRelease: () => {},
    isPlayButton: true,
  });

  const playNotesFullTouchHandlers = useTouchEvents({
    onPress: () => {
      handlePlayButtonPress("lower", velocity);
      handlePlayButtonPress("higher", velocity);
    },
    onRelease: () => {},
    isPlayButton: true,
  });

  // Compute note keys
  const noteKeys = useMemo(() => {
    const lowerKeys: { note: string; isPressed: boolean; keyboardKey: string }[] = [];
    const higherKeys: { note: string; isPressed: boolean; keyboardKey: string }[] = [];

    const lowerKeyChars = shortcuts.lowerOctaveNotes.key.split("");
    const higherKeyChars = shortcuts.higherOctaveNotes.key.split("");

    // Helper to push mapped notes by key chars
    const pushKeys = (
      keyChars: string[],
      notes: string[],
      isLower: boolean,
    ) => {
      keyChars.forEach((keyChar, index) => {
        if (index < notes.length) {
          const note = notes[index];
          const isPressed = isLower
            ? bassState.strings.lower.pressedNotes.has(note)
            : bassState.strings.higher.pressedNotes.has(note);
          (isLower ? lowerKeys : higherKeys).push({
            note,
            isPressed,
            keyboardKey: keyChar,
          });
        }
      });
    };

    if (!alwaysRoot) {
      // Same mapping as guitar melody
      const currentScale = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        currentOctave,
      );
      const nextScale = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        currentOctave + 1,
      );
      const upperScale = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        currentOctave + 2,
      );

      pushKeys(lowerKeyChars, [...currentScale, ...nextScale], true);
      pushKeys(higherKeyChars, [...nextScale, ...upperScale], false);
    } else {
      // Always Root mapping: clamp to E1-D#2 for lower, and E3-D#4 for higher
      // Build 7 notes of current scale but snapped into the given ranges
      const baseScaleNames = scaleState
        .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
        .map((n) => n.slice(0, -1));

      const buildRange = (lowOct: number, highOct: number) => {
        const low = `${"E"}${lowOct}`; // E low bound
        const high = `${"D#"}${highOct}`; // D# high bound

        const NOTE_ORDER = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
        const idx = (name: string) => NOTE_ORDER.indexOf(name);
        const toIndex = (note: string) => {
          const name = note.slice(0, -1);
          const oct = parseInt(note.slice(-1));
          return oct * 12 + idx(name);
        };
        const fromIndex = (i: number) => `${NOTE_ORDER[i % 12]}${Math.floor(i/12)}`;

        const lowIndex = toIndex(low);
        const highIndex = toIndex(high);

        // Map each scale degree into the range by choosing the nearest index within [low, high]
        return baseScaleNames.map((name) => {
          // Prefer the pitch at or above low bound, wrapping by 12 if needed, but not exceeding high
          let candidate = lowIndex + ((idx(name) - idx("E") + 12) % 12);
          while (candidate < lowIndex) candidate += 12;
          while (candidate > highIndex) candidate -= 12;
          // Ensure still within bounds
          if (candidate < lowIndex) candidate = lowIndex;
          if (candidate > highIndex) candidate = highIndex;
          return fromIndex(candidate);
        });
      };

      const lowerRangeNotes = buildRange(1, 2); // E1..D#2
      const higherRangeNotes = buildRange(2, 3); // E2..D#3

      pushKeys(lowerKeyChars, lowerRangeNotes, true);
      pushKeys(higherKeyChars, higherRangeNotes, false);
    }

    return { lowerKeys, higherKeys };
  }, [alwaysRoot, bassState.strings, currentOctave, scaleState, shortcuts]);

  return (
    <div className="flex flex-col lg:flex-row justify-center items-center gap-8">
      {/* Note Keys */}
      <div className="flex flex-col gap-4">
        {/* Higher octave row (QWERTYUIOP[]) */}
        {noteKeys.higherKeys.length > 0 && (
          <SharedNoteKeys
            noteKeys={noteKeys.higherKeys.map((nk) => ({
              note: nk.note,
              keyboardKey: nk.keyboardKey,
              isPressed: nk.isPressed,
            }))}
            onKeyPress={(nk) => {
              const string = bassState.strings.higher;
              const currentTime = Date.now();
              const isHammer = currentTime - string.lastPlayTime <= bassState.hammerOnState.windowMs;
              if (string.isHammerOnEnabled && isHammer && string.lastPlayedNote !== nk.note) {
                handleHammerOnPress("higher", nk.note);
              } else {
                handleNotePress("higher", nk.note);
              }
            }}
            onKeyRelease={(nk) => handleNoteRelease("higher", nk.note)}
            variant="guitar"
            size="md"
            sustain={bassState.sustain}
            sustainToggle={bassState.sustainToggle}
          />
        )}

        {/* Lower octave row (ASDFGHJKL;') */}
        {noteKeys.lowerKeys.length > 0 && (
          <SharedNoteKeys
            noteKeys={noteKeys.lowerKeys.map((nk) => ({
              note: nk.note,
              keyboardKey: nk.keyboardKey,
              isPressed: nk.isPressed,
            }))}
            onKeyPress={(nk) => {
              const string = bassState.strings.lower;
              const currentTime = Date.now();
              const isHammer = currentTime - string.lastPlayTime <= bassState.hammerOnState.windowMs;
              if (string.isHammerOnEnabled && isHammer && string.lastPlayedNote !== nk.note) {
                handleHammerOnPress("lower", nk.note);
              } else {
                handleNotePress("lower", nk.note);
              }
            }}
            onKeyRelease={(nk) => handleNoteRelease("lower", nk.note)}
            variant="guitar"
            size="md"
            sustain={bassState.sustain}
            sustainToggle={bassState.sustainToggle}
          />
        )}
      </div>

      {/* Play Buttons */}
      <div className="flex flex-row md:flex-col justify-center gap-4">
        <button
          onMouseDown={() => {
            handlePlayButtonPress("lower", velocity * 0.7);
            handlePlayButtonPress("higher", velocity * 0.7);
          }}
          ref={playNotes70TouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          className="btn btn-primary btn-lg lg:btn-sm touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent", WebkitTouchCallout: "none", WebkitUserSelect: "none", touchAction: "manipulation" }}
        >
          Pick Up <kbd className="kbd kbd-sm">{getKeyDisplayName(",")}</kbd>
        </button>
        <button
          onMouseDown={() => {
            handlePlayButtonPress("lower", velocity);
            handlePlayButtonPress("higher", velocity);
          }}
          ref={playNotesFullTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          className="btn btn-secondary btn-lg lg:btn-sm touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent", WebkitTouchCallout: "none", WebkitUserSelect: "none", touchAction: "manipulation" }}
        >
          Pick Down <kbd className="kbd kbd-sm">{getKeyDisplayName(".")}</kbd>
        </button>
      </div>
    </div>
  );
}; 