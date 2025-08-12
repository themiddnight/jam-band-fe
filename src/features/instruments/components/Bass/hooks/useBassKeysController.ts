import { DEFAULT_BASS_SHORTCUTS } from "../../../index";
import type { Scale } from "../../../../ui";
import { useCallback } from "react";

interface UseBassKeysControllerProps {
  bassState: {
    mode: { type: "basic" | "melody" };
    velocity: number;
    sustain: boolean;
    sustainToggle: boolean;
    currentOctave: number;
    alwaysRoot: boolean;
  };
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  bassControls: {
    setMode: (mode: "basic" | "melody") => void;
    setVelocity: (velocity: number) => void;
    setSustain: (sustain: boolean) => void;
    setSustainToggle: (sustainToggle: boolean) => void;
    setCurrentOctave: (octave: number) => void;
    setAlwaysRoot: (alwaysRoot: boolean) => void;
    handlePlayButtonPress: (
      stringId: "lower" | "higher",
      customVelocity?: number,
    ) => void;
  };
}

export const useBassKeysController = ({
  bassState,
  bassControls,
}: UseBassKeysControllerProps) => {
  const shortcuts = DEFAULT_BASS_SHORTCUTS;

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

      if (key === shortcuts.toggleMode.key) {
        bassControls.setMode(
          bassState.mode.type === "basic" ? "melody" : "basic",
        );
        return;
      }

      if (bassState.mode.type === "melody") {
        if (key === shortcuts.octaveDown.key) {
          bassControls.setCurrentOctave(
            Math.max(0, bassState.currentOctave - 1),
          );
          return;
        }
        if (key === shortcuts.octaveUp.key) {
          bassControls.setCurrentOctave(
            Math.min(8, bassState.currentOctave + 1),
          );
          return;
        }
        if (key === shortcuts.alwaysRoot.key) {
          bassControls.setAlwaysRoot(!bassState.alwaysRoot);
          return;
        }
        if (key === "," || key === ".") {
          const v = key === "," ? bassState.velocity * 0.7 : bassState.velocity;
          bassControls.handlePlayButtonPress("lower", v);
          bassControls.handlePlayButtonPress("higher", v);
          return;
        }
      }

      if (bassState.mode.type === "basic") {
        if (key === (shortcuts.sustain?.key || "")) {
          bassControls.setSustain(true);
          return;
        }
        if (key === (shortcuts.sustainToggle?.key || "")) {
          bassControls.setSustainToggle(!bassState.sustainToggle);
          return;
        }
      }
    },
    [shortcuts, bassState, bassControls],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (bassState.mode.type === "basic") {
        if (key === (shortcuts.sustain?.key || "")) {
          if (!bassState.sustainToggle) bassControls.setSustain(false);
          return;
        }
      }
    },
    [shortcuts, bassState, bassControls],
  );

  return { handleKeyDown, handleKeyUp };
};
