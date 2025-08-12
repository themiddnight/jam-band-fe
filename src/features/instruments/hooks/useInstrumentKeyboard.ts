import { useVelocityControl } from "./useVelocityControl";
import { useCallback } from "react";

interface KeyboardConfig {
  shortcuts: Record<string, { key: string }>;
  mode: string;
  setMode: (mode: string) => void;
  currentOctave: number;
  setCurrentOctave: (octave: number) => void;
  velocity: number;
  setVelocity: (velocity: number) => void;
  sustain: boolean;
  setSustain: (sustain: boolean) => void;
  sustainToggle: boolean;
  setSustainToggle: (toggle: boolean) => void;
  onStopSustainedNotes: () => void;
  hasSustainedNotes: boolean;
}

interface NoteHandler {
  onNotePress: (note: string) => void;
  onNoteRelease: (note: string) => void;
  onModifierPress?: (modifier: string) => void;
  onModifierRelease?: (modifier: string) => void;
}

/**
 * Unified keyboard handler that can be configured per instrument
 * Eliminates duplicate keyboard handling logic across instruments
 */
export const useInstrumentKeyboard = (
  config: KeyboardConfig,
  _noteHandler: NoteHandler,
  additionalHandlers?: Record<string, (key: string) => boolean>,
) => {
  const { handleVelocityChange } = useVelocityControl({
    velocity: config.velocity,
    setVelocity: config.setVelocity,
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Check if any shortcut matches
      const shortcutMatch = Object.values(config.shortcuts).some((s: any) =>
        s?.key?.includes?.(key),
      );

      if (shortcutMatch) {
        event.preventDefault();
      }

      // Velocity controls
      if (handleVelocityChange(key)) {
        return;
      }

      // Mode toggle
      if (key === config.shortcuts.toggleMode?.key) {
        // This is instrument-specific, so we'll let each instrument handle it
        return;
      }

      // Sustain controls
      if (key === config.shortcuts.sustain?.key) {
        if (!config.sustainToggle) {
          config.setSustain(true);
        } else {
          config.setSustain(false);
          config.onStopSustainedNotes();
          setTimeout(() => {
            config.setSustain(true);
          }, 10);
        }
        return;
      }

      // Sustain toggle
      if (key === config.shortcuts.sustainToggle?.key) {
        config.setSustainToggle(!config.sustainToggle);
        return;
      }

      // Octave controls
      if (key === config.shortcuts.octaveDown?.key) {
        config.setCurrentOctave(Math.max(0, config.currentOctave - 1));
        return;
      }
      if (key === config.shortcuts.octaveUp?.key) {
        config.setCurrentOctave(Math.min(8, config.currentOctave + 1));
        return;
      }

      // Additional handlers
      if (additionalHandlers) {
        for (const [, handler] of Object.entries(additionalHandlers)) {
          const result = handler(key);
          if (result) {
            return;
          }
        }
      }

      // Note handling (to be implemented by each instrument)
      // This is where instruments would handle their specific note keys
    },
    [config, handleVelocityChange, additionalHandlers],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Sustain release
      if (key === config.shortcuts.sustain?.key) {
        if (!config.sustainToggle) {
          config.setSustain(false);
          config.onStopSustainedNotes();
        }
        return;
      }

      // Additional handlers for key up
      if (additionalHandlers) {
        for (const [, handler] of Object.entries(additionalHandlers)) {
          const result = handler(key);
          if (result) {
            return;
          }
        }
      }
    },
    [config, additionalHandlers],
  );

  return {
    handleKeyDown,
    handleKeyUp,
  };
};
