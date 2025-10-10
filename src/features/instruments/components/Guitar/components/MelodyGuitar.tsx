import {
  DEFAULT_GUITAR_SHORTCUTS,
  GUITAR_PLAY_BUTTONS,
  getKeyDisplayName,
} from "../../../index";
import type { GuitarNote, GuitarState } from "../types/guitar";
import type { Scale } from "@/features/ui";
import { useTouchEvents, NoteKeys as SharedNoteKeys } from "@/features/ui";
import { useMemo } from "react";

interface MelodyGuitarProps {
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

export const MelodyGuitar: React.FC<MelodyGuitarProps> = ({
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
      // Play notes for both strings with pick-up velocity
      handlePlayButtonPress(
        "lower",
        velocity * GUITAR_PLAY_BUTTONS.PICK_UP_VELOCITY_MULTIPLIER,
      );
      handlePlayButtonPress(
        "higher",
        velocity * GUITAR_PLAY_BUTTONS.PICK_UP_VELOCITY_MULTIPLIER,
      );
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

  // Generate note keys for both rows with 4th interval
  const noteKeys = useMemo(() => {
    const baseOctaveNoteKeys: GuitarNote[] = [];
    const higherOctaveNoteKeys: GuitarNote[] = [];

    // Generate enough scale notes across multiple octaves to fill both keyboard rows
    const scaleLength = 7; // Major/minor scales have 7 notes
    const lowerRowLength = shortcuts.lowerOctaveNotes.key.length; // 11 keys (ASDFGHJKL;')
    const higherRowLength = shortcuts.higherOctaveNotes.key.length; // 12 keys (QWERTYUIOP[])
    const maxRowLength = Math.max(lowerRowLength, higherRowLength);
    const totalNotesNeeded = maxRowLength + 4; // Extra buffer for higher row 4th offset
    
    const allScaleNotes: string[] = [];
    const allNoteOctaves: number[] = [];
    let octave = currentOctave;
    let noteCount = 0;
    
    while (noteCount < totalNotesNeeded) {
      const scaleNotes = scaleState.getScaleNotes(
        scaleState.rootNote,
        scaleState.scale,
        octave,
      );
      scaleNotes.forEach((note) => {
        allScaleNotes.push(note);
        allNoteOctaves.push(octave);
      });
      noteCount += scaleLength;
      octave++;
    }

    // Base octave notes (ASDFGHJKL;') - starts from root (index 0)
    const baseOctaveKeyChars = shortcuts.lowerOctaveNotes.key.split("");
    baseOctaveKeyChars.forEach((keyChar, index) => {
      if (index < allScaleNotes.length) {
        const note = allScaleNotes[index];
        const octave = allNoteOctaves[index];
        const isPressed = guitarState.strings.lower.pressedNotes.has(note);
        baseOctaveNoteKeys.push({
          note,
          octave,
          isPressed,
          keyboardKey: keyChar,
        });
      }
    });

    // Higher octave notes (QWERTYUIOP[]) - starts from 4th (index 3)
    const higherOctaveKeyChars = shortcuts.higherOctaveNotes.key.split("");
    const fourthOffset = 3; // 4th degree is at index 3 (0-based)
    
    higherOctaveKeyChars.forEach((keyChar, index) => {
      const noteIndex = fourthOffset + index;
      if (noteIndex < allScaleNotes.length) {
        const note = allScaleNotes[noteIndex];
        const octave = allNoteOctaves[noteIndex];
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
    <div className="flex flex-col lg:flex-row justify-center items-center gap-8 w-fit mx-auto">
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
            sustain={guitarState.sustain}
            sustainToggle={guitarState.sustainToggle}
            rootNote={scaleState.rootNote}
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
            sustain={guitarState.sustain}
            sustainToggle={guitarState.sustainToggle}
            rootNote={scaleState.rootNote}
          />
        )}
      </div>

      {/* Play Buttons */}
      <div className="flex flex-col md:flex-row justify-center gap-4">
        <button
          onMouseDown={() => {
            // Play notes for both strings with pick-up velocity
            handlePlayButtonPress(
              "lower",
              velocity * GUITAR_PLAY_BUTTONS.PICK_UP_VELOCITY_MULTIPLIER,
            );
            handlePlayButtonPress(
              "higher",
              velocity * GUITAR_PLAY_BUTTONS.PICK_UP_VELOCITY_MULTIPLIER,
            );
          }}
          ref={
            playNotes70TouchHandlers.ref as React.RefObject<HTMLButtonElement>
          }
          className="btn btn-primary btn-lg xl:btn-sm touch-manipulation"
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
          className="btn btn-secondary btn-lg xl:btn-sm touch-manipulation"
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
