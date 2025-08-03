import { useMemo } from "react";
import { getKeyDisplayName, DEFAULT_GUITAR_SHORTCUTS } from "../../../constants/guitarShortcuts";
import type { Scale } from "../../../hooks/useScaleState";
import type { GuitarNote, GuitarState } from "../types/guitar";
import { VirtualKeyButton } from "../../shared/VirtualKeyButton";
import { usePlayButtonTouchEvents } from "../../../hooks/usePlayButtonTouchEvents";

interface SimpleNoteKeysProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  currentOctave: number;
  velocity: number;
  onOctaveChange: (octave: number) => void;
  onVelocityChange: (velocity: number) => void;
  // New props for string-based behavior
  handleNotePress: (stringId: 'lower' | 'higher', note: string) => void;
  handleNoteRelease: (stringId: 'lower' | 'higher', note: string) => void;
  handlePlayButtonPress: (stringId: 'lower' | 'higher', customVelocity?: number) => void;
  handleHammerOnPress: (stringId: 'lower' | 'higher', note: string) => void;
  guitarState: GuitarState;
}

export const SimpleNoteKeys: React.FC<SimpleNoteKeysProps> = ({
  scaleState,
  currentOctave,
  velocity,
  onOctaveChange,
  onVelocityChange,
  handleNotePress,
  handleNoteRelease,
  handlePlayButtonPress,
  handleHammerOnPress,
  guitarState,
}) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  // Create touch handlers for play buttons
  const playNotes70TouchHandlers = usePlayButtonTouchEvents({
    onPlay: () => {
      // Play notes for both strings with 70% velocity
      handlePlayButtonPress('lower', velocity * 0.7);
      handlePlayButtonPress('higher', velocity * 0.7);
    }
  });

  const playNotesFullTouchHandlers = usePlayButtonTouchEvents({
    onPlay: () => {
      // Play notes for both strings with full velocity
      handlePlayButtonPress('lower', velocity);
      handlePlayButtonPress('higher', velocity);
    }
  });

  // Generate note keys for both octaves
  const noteKeys = useMemo(() => {
    const baseOctaveNoteKeys: GuitarNote[] = [];
    const higherOctaveNoteKeys: GuitarNote[] = [];
    
    // Get scale notes for current and next octaves
    const currentScaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, currentOctave);
    const nextOctaveScaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, currentOctave + 1);
    const upperOctaveScaleNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, currentOctave + 2);
    
    // Base octave notes (ASDFGHJKL;') - 11 keys
    // Use pattern: [...currentScaleNotes, ...nextOctaveScaleNotes]
    const baseOctaveNotes = [...currentScaleNotes, ...nextOctaveScaleNotes];
    const baseOctaveKeyChars = shortcuts.lowerOctaveNotes.key.split('');
    
    baseOctaveKeyChars.forEach((keyChar, index) => {
      if (index < baseOctaveNotes.length) {
        const note = baseOctaveNotes[index];
        const octave = index < currentScaleNotes.length ? currentOctave : currentOctave + 1;
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
    const higherOctaveNotes = [...nextOctaveScaleNotes, ...upperOctaveScaleNotes];
    const higherOctaveKeyChars = shortcuts.higherOctaveNotes.key.split('');
    
    higherOctaveKeyChars.forEach((keyChar, index) => {
      if (index < higherOctaveNotes.length) {
        const note = higherOctaveNotes[index];
        const octave = index < nextOctaveScaleNotes.length ? currentOctave + 1 : currentOctave + 2;
        const isPressed = guitarState.strings.higher.pressedNotes.has(note);
        higherOctaveNoteKeys.push({
          note,
          octave,
          isPressed,
          keyboardKey: keyChar,
        });
      }
    });

    return { baseOctaveKeys: baseOctaveNoteKeys, higherOctaveKeys: higherOctaveNoteKeys };
  }, [scaleState, currentOctave, guitarState.strings, shortcuts]);

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body p-3">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <h3 className="card-title text-base">Simple - Note Mode</h3>
          </div>
        </div>

        <div className="bg-neutral p-4 rounded-lg shadow-2xl">
          {/* Note Keys - Separated into two rows */}
          <div className="flex flex-col gap-4 mb-4">
            {/* Higher octave row (QWERTYUIOP[]) */}
            {noteKeys.higherOctaveKeys.length > 0 && (
              <div className="flex justify-center gap-1">
                {noteKeys.higherOctaveKeys.map((noteKey, index) => (
                  <VirtualKeyButton
                    key={`higher-${index}`}
                    keyboardKey={noteKey.keyboardKey}
                    note={noteKey.note}
                    isPressed={noteKey.isPressed}
                    onPress={() => {
                      // Always try hammer-on first if within window, regardless of key held state
                      const string = guitarState.strings.higher;
                      const currentTime = Date.now();
                      const isHammerOnWindow = currentTime - string.lastPlayTime <= guitarState.hammerOnState.windowMs;
                      
                      if (string.isHammerOnEnabled && isHammerOnWindow && string.lastPlayedNote !== noteKey.note) {
                        // Try hammer-on - let the hook determine if it's valid
                        handleHammerOnPress('higher', noteKey.note);
                      } else {
                        // Normal note press
                        handleNotePress('higher', noteKey.note);
                      }
                    }}
                    onRelease={() => handleNoteRelease('higher', noteKey.note)}
                  />
                ))}
              </div>
            )}

            {/* Base octave row (ASDFGHJKL;') */}
            {noteKeys.baseOctaveKeys.length > 0 && (
              <div className="flex justify-center gap-1">
                {noteKeys.baseOctaveKeys.map((noteKey, index) => (
                  <VirtualKeyButton
                    key={`base-${index}`}
                    keyboardKey={noteKey.keyboardKey}
                    note={noteKey.note}
                    isPressed={noteKey.isPressed}
                    onPress={() => {
                      // Always try hammer-on first if within window, regardless of key held state
                      const string = guitarState.strings.lower;
                      const currentTime = Date.now();
                      const isHammerOnWindow = currentTime - string.lastPlayTime <= guitarState.hammerOnState.windowMs;
                      
                      if (string.isHammerOnEnabled && isHammerOnWindow && string.lastPlayedNote !== noteKey.note) {
                        // Try hammer-on - let the hook determine if it's valid
                        handleHammerOnPress('lower', noteKey.note);
                      } else {
                        // Normal note press
                        handleNotePress('lower', noteKey.note);
                      }
                    }}
                    onRelease={() => handleNoteRelease('lower', noteKey.note)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Play Buttons */}
          <div className="flex justify-center gap-4 mb-4">
            <button
              onMouseDown={() => {
                // Play notes for both strings with 70% velocity
                handlePlayButtonPress('lower', velocity * 0.7);
                handlePlayButtonPress('higher', velocity * 0.7);
              }}
              {...playNotes70TouchHandlers}
              className="btn btn-primary btn-lg touch-manipulation"
              style={{
                WebkitTapHighlightColor: 'transparent',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation'
              }}
            >
              Play Notes (70%) <kbd className="kbd kbd-sm">{getKeyDisplayName(',')}</kbd>
            </button>
            <button
              onMouseDown={() => {
                // Play notes for both strings with full velocity
                handlePlayButtonPress('lower', velocity);
                handlePlayButtonPress('higher', velocity);
              }}
              {...playNotesFullTouchHandlers}
              className="btn btn-secondary btn-lg touch-manipulation"
              style={{
                WebkitTapHighlightColor: 'transparent',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation'
              }}
            >
              Play Notes <kbd className="kbd kbd-sm">{getKeyDisplayName('.')}</kbd>
            </button>
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-3 flex-wrap">
            {/* Octave Controls */}
            <div className="flex items-center gap-2">
              <label className="label py-1">
                <span className="label-text text-sm">
                  Octave: {currentOctave}
                </span>
              </label>
              <div className="join">
                <button
                  onClick={() => onOctaveChange(Math.max(0, currentOctave - 1))}
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  - <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.octaveDown.key)}</kbd>
                </button>
                <button
                  onClick={() => onOctaveChange(Math.min(8, currentOctave + 1))}
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  + <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.octaveUp.key)}</kbd>
                </button>
              </div>
            </div>

            {/* Velocity Control */}
            <div className="flex items-center gap-2">
              <label className="label py-1">
                <span className="label-text text-sm">
                  Velocity: {Math.round(velocity * 9)}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="9"
                value={Math.round(velocity * 9)}
                onChange={(e) => onVelocityChange(parseInt(e.target.value) / 9)}
                className="range range-sm range-primary w-20"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center text-sm text-gray-600 mt-4">
            <p>1. Hold note keys (ASDFGHJKL;' / QWERTYUIOP[]) then press play buttons (,.) to play notes</p>
            <p>2. After playing, press any note within 200ms for hammer-on (70% velocity)</p>
            <p>3. Or lift the active note while holding lower note for pull-off (70% velocity)</p>
            <p>4. Chain hammer-on/pull-off continuously - each action resets the 200ms timer</p>
            <p>5. Release all note keys to stop the sound</p>
            <p className="text-xs text-blue-600 mt-2">
              🎸 Guitar Mode: Real guitar behavior with chaining hammer-on/pull-off techniques
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 