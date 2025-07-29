import { useMemo } from "react";
import { useTouchEvents } from "../../../hooks/useTouchEvents";
import { getKeyDisplayName, DEFAULT_GUITAR_SHORTCUTS } from "../../../constants/guitarShortcuts";
import { getChordFromDegree } from "../../../utils/musicUtils";
import type { Scale } from "../../../hooks/useScaleState";
import type { GuitarChord } from "../types/guitar";

interface SimpleChordKeysProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  chordVoicing: number;
  velocity: number;
  pressedChords: Set<number>;
  chordModifiers: Set<string>;
  strumConfig: { speed: number; direction: 'up' | 'down'; isActive: boolean };
  onChordPress: (chordIndex: number) => void;
  onChordRelease: (chordIndex: number) => void;
  onStrumChord: (chordIndex: number, direction: 'up' | 'down') => void;
  onChordVoicingChange: (voicing: number) => void;
  onVelocityChange: (velocity: number) => void;
  onStrumSpeedChange: (speed: number) => void;

  onChordModifierChange: (modifiers: Set<string>) => void;
}

export const SimpleChordKeys: React.FC<SimpleChordKeysProps> = ({
  scaleState,
  chordVoicing,
  velocity,
  pressedChords,
  chordModifiers,
  strumConfig,
  onChordPress,
  onChordRelease,
  onStrumChord,
  onChordVoicingChange,
  onVelocityChange,
  onStrumSpeedChange,
  onChordModifierChange,
}) => {
  const shortcuts = DEFAULT_GUITAR_SHORTCUTS;

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
        chordModifiers
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

  // Memoized chord button component
  const ChordButton = ({ chordKey }: { chordKey: GuitarChord }) => {
    const touchHandlers = useTouchEvents(
      () => onChordPress(chordKey.degree),
      () => onChordRelease(chordKey.degree)
    );

    return (
      <button
        onMouseDown={() => onChordPress(chordKey.degree)}
        onMouseUp={() => onChordRelease(chordKey.degree)}
        onMouseLeave={() => onChordRelease(chordKey.degree)}
        ref={touchHandlers.ref}
        onContextMenu={touchHandlers.onContextMenu}
        className={`w-20 h-24 border-2 border-gray-300 rounded-lg
                transition-all duration-100 focus:outline-none flex flex-col justify-between p-1
                touch-manipulation select-none
                ${
                  chordKey.isPressed
                    ? "bg-purple-500 text-white border-purple-600 scale-95 shadow-inner"
                    : "bg-purple-100 border-purple-300 hover:bg-purple-200 hover:border-purple-400 active:bg-purple-300"
                }`}
        style={{
          WebkitTapHighlightColor: 'transparent',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation'
        }}
      >
        <div className={`text-xs ${chordKey.isPressed ? 'text-purple-200' : 'text-gray-500'}`}>
          {chordKey.keyboardKey?.toUpperCase()}
        </div>
        <div className={`text-sm font-semibold ${chordKey.isPressed ? 'text-white' : 'text-gray-700'}`}>
          {chordKey.degree + 1}
        </div>
        <div className={`text-xs ${chordKey.isPressed ? 'text-purple-200' : 'text-gray-500'}`}>
          {chordKey.notes.slice(0, 3).join(' ')}
        </div>
      </button>
    );
  };

  // Memoized modifier button component
  const ModifierButton = ({ 
    keyName, 
    label, 
    isActive, 
    onToggle 
  }: { 
    keyName: string; 
    label: string; 
    isActive: boolean; 
    onToggle: () => void;
  }) => {
    return (
      <button
        onClick={onToggle}
        className={`btn btn-sm ${isActive ? 'btn-success' : 'btn-outline'}`}
      >
        {label} <kbd className="kbd kbd-xs">{getKeyDisplayName(keyName)}</kbd>
      </button>
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
      <div className="card-body p-3">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <h3 className="card-title text-base">Simple - Chord Mode</h3>
          </div>
        </div>

        <div className="bg-neutral p-4 rounded-lg shadow-2xl">
          {/* Chord Keys */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {chordKeys.map((chordKey, index) => (
              <ChordButton key={index} chordKey={chordKey} />
            ))}
          </div>

          {/* Strum Buttons */}
          <div className="flex justify-center gap-4 mb-4">
            <button
              onMouseDown={() => {
                // Strum all pressed chords up (,) - uses 70% velocity
                for (const chordIndex of pressedChords) {
                  onStrumChord(chordIndex, 'up');
                }
              }}
              className="btn btn-primary btn-lg"
            >
              Strum Up (70%) <kbd className="kbd kbd-sm">{getKeyDisplayName(',')}</kbd>
            </button>
            <button
              onMouseDown={() => {
                // Strum all pressed chords down (.)
                for (const chordIndex of pressedChords) {
                  onStrumChord(chordIndex, 'down');
                }
              }}
              className="btn btn-secondary btn-lg"
            >
              Strum Down <kbd className="kbd kbd-sm">{getKeyDisplayName('.')}</kbd>
            </button>
          </div>

          {/* Chord Modifiers */}
          <div className="flex justify-center gap-2 mb-4 flex-wrap">
            <ModifierButton
              keyName={shortcuts.dominant7.key}
              label="Dom7"
              isActive={chordModifiers.has('dominant7')}
              onToggle={() => {
                const newModifiers = new Set(chordModifiers);
                if (newModifiers.has('dominant7')) {
                  newModifiers.delete('dominant7');
                } else {
                  newModifiers.add('dominant7');
                }
                onChordModifierChange(newModifiers);
              }}
            />
            <ModifierButton
              keyName={shortcuts.major7.key}
              label="Maj7"
              isActive={chordModifiers.has('major7')}
              onToggle={() => {
                const newModifiers = new Set(chordModifiers);
                if (newModifiers.has('major7')) {
                  newModifiers.delete('major7');
                } else {
                  newModifiers.add('major7');
                }
                onChordModifierChange(newModifiers);
              }}
            />
            <ModifierButton
              keyName={shortcuts.sus2.key}
              label="Sus2"
              isActive={chordModifiers.has('sus2')}
              onToggle={() => {
                const newModifiers = new Set(chordModifiers);
                if (newModifiers.has('sus2')) {
                  newModifiers.delete('sus2');
                } else {
                  newModifiers.add('sus2');
                }
                onChordModifierChange(newModifiers);
              }}
            />
            <ModifierButton
              keyName={shortcuts.sus4.key}
              label="Sus4"
              isActive={chordModifiers.has('sus4')}
              onToggle={() => {
                const newModifiers = new Set(chordModifiers);
                if (newModifiers.has('sus4')) {
                  newModifiers.delete('sus4');
                } else {
                  newModifiers.add('sus4');
                }
                onChordModifierChange(newModifiers);
              }}
            />
            <ModifierButton
              keyName={shortcuts.majMinToggle.key}
              label="Maj/Min"
              isActive={chordModifiers.has('majMinToggle')}
              onToggle={() => {
                const newModifiers = new Set(chordModifiers);
                if (newModifiers.has('majMinToggle')) {
                  newModifiers.delete('majMinToggle');
                } else {
                  newModifiers.add('majMinToggle');
                }
                onChordModifierChange(newModifiers);
              }}
            />
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-3 flex-wrap">
            {/* Voicing Controls */}
            <div className="flex items-center gap-2">
              <label className="label py-1">
                <span className="label-text text-sm">
                  Voicing: {chordVoicing}
                </span>
              </label>
              <div className="join">
                <button
                  onClick={() => onChordVoicingChange(Math.max(-2, chordVoicing - 1))}
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  - <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.voicingDown.key)}</kbd>
                </button>
                <button
                  onClick={() => onChordVoicingChange(Math.min(4, chordVoicing + 1))}
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  + <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.voicingUp.key)}</kbd>
                </button>
              </div>
            </div>

            {/* Strum Speed Controls */}
            <div className="flex items-center gap-2">
              <label className="label py-1">
                <span className="label-text text-sm">
                  Speed: {strumConfig.speed}ms
                </span>
              </label>
              <div className="join">
                <button
                  onClick={() => onStrumSpeedChange(Math.max(5, strumConfig.speed - 10))}
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  - <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.strumSpeedDown.key)}</kbd>
                </button>
                <button
                  onClick={() => onStrumSpeedChange(Math.min(100, strumConfig.speed + 10))}
                  className="btn btn-sm btn-outline join-item touch-manipulation"
                >
                  + <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.strumSpeedUp.key)}</kbd>
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
            <p>Hold chord keys (ASDFGHJ) then press strum buttons (,.) to play chords</p>
            <p>Release chord keys to stop the sound</p>
            <p>Use modifiers (QWERT) to change chord quality</p>
          </div>
        </div>
      </div>
    </div>
  );
}; 