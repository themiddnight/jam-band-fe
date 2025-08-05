import { DEFAULT_GUITAR_SHORTCUTS } from "../../../constants/guitarShortcuts";
import { getKeyDisplayName } from "../../../constants/utils/displayUtils";
import type { Scale } from "../../../hooks/useScaleState";
import { useTouchEvents } from "../../../hooks/useTouchEvents";
import { SharedNoteKeys } from "../../shared/NoteKeys";
import type { GuitarNote, GuitarState } from "../types/guitar";
import { useMemo } from "react";

interface SimpleNoteKeysProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  currentOctave: number;
  velocity: number;
  // New props for string-based behavior
  handleNotePress: (stringId: "lower" | "higher", note: string) => void;
  handleNoteRelease: (stringId: "lower" | "higher", note: string) => void;
  handlePlayButtonPress: (
    stringId: "lower" | "higher",
    customVelocity?: number,
  ) => void;
  handleHammerOnPress: (stringId: "lower" | "higher", note: string) => void;
  guitarState: GuitarState;
}

export const SimpleNoteKeys: React.FC<SimpleNoteKeysProps> = ({
  scaleState,
  currentOctave,
  velocity,
  handleNotePress,
  handleNoteRelease,
  handlePlayButtonPress,
  handleHammerOnPress,
  guitarState,
}) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  // Create touch handlers for play buttons
  const playNotes70TouchHandlers = useTouchEvents({
    onPress: () => {
      // Play notes for both strings with 70% velocity
      handlePlayButtonPress("lower", velocity * 0.7);
      handlePlayButtonPress("higher", velocity * 0.7);
    },
    onRelease: () => {},
    isPlayButton: true,
  });

  const playNotesFullTouchHandlers = useTouchEvents({
    onPress: () => {
      // Play notes for both strings with full velocity
      handlePlayButtonPress("lower", velocity);
      handlePlayButtonPress("higher", velocity);
    },
    onRelease: () => {},
    isPlayButton: true,
  });

  // Generate note keys for both octaves
  const noteKeys = useMemo(() => {
    const baseOctaveNoteKeys: GuitarNote[] = [];
    const higherOctaveNoteKeys: GuitarNote[] = [];

    // Get scale notes for current and next octaves
    const currentScaleNotes = scaleState.getScaleNotes(
      scaleState.rootNote,
      scaleState.scale,
      currentOctave,
    );
    const nextOctaveScaleNotes = scaleState.getScaleNotes(
      scaleState.rootNote,
      scaleState.scale,
      currentOctave + 1,
    );
    const upperOctaveScaleNotes = scaleState.getScaleNotes(
      scaleState.rootNote,
      scaleState.scale,
      currentOctave + 2,
    );

    // Base octave notes (ASDFGHJKL;') - 11 keys
    // Use pattern: [...currentScaleNotes, ...nextOctaveScaleNotes]
    const baseOctaveNotes = [...currentScaleNotes, ...nextOctaveScaleNotes];
    const baseOctaveKeyChars = shortcuts.lowerOctaveNotes.key.split("");

    baseOctaveKeyChars.forEach((keyChar, index) => {
      if (index < baseOctaveNotes.length) {
        const note = baseOctaveNotes[index];
        const octave =
          index < currentScaleNotes.length ? currentOctave : currentOctave + 1;
        const isPressed = guitarState.strings.lower.pressedNotes.has(note);
        baseOctaveNoteKeys.push({
          note,
          octave,
          isPressed,
          keyboardKey: keyChar,
        });
      }
    });

    // Higher octave notes (QWERTYUIOP[]) - 12 keys
    // Use pattern: [...nextOctaveScaleNotes, ...upperOctaveScaleNotes]
    const higherOctaveNotes = [
      ...nextOctaveScaleNotes,
      ...upperOctaveScaleNotes,
    ];
    const higherOctaveKeyChars = shortcuts.higherOctaveNotes.key.split("");

    higherOctaveKeyChars.forEach((keyChar, index) => {
      if (index < higherOctaveNotes.length) {
        const note = higherOctaveNotes[index];
        const octave =
          index < nextOctaveScaleNotes.length
            ? currentOctave + 1
            : currentOctave + 2;
        const isPressed = guitarState.strings.higher.pressedNotes.has(note);
        higherOctaveNoteKeys.push({
          note,
          octave,
          isPressed,
          keyboardKey: keyChar,
        });
      }
    });

    return {
      baseOctaveKeys: baseOctaveNoteKeys,
      higherOctaveKeys: higherOctaveNoteKeys,
    };
  }, [scaleState, currentOctave, guitarState.strings, shortcuts]);

  return (
    <div className="flex flex-col lg:flex-row justify-center items-center gap-8">
      {/* Note Keys */}
      <div className="flex flex-col gap-4">
        {/* Higher octave row (QWERTYUIOP[]) */}
        {noteKeys.higherOctaveKeys.length > 0 && (
          <SharedNoteKeys
            noteKeys={noteKeys.higherOctaveKeys.map((noteKey) => ({
              note: noteKey.note,
              keyboardKey: noteKey.keyboardKey || "",
              isPressed: noteKey.isPressed,
            }))}
            onKeyPress={(noteKey) => {
              // Always try hammer-on first if within window, regardless of key held state
              const string = guitarState.strings.higher;
              const currentTime = Date.now();
              const isHammerOnWindow =
                currentTime - string.lastPlayTime <=
                guitarState.hammerOnState.windowMs;

              if (
                string.isHammerOnEnabled &&
                isHammerOnWindow &&
                string.lastPlayedNote !== noteKey.note
              ) {
                // Try hammer-on - let the hook determine if it's valid
                handleHammerOnPress("higher", noteKey.note);
              } else {
                // Normal note press
                handleNotePress("higher", noteKey.note);
              }
            }}
            onKeyRelease={(noteKey) =>
              handleNoteRelease("higher", noteKey.note)
            }
            variant="guitar"
            size="md"
          />
        )}

        {/* Base octave row (ASDFGHJKL;') */}
        {noteKeys.baseOctaveKeys.length > 0 && (
          <SharedNoteKeys
            noteKeys={noteKeys.baseOctaveKeys.map((noteKey) => ({
              note: noteKey.note,
              keyboardKey: noteKey.keyboardKey || "",
              isPressed: noteKey.isPressed,
            }))}
            onKeyPress={(noteKey) => {
              // Always try hammer-on first if within window, regardless of key held state
              const string = guitarState.strings.lower;
              const currentTime = Date.now();
              const isHammerOnWindow =
                currentTime - string.lastPlayTime <=
                guitarState.hammerOnState.windowMs;

              if (
                string.isHammerOnEnabled &&
                isHammerOnWindow &&
                string.lastPlayedNote !== noteKey.note
              ) {
                // Try hammer-on - let the hook determine if it's valid
                handleHammerOnPress("lower", noteKey.note);
              } else {
                // Normal note press
                handleNotePress("lower", noteKey.note);
              }
            }}
            onKeyRelease={(noteKey) => handleNoteRelease("lower", noteKey.note)}
            variant="guitar"
            size="md"
          />
        )}
      </div>

      {/* Play Buttons */}
      <div className="flex flex-row md:flex-col justify-center gap-4">
        <button
          onMouseDown={() => {
            // Play notes for both strings with 70% velocity
            handlePlayButtonPress("lower", velocity * 0.7);
            handlePlayButtonPress("higher", velocity * 0.7);
          }}
          ref={
            playNotes70TouchHandlers.ref as React.RefObject<HTMLButtonElement>
          }
          className="btn btn-primary btn-lg lg:btn-sm touch-manipulation"
          style={{
            WebkitTapHighlightColor: "transparent",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            touchAction: "manipulation",
          }}
        >
          Pick Up <kbd className="kbd kbd-sm">{getKeyDisplayName(",")}</kbd>
        </button>
        <button
          onMouseDown={() => {
            // Play notes for both strings with full velocity
            handlePlayButtonPress("lower", velocity);
            handlePlayButtonPress("higher", velocity);
          }}
          ref={
            playNotesFullTouchHandlers.ref as React.RefObject<HTMLButtonElement>
          }
          className="btn btn-secondary btn-lg lg:btn-sm touch-manipulation"
          style={{
            WebkitTapHighlightColor: "transparent",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            touchAction: "manipulation",
          }}
        >
          Pick Down <kbd className="kbd kbd-sm">{getKeyDisplayName(".")}</kbd>
        </button>
      </div>

      {/* Instructions */}
      {/* <div className="text-center text-sm text-gray-600">
        <p>1. Hold note keys (ASDFGHJKL;' / QWERTYUIOP[]) then press play buttons (,.) to play notes</p>
        <p>2. After playing, press any note within 200ms for hammer-on (70% velocity)</p>
        <p>3. Or lift the active note while holding lower note for pull-off (70% velocity)</p>
        <p>4. Chain hammer-on/pull-off continuously - each action resets the 200ms timer</p>
        <p>5. Release all note keys to stop the sound</p>
        <p className="text-xs text-blue-600 mt-2">
          🎸 Guitar Mode: Real guitar behavior with chaining hammer-on/pull-off techniques
        </p>
      </div> */}
    </div>
  );
};
