import { DEFAULT_BASS_SHORTCUTS, getKeyDisplayName } from "../../index";
import { useVelocityControl } from "../../index";
import { BasicFretboard } from "../Guitar/components/BasicFretboard";
import { MelodyBass } from "./components/MelodyBass";
import { useBassState } from "./hooks/useBassState";
import { useSustainSync } from "@/features/audio";
import type { Scale } from "@/features/ui";
import { BaseInstrument } from "@/features/ui";
import { useMemo, useCallback } from "react";

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
  onSelectionActiveChange?: (isActive: boolean) => void;
}

export default function Bass({
  scaleState,
  onPlayNotes,
  onStopNotes,
  onStopSustainedNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
  onSelectionActiveChange,
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
    onSelectionActiveChange,
  );

  // Velocity control hook
  const { handleVelocityChange } = useVelocityControl({
    velocity,
    setVelocity,
  });

  // Use shared sustain sync hook to eliminate duplicate useEffect blocks
  useSustainSync({
    unifiedSustain: unifiedState.sustain,
    localSustain: sustain,
    setLocalSustain: setSustain,
    unifiedSustainToggle: unifiedState.sustainToggle,
    localSustainToggle: sustainToggle,
    setLocalSustainToggle: setSustainToggle,
  });

  // Pressed frets projection for basic mode
  const pressedFrets = useMemo(
    () => new Set<string>(unifiedState.pressedKeys),
    [unifiedState.pressedKeys],
  );

  // Custom basic fretboard config for bass (4 strings; low note at bottom)
  const renderBasicFretboard = () => (
    <BasicFretboard
      scaleState={scaleState}
      velocity={velocity}
      pressedFrets={pressedFrets}
      onFretPress={(stringIndex: number, fret: number) =>
        basicMode.handleBasicFretPress(stringIndex, fret)
      }
      onFretRelease={(stringIndex: number, fret: number) =>
        basicMode.handleBasicFretRelease(stringIndex, fret)
      }
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

      // Check if the target is an input element (including chat input)
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest('input, textarea, [contenteditable="true"]') ||
        target.hasAttribute("data-chat-input") ||
        target.closest("[data-chat-input]");

      // Skip bass shortcuts if typing in an input element
      if (isInputElement) {
        return;
      }

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
            // Use 4th interval mapping (same as guitar melody and UI component)
            const scaleLength = 7;
            const lowerRowLength = lowerOctaveKeys.length;
            const totalNotesNeeded = lowerRowLength + 4; // Extra buffer for higher row 4th offset
            
            const allScaleNotes: string[] = [];
            let octave = currentOctave;
            let noteCount = 0;
            
            while (noteCount < totalNotesNeeded) {
              const scaleNotes = scaleState.getScaleNotes(
                scaleState.rootNote,
                scaleState.scale,
                octave,
              );
              allScaleNotes.push(...scaleNotes);
              noteCount += scaleLength;
              octave++;
            }

            // Lower row starts from root (index 0)
            lowerOctaveNotes = allScaleNotes.slice(0, lowerRowLength);
          } else {
            // Always Root mode: use fixed ranges
            const baseScaleNames = scaleState
              .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
              .map((n) => n.slice(0, -1));

            const NOTE_ORDER = [
              "C",
              "C#",
              "D",
              "D#",
              "E",
              "F",
              "F#",
              "G",
              "G#",
              "A",
              "A#",
              "B",
            ];
            const idx = (name: string) => NOTE_ORDER.indexOf(name);
            const toIndex = (note: string) => {
              const name = note.slice(0, -1);
              const oct = parseInt(note.slice(-1));
              return oct * 12 + idx(name);
            };
            const fromIndex = (i: number) =>
              `${NOTE_ORDER[i % 12]}${Math.floor(i / 12)}`;

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

            if (
              string.isHammerOnEnabled &&
              isHammerOnWindow &&
              string.lastPlayedNote !== lowerOctaveNotes[keyIndex]
            ) {
              // Try hammer-on
              bassControls.handleHammerOnPress(
                "lower",
                lowerOctaveNotes[keyIndex],
              );
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
            // Use 4th interval mapping (same as guitar melody and UI component)
            const scaleLength = 7;
            const higherRowLength = higherOctaveKeys.length;
            const totalNotesNeeded = higherRowLength + 4; // Extra buffer for 4th offset
            
            const allScaleNotes: string[] = [];
            let octave = currentOctave;
            let noteCount = 0;
            
            while (noteCount < totalNotesNeeded) {
              const scaleNotes = scaleState.getScaleNotes(
                scaleState.rootNote,
                scaleState.scale,
                octave,
              );
              allScaleNotes.push(...scaleNotes);
              noteCount += scaleLength;
              octave++;
            }

            // Higher row starts from 4th (index 3)
            const fourthOffset = 3;
            higherOctaveNotes = allScaleNotes.slice(fourthOffset, fourthOffset + higherRowLength);
          } else {
            // Always Root mode: use fixed ranges
            const baseScaleNames = scaleState
              .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
              .map((n) => n.slice(0, -1));

            const NOTE_ORDER = [
              "C",
              "C#",
              "D",
              "D#",
              "E",
              "F",
              "F#",
              "G",
              "G#",
              "A",
              "A#",
              "B",
            ];
            const idx = (name: string) => NOTE_ORDER.indexOf(name);
            const toIndex = (note: string) => {
              const name = note.slice(0, -1);
              const oct = parseInt(note.slice(-1));
              return oct * 12 + idx(name);
            };
            const fromIndex = (i: number) =>
              `${NOTE_ORDER[i % 12]}${Math.floor(i / 12)}`;

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

            if (
              string.isHammerOnEnabled &&
              isHammerOnWindow &&
              string.lastPlayedNote !== higherOctaveNotes[keyIndex]
            ) {
              // Try hammer-on
              bassControls.handleHammerOnPress(
                "higher",
                higherOctaveNotes[keyIndex],
              );
            } else {
              // Normal note press
              bassControls.handleNotePress(
                "higher",
                higherOctaveNotes[keyIndex],
              );
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
    [
      shortcuts,
      mode,
      setMode,
      setCurrentOctave,
      currentOctave,
      setAlwaysRoot,
      alwaysRoot,
      velocity,
      bassControls,
      setSustain,
      setSustainToggle,
      sustainToggle,
      scaleState,
      bassState,
      handleVelocityChange,
    ],
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
            // Use 4th interval mapping (same as guitar melody and UI component)
            const scaleLength = 7;
            const lowerRowLength = lowerOctaveKeys.length;
            const totalNotesNeeded = lowerRowLength + 4; // Extra buffer for higher row 4th offset
            
            const allScaleNotes: string[] = [];
            let octave = currentOctave;
            let noteCount = 0;
            
            while (noteCount < totalNotesNeeded) {
              const scaleNotes = scaleState.getScaleNotes(
                scaleState.rootNote,
                scaleState.scale,
                octave,
              );
              allScaleNotes.push(...scaleNotes);
              noteCount += scaleLength;
              octave++;
            }

            // Lower row starts from root (index 0)
            lowerOctaveNotes = allScaleNotes.slice(0, lowerRowLength);
          } else {
            // Always Root mode: use fixed ranges
            const baseScaleNames = scaleState
              .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
              .map((n) => n.slice(0, -1));

            const NOTE_ORDER = [
              "C",
              "C#",
              "D",
              "D#",
              "E",
              "F",
              "F#",
              "G",
              "G#",
              "A",
              "A#",
              "B",
            ];
            const idx = (name: string) => NOTE_ORDER.indexOf(name);
            const toIndex = (note: string) => {
              const name = note.slice(0, -1);
              const oct = parseInt(note.slice(-1));
              return oct * 12 + idx(name);
            };
            const fromIndex = (i: number) =>
              `${NOTE_ORDER[i % 12]}${Math.floor(i / 12)}`;

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
            // Use 4th interval mapping (same as guitar melody and UI component)
            const scaleLength = 7;
            const higherRowLength = higherOctaveKeys.length;
            const totalNotesNeeded = higherRowLength + 4; // Extra buffer for 4th offset
            
            const allScaleNotes: string[] = [];
            let octave = currentOctave;
            let noteCount = 0;
            
            while (noteCount < totalNotesNeeded) {
              const scaleNotes = scaleState.getScaleNotes(
                scaleState.rootNote,
                scaleState.scale,
                octave,
              );
              allScaleNotes.push(...scaleNotes);
              noteCount += scaleLength;
              octave++;
            }

            // Higher row starts from 4th (index 3)
            const fourthOffset = 3;
            higherOctaveNotes = allScaleNotes.slice(fourthOffset, fourthOffset + higherRowLength);
          } else {
            // Always Root mode: use fixed ranges
            const baseScaleNames = scaleState
              .getScaleNotes(scaleState.rootNote, scaleState.scale, 0)
              .map((n) => n.slice(0, -1));

            const NOTE_ORDER = [
              "C",
              "C#",
              "D",
              "D#",
              "E",
              "F",
              "F#",
              "G",
              "G#",
              "A",
              "A#",
              "B",
            ];
            const idx = (name: string) => NOTE_ORDER.indexOf(name);
            const toIndex = (note: string) => {
              const name = note.slice(0, -1);
              const oct = parseInt(note.slice(-1));
              return oct * 12 + idx(name);
            };
            const fromIndex = (i: number) =>
              `${NOTE_ORDER[i % 12]}${Math.floor(i / 12)}`;

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
            bassControls.handleNoteRelease(
              "higher",
              higherOctaveNotes[keyIndex],
            );
          }
          return;
        }
      }
    },
    [
      mode,
      shortcuts,
      sustainToggle,
      setSustain,
      scaleState,
      currentOctave,
      alwaysRoot,
      bassControls,
    ],
  );

  // Mode controls
  const modeControls = (
    <div className="block join">
      <button
        onClick={() => setMode("melody")}
        className={`btn btn-sm join-item touch-manipulation ${mode === "melody" ? "btn-primary" : "btn-outline"}`}
      >
        Melody{" "}
        <kbd className="kbd kbd-xs">
          {getKeyDisplayName(shortcuts.toggleMode.key)}
        </kbd>
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
  const controlConfig =
    mode === "basic"
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
          Always Root{" "}
          <kbd className="kbd kbd-xs">
            {getKeyDisplayName(shortcuts.alwaysRoot.key)}
          </kbd>
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
