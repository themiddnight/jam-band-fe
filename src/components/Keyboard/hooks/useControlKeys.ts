import { useCallback } from 'react';
import { useKeyboardShortcutsStore } from '../../../stores/keyboardShortcutsStore';
import type { KeyboardState, VirtualKeyboardState } from '../../../types/keyboard';

export const useControlKeys = (
  keyboardState: KeyboardState,
  virtualKeyboard: VirtualKeyboardState
) => {
  const shortcuts = useKeyboardShortcutsStore((state) => state.shortcuts);

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

  const handleToggleMelodyChord = useCallback((key: string) => {
    if (key === shortcuts.toggleMelodyChord.key) {
      if (keyboardState.mainMode === "simple") {
        keyboardState.setSimpleMode((prev: string) =>
          prev === "melody" ? "chord" : "melody"
        );
      }
      return true;
    }
    return false;
  }, [keyboardState, shortcuts.toggleMelodyChord.key]);

  const handleOctaveControls = useCallback((key: string) => {
    if (key === shortcuts.octaveDown.key) {
      keyboardState.setCurrentOctave((prev: number) => Math.max(0, prev - 1));
      return true;
    }
    if (key === shortcuts.octaveUp.key) {
      keyboardState.setCurrentOctave((prev: number) => Math.min(8, prev + 1));
      return true;
    }
    return false;
  }, [keyboardState, shortcuts.octaveDown.key, shortcuts.octaveUp.key]);

  const handleVoicingControls = useCallback((key: string) => {
    if (key === shortcuts.voicingDown.key) {
      if (
        keyboardState.mainMode === "simple" &&
        keyboardState.simpleMode === "chord"
      ) {
        virtualKeyboard.setChordVoicing((prev: number) =>
          Math.max(-2, prev - 1)
        );
      }
      return true;
    }
    if (key === shortcuts.voicingUp.key) {
      if (
        keyboardState.mainMode === "simple" &&
        keyboardState.simpleMode === "chord"
      ) {
        virtualKeyboard.setChordVoicing((prev: number) =>
          Math.min(4, prev + 1)
        );
      }
      return true;
    }
    return false;
  }, [keyboardState, virtualKeyboard, shortcuts.voicingDown.key, shortcuts.voicingUp.key]);

  const handleAllControlKeys = useCallback((key: string) => {
    return (
      handleSustain(key) ||
      handleSustainToggle(key) ||
      handleVelocity(key) ||
      handleToggleMelodyChord(key) ||
      handleOctaveControls(key) ||
      handleVoicingControls(key)
    );
  }, [handleSustain, handleSustainToggle, handleVelocity, handleToggleMelodyChord, handleOctaveControls, handleVoicingControls]);

  return { handleAllControlKeys, handleSustainRelease };
}; 