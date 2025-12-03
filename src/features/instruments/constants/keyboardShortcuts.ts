import {
  getKeyDisplayName,
  getShortcutsByCategory,
} from "./utils/displayUtils";

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: "mode" | "chord" | "control" | "octave" | "velocity" | "arpeggio";
}

export interface KeyboardShortcuts {
  // Mode controls (no shortcut key - use buttons only)
  toggleMode: KeyboardShortcut;

  // Sharp modifier (shift key = +1 semitone)
  sharpModifier: KeyboardShortcut;

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

  // Arpeggio controls
  arpeggioSpeedDown: KeyboardShortcut;
  arpeggioSpeedUp: KeyboardShortcut;
}

// Add arpeggio timing constants for keyboard triad playing
export const ARPEGGIO_TIMES = {
  FASTEST: 0,
  FAST: 10,
  NORMAL: 50,
  SLOW: 100,
  SLOWEST: 200,
} as const;

export type ArpeggioTime = (typeof ARPEGGIO_TIMES)[keyof typeof ARPEGGIO_TIMES];

export const ARPEGGIO_TIME_LABELS: Record<ArpeggioTime, string> = {
  [ARPEGGIO_TIMES.FASTEST]: "Fastest",
  [ARPEGGIO_TIMES.FAST]: "Fast",
  [ARPEGGIO_TIMES.NORMAL]: "Normal",
  [ARPEGGIO_TIMES.SLOW]: "Slow",
  [ARPEGGIO_TIMES.SLOWEST]: "Slowest",
};

export const DEFAULT_ARPEGGIO_TIME: ArpeggioTime = ARPEGGIO_TIMES.FAST;

export const ARPEGGIO_TIME_STEPS: ArpeggioTime[] = [
  ARPEGGIO_TIMES.FASTEST,
  ARPEGGIO_TIMES.FAST,
  ARPEGGIO_TIMES.NORMAL,
  ARPEGGIO_TIMES.SLOW,
  ARPEGGIO_TIMES.SLOWEST,
];

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  toggleMode: {
    key: "",
    description:
      "Switch from basic to melody mode, or toggle between melody and chord modes (use buttons)",
    category: "mode",
  },

  sharpModifier: {
    key: "shift",
    description: "Hold to transpose notes up by 1 semitone (+1 sharp)",
    category: "control",
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

  // Add arpeggio controls
  arpeggioSpeedDown: {
    key: "n",
    description: "Decrease arpeggio speed",
    category: "arpeggio",
  },

  arpeggioSpeedUp: {
    key: "m",
    description: "Increase arpeggio speed",
    category: "arpeggio",
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
