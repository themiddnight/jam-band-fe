import {
  getKeyDisplayName,
  getShortcutsByCategory,
} from "./utils/displayUtils";

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: "mode" | "chord" | "control" | "octave" | "velocity";
}

export interface KeyboardShortcuts {
  // Mode controls
  toggleMode: KeyboardShortcut;

  // Chord modifiers
  dominant7: KeyboardShortcut;
  major7: KeyboardShortcut;
  sus2: KeyboardShortcut;
  sus4: KeyboardShortcut;
  majMinToggle: KeyboardShortcut;

  // Control keys
  sustain: KeyboardShortcut;
  sustainToggle: KeyboardShortcut;

  // Octave controls
  octaveDown: KeyboardShortcut;
  octaveUp: KeyboardShortcut;

  // Voicing controls
  voicingDown: KeyboardShortcut;
  voicingUp: KeyboardShortcut;

  // Velocity controls
  velocityDown: KeyboardShortcut;
  velocityUp: KeyboardShortcut;
}

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  toggleMode: {
    key: "shift",
    description:
      "Switch from basic to melody mode, or toggle between melody and chord modes",
    category: "mode",
  },

  dominant7: {
    key: "q",
    description: "Add dominant 7th to chord",
    category: "chord",
  },

  major7: {
    key: "w",
    description: "Add major 7th to chord",
    category: "chord",
  },

  sus2: {
    key: "a",
    description: "Convert chord to sus2",
    category: "chord",
  },

  sus4: {
    key: "s",
    description: "Convert chord to sus4",
    category: "chord",
  },

  majMinToggle: {
    key: "d",
    description: "Toggle between major and minor chord quality",
    category: "chord",
  },

  sustain: {
    key: " ",
    description: "Sustain pedal (momentary)",
    category: "control",
  },

  sustainToggle: {
    key: "\\",
    description: "Toggle sustain mode",
    category: "control",
  },

  octaveDown: {
    key: "z",
    description: "Decrease octave",
    category: "octave",
  },

  octaveUp: {
    key: "x",
    description: "Increase octave",
    category: "octave",
  },

  voicingDown: {
    key: "c",
    description: "Decrease chord voicing",
    category: "velocity",
  },

  voicingUp: {
    key: "v",
    description: "Increase chord voicing",
    category: "velocity",
  },

  // Add velocity controls
  velocityDown: {
    key: "-",
    description: "Decrease velocity (10 steps)",
    category: "velocity",
  },

  velocityUp: {
    key: "=",
    description: "Increase velocity (10 steps)",
    category: "velocity",
  },
};

// Helper function to get chord modifier keys specifically for keyboard shortcuts
export const getChordModifierKeys = (
  shortcuts: KeyboardShortcuts,
): string[] => {
  return [
    shortcuts.dominant7.key,
    shortcuts.major7.key,
    shortcuts.sus2.key,
    shortcuts.sus4.key,
    shortcuts.majMinToggle.key,
  ];
};

// Re-export shared utilities with keyboard-specific aliases
export const getKeyboardShortcutsByCategory = getShortcutsByCategory;
export const getKeyboardKeyDisplayName = getKeyDisplayName;
