import { useCallback } from 'react';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '../../../constants/keyboardShortcuts';
import type { KeyboardState, VirtualKeyboardState } from '../../../types/keyboard';

export const useControlKeys = (
  keyboardState: KeyboardState,
  virtualKeyboard: VirtualKeyboardState
) => {
  const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;

  const handleSustain = useCallback((key: string) => {
    if (key === shortcuts.sustain.key) {
      if (!keyboardState.heldKeys.has(key)) {
        if (keyboardState.sustainToggle) {
          // If toggle mode is active, spacebar stops current sustained notes
          // This creates the "inverse" behavior where tapping sustain stops sound
          keyboardState.stopSustainedNotes();
          // Also temporarily turn off sustain to communicate with remote users
          // then immediately turn it back on to maintain the toggle state
          keyboardState.setSustain(false);
          // Use setTimeout to ensure the sustain off message is sent before turning it back on
          setTimeout(() => {
            keyboardState.setSustain(true);
          }, 10);
        } else {
          // Normal momentary sustain behavior
          keyboardState.setSustain(true);
        }
        keyboardState.setHeldKeys((prev: Set<string>) =>
          new Set(prev).add(key)
        );
      }
      return true;
    }
    return false;
  }, [keyboardState, shortcuts.sustain.key]);

  const handleSustainRelease = useCallback((key: string) => {
    if (key === shortcuts.sustain.key) {
      if (keyboardState.sustainToggle) {
        // If toggle mode is active, releasing sustain should resume sustain mode
        // This creates the "inverse" behavior where lifting sustain resumes sustain
        keyboardState.setSustain(true);
      } else {
        // Normal momentary sustain behavior - turn off sustain
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
  }, [keyboardState, shortcuts.sustain.key]);

  const handleSustainToggle = useCallback((key: string) => {
    if (key === shortcuts.sustainToggle.key) {
      keyboardState.setSustainToggle(!keyboardState.sustainToggle);
      return true;
    }
    return false;
  }, [keyboardState, shortcuts.sustainToggle.key]);

  const handleVelocity = useCallback((key: string) => {
    if (key >= "1" && key <= "9") {
      keyboardState.setVelocity(parseInt(key) / 9);
      return true;
    }
    return false;
  }, [keyboardState]);

  const handleToggleMode = useCallback((key: string) => {
    if (key === shortcuts.toggleMode.key) {
      if (virtualKeyboard.mode === "basic") {
        // When in basic mode, shift switches to melody mode
        virtualKeyboard.setMode("simple-melody");
      } else if (virtualKeyboard.mode === "simple-melody") {
        // When in melody mode, shift switches to chord mode
        virtualKeyboard.setMode("simple-chord");
      } else if (virtualKeyboard.mode === "simple-chord") {
        // When in chord mode, shift switches back to melody mode
        virtualKeyboard.setMode("simple-melody");
      }
      return true;
    }
    return false;
  }, [virtualKeyboard, shortcuts.toggleMode.key]);

  const handleOctaveControls = useCallback((key: string) => {
    if (key === shortcuts.octaveDown.key) {
      keyboardState.setCurrentOctave(Math.max(0, keyboardState.currentOctave - 1));
      return true;
    }
    if (key === shortcuts.octaveUp.key) {
      keyboardState.setCurrentOctave(Math.min(8, keyboardState.currentOctave + 1));
      return true;
    }
    return false;
  }, [keyboardState, shortcuts.octaveDown.key, shortcuts.octaveUp.key]);

  const handleVoicingControls = useCallback((key: string) => {
    if (key === shortcuts.voicingDown.key) {
      if (virtualKeyboard.mode === "simple-chord") {
        virtualKeyboard.setChordVoicing(Math.max(-2, virtualKeyboard.chordVoicing - 1));
      }
      return true;
    }
    if (key === shortcuts.voicingUp.key) {
      if (virtualKeyboard.mode === "simple-chord") {
        virtualKeyboard.setChordVoicing(Math.min(4, virtualKeyboard.chordVoicing + 1));
      }
      return true;
    }
    return false;
  }, [virtualKeyboard, shortcuts.voicingDown.key, shortcuts.voicingUp.key]);

  const handleAllControlKeys = useCallback((key: string) => {
    return (
      handleSustain(key) ||
      handleSustainToggle(key) ||
      handleVelocity(key) ||
      handleToggleMode(key) ||
      handleOctaveControls(key) ||
      handleVoicingControls(key)
    );
  }, [handleSustain, handleSustainToggle, handleVelocity, handleToggleMode, handleOctaveControls, handleVoicingControls]);

  return { handleAllControlKeys, handleSustainRelease };
}; 