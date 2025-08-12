import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  ARPEGGIO_TIME_STEPS,
} from "../../../index";
import { useVelocityControl } from "../../../index";
import { useKeyboardStore } from "../../../stores/keyboardStore";
import type {
  KeyboardState,
  VirtualKeyboardState,
} from "../../../index";
import { useCallback } from "react";

export const useControlKeys = (
  keyboardState: KeyboardState,
  virtualKeyboard: VirtualKeyboardState,
) => {
  const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;
  const { handleVelocityChange } = useVelocityControl({
    velocity: keyboardState.velocity,
    setVelocity: keyboardState.setVelocity,
  });
  const { arpeggioSpeed, setArpeggioSpeed } = useKeyboardStore();

  const handleSustain = useCallback(
    (key: string) => {
      if (key === shortcuts.sustain.key) {
        if (!keyboardState.heldKeys.has(key)) {
          if (keyboardState.sustainToggle) {
            keyboardState.stopSustainedNotes();
            keyboardState.setSustain(false);
            setTimeout(() => {
              keyboardState.setSustain(true);
            }, 10);
          } else {
            keyboardState.setSustain(true);
          }
          keyboardState.setHeldKeys((prev: Set<string>) =>
            new Set(prev).add(key),
          );
        }
        return true;
      }
      return false;
    },
    [keyboardState, shortcuts.sustain.key],
  );

  const handleSustainRelease = useCallback(
    (key: string) => {
      if (key === shortcuts.sustain.key) {
        if (keyboardState.sustainToggle) {
          keyboardState.setSustain(true);
        } else {
          keyboardState.setSustain(false);
        }
        keyboardState.setHeldKeys((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
        return true;
      }
      return false;
    },
    [keyboardState, shortcuts.sustain.key],
  );

  const handleSustainToggle = useCallback(
    (key: string) => {
      if (key === shortcuts.sustainToggle.key) {
        keyboardState.setSustainToggle(!keyboardState.sustainToggle);
        return true;
      }
      return false;
    },
    [keyboardState, shortcuts.sustainToggle.key],
  );

  const handleToggleMode = useCallback(
    (key: string) => {
      if (key === shortcuts.toggleMode.key) {
        if (virtualKeyboard.mode === "basic") {
          virtualKeyboard.setMode("simple-melody");
        } else if (virtualKeyboard.mode === "simple-melody") {
          virtualKeyboard.setMode("simple-chord");
        } else if (virtualKeyboard.mode === "simple-chord") {
          virtualKeyboard.setMode("simple-melody");
        }
        return true;
      }
      return false;
    },
    [virtualKeyboard, shortcuts.toggleMode.key],
  );

  const handleOctaveControls = useCallback(
    (key: string) => {
      if (key === shortcuts.octaveDown.key) {
        keyboardState.setCurrentOctave(
          Math.max(0, keyboardState.currentOctave - 1),
        );
        return true;
      }
      if (key === shortcuts.octaveUp.key) {
        keyboardState.setCurrentOctave(
          Math.min(8, keyboardState.currentOctave + 1),
        );
        return true;
      }
      return false;
    },
    [keyboardState, shortcuts.octaveDown.key, shortcuts.octaveUp.key],
  );

  const handleVoicingControls = useCallback(
    (key: string) => {
      if (key === shortcuts.voicingDown.key) {
        if (virtualKeyboard.mode === "simple-chord") {
          virtualKeyboard.setChordVoicing(
            Math.max(-2, virtualKeyboard.chordVoicing - 1),
          );
        }
        return true;
      }
      if (key === shortcuts.voicingUp.key) {
        if (virtualKeyboard.mode === "simple-chord") {
          virtualKeyboard.setChordVoicing(
            Math.min(4, virtualKeyboard.chordVoicing + 1),
          );
        }
        return true;
      }
      return false;
    },
    [virtualKeyboard, shortcuts.voicingDown.key, shortcuts.voicingUp.key],
  );

  const handleArpeggioControls = useCallback(
    (key: string) => {
      if (key === shortcuts.arpeggioSpeedDown.key) {
        if (virtualKeyboard.mode === "simple-chord") {
          const currentIndex = ARPEGGIO_TIME_STEPS.indexOf(
            arpeggioSpeed as any,
          );
          if (currentIndex > 0) {
            setArpeggioSpeed(ARPEGGIO_TIME_STEPS[currentIndex - 1] as any);
          }
        }
        return true;
      }
      if (key === shortcuts.arpeggioSpeedUp.key) {
        if (virtualKeyboard.mode === "simple-chord") {
          const currentIndex = ARPEGGIO_TIME_STEPS.indexOf(
            arpeggioSpeed as any,
          );
          if (currentIndex < ARPEGGIO_TIME_STEPS.length - 1) {
            setArpeggioSpeed(ARPEGGIO_TIME_STEPS[currentIndex + 1] as any);
          }
        }
        return true;
      }
      return false;
    },
    [
      virtualKeyboard,
      shortcuts.arpeggioSpeedDown.key,
      shortcuts.arpeggioSpeedUp.key,
      arpeggioSpeed,
      setArpeggioSpeed,
    ],
  );

  const handleAllControlKeys = useCallback(
    (key: string) => {
      return (
        handleSustain(key) ||
        handleSustainToggle(key) ||
        handleToggleMode(key) ||
        handleOctaveControls(key) ||
        handleVoicingControls(key) ||
        handleArpeggioControls(key) ||
        handleVelocityChange(key)
      );
    },
    [
      handleSustain,
      handleSustainToggle,
      handleToggleMode,
      handleOctaveControls,
      handleVoicingControls,
      handleArpeggioControls,
      handleVelocityChange,
    ],
  );

  return {
    handleAllControlKeys,
    handleSustainRelease,
  };
};
