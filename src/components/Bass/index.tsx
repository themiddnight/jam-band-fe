import { DEFAULT_BASS_SHORTCUTS } from "../../constants/bassShortcuts";
import { getKeyDisplayName } from "../../constants/utils/displayUtils";
import type { Scale } from "../../hooks/useScaleState";
import BaseInstrument from "../shared/BaseInstrument";
import { BasicFretboard } from "../Guitar/components/BasicFretboard";
import { useMemo, useEffect, useCallback } from "react";
import { useBassState } from "./hooks/useBassState";
import { MelodyBass } from "./components/MelodyBass";
import { useVelocityControl } from "../../hooks/useVelocityControl";

export interface BassProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onStopSustainedNotes: () => void;
  onReleaseKeyHeldNote: (note: string) => void;
  onSustainChange: (sustain: boolean) => void;
}

export default function Bass({
  scaleState,
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
}: BassProps) {
  const {
    unifiedState,
    bassState,
    bassControls,
    mode,
    setMode,
    velocity,
    setVelocity,
    currentOctave,
    setCurrentOctave,
    sustain,
    setSustain,
    sustainToggle,
    setSustainToggle,
    alwaysRoot,
    setAlwaysRoot,
    basicMode,
  } = useBassState(
    scaleState,
    onPlayNotes,
    onStopNotes,
    onStopSustainedNotes,
    onReleaseKeyHeldNote,
    onSustainChange,
  );

  // Velocity control hook
  const { handleVelocityChange } = useVelocityControl({
    velocity,
    setVelocity,
  });

  // Sync BaseInstrument sustain with store (already unified)
  useEffect(() => {
    if (unifiedState.sustain !== sustain) setSustain(unifiedState.sustain);
  }, [unifiedState.sustain, sustain, setSustain]);

  useEffect(() => {
    if (unifiedState.sustainToggle !== sustainToggle) {
      setSustainToggle(unifiedState.sustainToggle);
    }
  }, [unifiedState.sustainToggle, sustainToggle, setSustainToggle]);

  // Pressed frets projection for basic mode
  const pressedFrets = useMemo(() => new Set<string>(unifiedState.pressedKeys), [unifiedState.pressedKeys]);

  // Custom basic fretboard config for bass (4 strings; low note at bottom)
  const renderBasicFretboard = () => (
    <BasicFretboard
      scaleState={scaleState}
      velocity={velocity}
      pressedFrets={pressedFrets}
      onFretPress={(stringIndex: number, fret: number) => basicMode.handleBasicFretPress(stringIndex, fret)}
      onFretRelease={(stringIndex: number, fret: number) => basicMode.handleBasicFretRelease(stringIndex, fret)}
      onVelocityChange={setVelocity}
      unifiedState={unifiedState}
      stringsOverride={["G", "D", "A", "E"]}
      openNotesOverride={["G2", "D2", "A1", "E1"]}
      fretsOverride={12}
    />
  );

  const renderMelody = () => (
    <MelodyBass
      scaleState={scaleState}
      currentOctave={currentOctave}
      velocity={velocity}
      alwaysRoot={alwaysRoot}
      handleNotePress={bassControls.handleNotePress}
      handleNoteRelease={bassControls.handleNoteRelease}
      handlePlayButtonPress={bassControls.handlePlayButtonPress}
      handleHammerOnPress={bassControls.handleHammerOnPress}
      bassState={{
        sustain,
        sustainToggle,
        strings: bassState.strings,
        hammerOnState: bassState.hammerOnState,
      }}
    />
  );

  const renderMode = () => {
    switch (mode) {
      case "basic":
        return renderBasicFretboard();
      case "melody":
        return renderMelody();
      default:
        return null;
    }
  };

  const shortcuts = DEFAULT_BASS_SHORTCUTS;

  // Keyboard controller for Bass
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (Object.values(shortcuts).some((s: any) => s?.key?.includes?.(key))) {
        event.preventDefault();
      }

      // Velocity controls
      if (handleVelocityChange(key)) {
        return;
      }

      // Mode toggle
      if (key === shortcuts.toggleMode.key) {
        setMode(mode === "basic" ? "melody" : "basic");
        return;
      }

      if (mode === "melody") {
        // Octave
        if (key === shortcuts.octaveDown.key) {
          setCurrentOctave(Math.max(0, currentOctave - 1));
          return;
        }
        if (key === shortcuts.octaveUp.key) {
          setCurrentOctave(Math.min(8, currentOctave + 1));
          return;
        }

        // Always root toggle
        if (key === shortcuts.alwaysRoot.key) {
          setAlwaysRoot(!alwaysRoot);
          return;
        }

        // Note keys (lower octave - ASDFGHJKL;')
        const lowerOctaveKeys = shortcuts.lowerOctaveNotes.key.split("");
        if (lowerOctaveKeys.includes(key)) {
          const keyIndex = lowerOctaveKeys.indexOf(key);

          // Get scale notes based on alwaysRoot setting
          let lowerOctaveNotes: string[];
          if (!alwaysRoot) {
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
            lowerOctaveNotes = [...currentScaleNotes, ...nextOctaveScaleNotes];
          } else {
            // Always Root mode: use fixed ranges
            const baseScaleNames = scaleState
              .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
              .map((n) => n.slice(0, -1));

            const NOTE_ORDER = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
            const idx = (name: string) => NOTE_ORDER.indexOf(name);
            const toIndex = (note: string) => {
              const name = note.slice(0, -1);
              const oct = parseInt(note.slice(-1));
              return oct * 12 + idx(name);
            };
            const fromIndex = (i: number) => `${NOTE_ORDER[i % 12]}${Math.floor(i/12)}`;

            const lowIndex = toIndex("E1");
            const highIndex = toIndex("D#2");

            lowerOctaveNotes = baseScaleNames.map((name) => {
              let candidate = lowIndex + ((idx(name) - idx("E") + 12) % 12);
              while (candidate < lowIndex) candidate += 12;
              while (candidate > highIndex) candidate -= 12;
              if (candidate < lowIndex) candidate = lowIndex;
              if (candidate > highIndex) candidate = highIndex;
              return fromIndex(candidate);
            });
          }

          if (lowerOctaveNotes[keyIndex]) {
            // Check if hammer-on is enabled for this string
            const string = bassState.strings.lower;
            const currentTime = Date.now();
            const isHammerOnWindow =
              currentTime - string.lastPlayTime <=
              bassState.hammerOnState.windowMs;

            if (string.isHammerOnEnabled && isHammerOnWindow && string.lastPlayedNote !== lowerOctaveNotes[keyIndex]) {
              // Try hammer-on
              bassControls.handleHammerOnPress("lower", lowerOctaveNotes[keyIndex]);
            } else {
              // Normal note press
              bassControls.handleNotePress("lower", lowerOctaveNotes[keyIndex]);
            }
          }
          return;
        }

        // Note keys (higher octave - QWERTYUIOP[])
        const higherOctaveKeys = shortcuts.higherOctaveNotes.key.split("");
        if (higherOctaveKeys.includes(key)) {
          const keyIndex = higherOctaveKeys.indexOf(key);

          // Get scale notes based on alwaysRoot setting
          let higherOctaveNotes: string[];
          if (!alwaysRoot) {
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
            higherOctaveNotes = [...nextOctaveScaleNotes, ...upperOctaveScaleNotes];
          } else {
            // Always Root mode: use fixed ranges
            const baseScaleNames = scaleState
              .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
              .map((n) => n.slice(0, -1));

            const NOTE_ORDER = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
            const idx = (name: string) => NOTE_ORDER.indexOf(name);
            const toIndex = (note: string) => {
              const name = note.slice(0, -1);
              const oct = parseInt(note.slice(-1));
              return oct * 12 + idx(name);
            };
            const fromIndex = (i: number) => `${NOTE_ORDER[i % 12]}${Math.floor(i/12)}`;

            const lowIndex = toIndex("E2");
            const highIndex = toIndex("D#3");

            higherOctaveNotes = baseScaleNames.map((name) => {
              let candidate = lowIndex + ((idx(name) - idx("E") + 12) % 12);
              while (candidate < lowIndex) candidate += 12;
              while (candidate > highIndex) candidate -= 12;
              if (candidate < lowIndex) candidate = lowIndex;
              if (candidate > highIndex) candidate = highIndex;
              return fromIndex(candidate);
            });
          }

          if (higherOctaveNotes[keyIndex]) {
            // Check if hammer-on is enabled for this string
            const string = bassState.strings.higher;
            const currentTime = Date.now();
            const isHammerOnWindow =
              currentTime - string.lastPlayTime <=
              bassState.hammerOnState.windowMs;

            if (string.isHammerOnEnabled && isHammerOnWindow && string.lastPlayedNote !== higherOctaveNotes[keyIndex]) {
              // Try hammer-on
              bassControls.handleHammerOnPress("higher", higherOctaveNotes[keyIndex]);
            } else {
              // Normal note press
              bassControls.handleNotePress("higher", higherOctaveNotes[keyIndex]);
            }
          }
          return;
        }

        // Play buttons
        if (key === "," || key === ".") {
          const v = key === "," ? velocity * 0.7 : velocity;
          bassControls.handlePlayButtonPress("lower", v);
          bassControls.handlePlayButtonPress("higher", v);
          return;
        }
      }

      if (mode === "basic") {
        // Sustain only in basic mode
        if (key === (shortcuts.sustain?.key || "")) {
          setSustain(true);
          return;
        }
        if (key === (shortcuts.sustainToggle?.key || "")) {
          setSustainToggle(!sustainToggle);
          return;
        }
      }
    },
    [shortcuts, mode, setMode, setCurrentOctave, currentOctave, setAlwaysRoot, alwaysRoot, velocity, bassControls, setSustain, setSustainToggle, sustainToggle, scaleState, bassState, handleVelocityChange],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (mode === "basic") {
        if (key === (shortcuts.sustain?.key || "")) {
          if (!sustainToggle) setSustain(false);
          return;
        }
      }

      if (mode === "melody") {
        // Note keys (lower octave - ASDFGHJKL;')
        const lowerOctaveKeys = shortcuts.lowerOctaveNotes.key.split("");
        if (lowerOctaveKeys.includes(key)) {
          const keyIndex = lowerOctaveKeys.indexOf(key);

          // Get scale notes based on alwaysRoot setting
          let lowerOctaveNotes: string[];
          if (!alwaysRoot) {
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
            lowerOctaveNotes = [...currentScaleNotes, ...nextOctaveScaleNotes];
          } else {
            // Always Root mode: use fixed ranges
            const baseScaleNames = scaleState
              .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
              .map((n) => n.slice(0, -1));

            const NOTE_ORDER = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
            const idx = (name: string) => NOTE_ORDER.indexOf(name);
            const toIndex = (note: string) => {
              const name = note.slice(0, -1);
              const oct = parseInt(note.slice(-1));
              return oct * 12 + idx(name);
            };
            const fromIndex = (i: number) => `${NOTE_ORDER[i % 12]}${Math.floor(i/12)}`;

            const lowIndex = toIndex("E1");
            const highIndex = toIndex("D#2");

            lowerOctaveNotes = baseScaleNames.map((name) => {
              let candidate = lowIndex + ((idx(name) - idx("E") + 12) % 12);
              while (candidate < lowIndex) candidate += 12;
              while (candidate > highIndex) candidate -= 12;
              if (candidate < lowIndex) candidate = lowIndex;
              if (candidate > highIndex) candidate = highIndex;
              return fromIndex(candidate);
            });
          }

          if (lowerOctaveNotes[keyIndex]) {
            bassControls.handleNoteRelease("lower", lowerOctaveNotes[keyIndex]);
          }
          return;
        }

        // Note keys (higher octave - QWERTYUIOP[])
        const higherOctaveKeys = shortcuts.higherOctaveNotes.key.split("");
        if (higherOctaveKeys.includes(key)) {
          const keyIndex = higherOctaveKeys.indexOf(key);

          // Get scale notes based on alwaysRoot setting
          let higherOctaveNotes: string[];
          if (!alwaysRoot) {
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
            higherOctaveNotes = [...nextOctaveScaleNotes, ...upperOctaveScaleNotes];
          } else {
            // Always Root mode: use fixed ranges
            const baseScaleNames = scaleState
              .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
              .map((n) => n.slice(0, -1));

            const NOTE_ORDER = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
            const idx = (name: string) => NOTE_ORDER.indexOf(name);
            const toIndex = (note: string) => {
              const name = note.slice(0, -1);
              const oct = parseInt(note.slice(-1));
              return oct * 12 + idx(name);
            };
            const fromIndex = (i: number) => `${NOTE_ORDER[i % 12]}${Math.floor(i/12)}`;

            const lowIndex = toIndex("E2");
            const highIndex = toIndex("D#3");

            higherOctaveNotes = baseScaleNames.map((name) => {
              let candidate = lowIndex + ((idx(name) - idx("E") + 12) % 12);
              while (candidate < lowIndex) candidate += 12;
              while (candidate > highIndex) candidate -= 12;
              if (candidate < lowIndex) candidate = lowIndex;
              if (candidate > highIndex) candidate = highIndex;
              return fromIndex(candidate);
            });
          }

          if (higherOctaveNotes[keyIndex]) {
            bassControls.handleNoteRelease("higher", higherOctaveNotes[keyIndex]);
          }
          return;
        }
      }
    },
    [mode, shortcuts, sustainToggle, setSustain, scaleState, currentOctave, alwaysRoot, bassControls],
  );

  // Mode controls
  const modeControls = (
    <div className="block join">
      <button
        onClick={() => setMode("melody")}
        className={`btn btn-sm join-item touch-manipulation ${mode === "melody" ? "btn-primary" : "btn-outline"}`}
      >
        Melody <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.toggleMode.key)}</kbd>
      </button>
      <button
        onClick={() => setMode("basic")}
        className={`btn btn-sm join-item touch-manipulation ${mode === "basic" ? "btn-primary" : "btn-outline"}`}
      >
        Basic
      </button>
    </div>
  );

  // Control config per mode
  const controlConfig = mode === "basic"
    ? { velocity: true, sustain: true }
    : { velocity: true, octave: true };

  // Additional controls
  const additionalControls = (
    <div className="join">
      {mode === "melody" && (
        <button
          onClick={() => setAlwaysRoot(!alwaysRoot)}
          className={`btn btn-sm join-item touch-manipulation ${alwaysRoot ? "btn-success" : "btn-outline"}`}
        >
          Always Root <kbd className="kbd kbd-xs">{getKeyDisplayName(shortcuts.alwaysRoot.key)}</kbd>
        </button>
      )}
    </div>
  );

  return (
    <BaseInstrument
      title="Bass"
      shortcuts={shortcuts}
      modeControls={modeControls}
      controlConfig={controlConfig}
      velocity={velocity}
      setVelocity={setVelocity}
      currentOctave={currentOctave}
      setCurrentOctave={setCurrentOctave}
      sustain={sustain}
      setSustain={setSustain}
      sustainToggle={sustainToggle}
      setSustainToggle={setSustainToggle}
      onStopSustainedNotes={onStopSustainedNotes}
      hasSustainedNotes={false}
      additionalControls={additionalControls}
      handleKeyDown={handleKeyDown}
      handleKeyUp={handleKeyUp}
    >
      {renderMode()}
    </BaseInstrument>
  );
}
