import { useMemo } from "react";
import { useTouchEvents } from "../../../hooks/useTouchEvents";
import { getKeyDisplayName, DEFAULT_GUITAR_SHORTCUTS } from "../../../constants/guitarShortcuts";
import type { Scale } from "../../../hooks/useScaleState";
import type { GuitarNote } from "../types/guitar";

interface SimpleNoteKeysProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  currentOctave: number;
  velocity: number;
  pressedNotes: Set<string>;
  onNotePress: (note: string) => void;
  onNoteRelease: (note: string) => void;
  onPlayNote: (note: string, velocity?: number) => void;
  onOctaveChange: (octave: number) => void;
  onVelocityChange: (velocity: number) => void;
}

export const SimpleNoteKeys: React.FC<SimpleNoteKeysProps> = ({
  scaleState,
  currentOctave,
  velocity,
  pressedNotes,
  onNotePress,
  onNoteRelease,
  onPlayNote,
  onOctaveChange,
  onVelocityChange,
}) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

  // Generate note keys for both octaves
  const noteKeys = useMemo(() => {
    const keys: GuitarNote[] = [];
    
    // Lower octave notes (ASDFGHJ)
    const lowerOctaveNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, currentOctave);
    const lowerOctaveKeys = shortcuts.lowerOctaveNotes.key.split('');
    
    lowerOctaveNotes.forEach((note, index) => {
      if (lowerOctaveKeys[index]) {
        keys.push({
          note,
          octave: currentOctave,
          isPressed: pressedNotes.has(note),
          keyboardKey: lowerOctaveKeys[index],
        });
      }
    });

    // Higher octave notes (QWERTYU)
    const higherOctaveNotes = scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, currentOctave + 1);
    const higherOctaveKeys = shortcuts.higherOctaveNotes.key.split('');
    
    higherOctaveNotes.forEach((note, index) => {
      if (higherOctaveKeys[index]) {
        keys.push({
          note,
          octave: currentOctave + 1,
          isPressed: pressedNotes.has(note),
          keyboardKey: higherOctaveKeys[index],
        });
      }
    });

    return keys;
  }, [scaleState, currentOctave, pressedNotes, shortcuts]);

  // Memoized note button component
  const NoteButton = ({ noteKey }: { noteKey: GuitarNote }) => {
    const touchHandlers = useTouchEvents(
      () => onNotePress(noteKey.note),
      () => onNoteRelease(noteKey.note)
    );

    return (
      <button
        onMouseDown={() => onNotePress(noteKey.note)}
        onMouseUp={() => onNoteRelease(noteKey.note)}
        onMouseLeave={() => onNoteRelease(noteKey.note)}
        ref={touchHandlers.ref}
        onContextMenu={touchHandlers.onContextMenu}
        className={`w-16 h-20 border-2 border-gray-300 rounded-lg
                transition-all duration-100 focus:outline-none flex flex-col justify-between p-1
                touch-manipulation select-none
                ${
                  noteKey.isPressed
                    ? "bg-blue-500 text-white border-blue-600 scale-95 shadow-inner"
                    : "bg-blue-100 border-blue-300 hover:bg-blue-200 hover:border-blue-400 active:bg-blue-300"
                }`}
        style={{
          WebkitTapHighlightColor: 'transparent',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation'
        }}
      >
        <div className={`text-xs ${noteKey.isPressed ? 'text-blue-200' : 'text-gray-500'}`}>
          {noteKey.keyboardKey?.toUpperCase()}
        </div>
        <div className={`text-sm font-semibold ${noteKey.isPressed ? 'text-white' : 'text-gray-700'}`}>
          {noteKey.note}
        </div>
        <div className={`text-xs ${noteKey.isPressed ? 'text-blue-200' : 'text-gray-500'}`}>
          {noteKey.octave}
        </div>
      </button>
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body p-3">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <h3 className="card-title text-base">Simple - Note Mode</h3>
          </div>
        </div>

        <div className="bg-neutral p-4 rounded-lg shadow-2xl">
          {/* Note Keys */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {noteKeys.map((noteKey, index) => (
              <NoteButton key={index} noteKey={noteKey} />
            ))}
          </div>

          {/* Play Buttons */}
          <div className="flex justify-center gap-4 mb-4">
            <button
              onMouseDown={() => {
                // Play all pressed notes with 70% velocity for ',' button
                for (const note of pressedNotes) {
                  onPlayNote(note, velocity * 0.7);
                }
              }}
              className="btn btn-primary btn-lg"
            >
              Play Notes (70%) <kbd className="kbd kbd-sm">{getKeyDisplayName(',')}</kbd>
            </button>
            <button
              onMouseDown={() => {
                // Play all pressed notes with full velocity
                for (const note of pressedNotes) {
                  onPlayNote(note, velocity);
                }
              }}
              className="btn btn-secondary btn-lg"
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
            <p>Hold note keys (ASDFGHJ/QWERTYU) then press play buttons (,.) to play notes</p>
            <p>Release note keys to stop the sound</p>
          </div>
        </div>
      </div>
    </div>
  );
}; 