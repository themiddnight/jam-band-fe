import {
  getKeyDisplayName,
  getShortcutsByCategory,
} from "./utils/displayUtils";

export interface GuitarShortcut {
  key: string;
  description: string;
  category:
    | "mode"
    | "chord"
    | "control"
    | "octave"
    | "velocity"
    | "strum"
    | "brushing";
}

export interface GuitarShortcuts {
  // Mode controls (no shortcut key - use buttons only)
  toggleMode: GuitarShortcut;

  // Sharp modifier (shift key = +1 semitone)
  sharpModifier: GuitarShortcut;

  // Note controls (Simple - Note mode)
  lowerOctaveNotes: GuitarShortcut;
  higherOctaveNotes: GuitarShortcut;
  playNote: GuitarShortcut;
  octaveDown: GuitarShortcut;
  octaveUp: GuitarShortcut;

  // Chord controls (Simple - Chord mode)
  chordNotes: GuitarShortcut;
  strumUp: GuitarShortcut;
  strumDown: GuitarShortcut;
  strumSpeedDown: GuitarShortcut;
  strumSpeedUp: GuitarShortcut;
  voicingDown: GuitarShortcut;
  voicingUp: GuitarShortcut;

  // Chord modifiers
  dominant7: GuitarShortcut;
  major7: GuitarShortcut;
  sus2: GuitarShortcut;
  sus4: GuitarShortcut;
  majMinToggle: GuitarShortcut;
  powerChordToggle: GuitarShortcut;

  // Control keys
  sustain: GuitarShortcut;
  sustainToggle: GuitarShortcut;

  // Brushing controls
  brushingSpeedDown: GuitarShortcut;
  brushingSpeedUp: GuitarShortcut;
}

// Brushing time constants
export const BRUSHING_TIMES = {
  FASTEST: 0,
  FAST: 5,
  NORMAL: 20,
  SLOW: 50,
  SLOWEST: 100,
} as const;

export type BrushingTime = (typeof BRUSHING_TIMES)[keyof typeof BRUSHING_TIMES];

export const BRUSHING_TIME_LABELS: Record<BrushingTime, string> = {
  [BRUSHING_TIMES.FASTEST]: "Fastest",
  [BRUSHING_TIMES.FAST]: "Fast",
  [BRUSHING_TIMES.NORMAL]: "Normal",
  [BRUSHING_TIMES.SLOW]: "Slow",
  [BRUSHING_TIMES.SLOWEST]: "Slowest",
};

export const DEFAULT_BRUSHING_TIME: BrushingTime = BRUSHING_TIMES.FAST;

export const BRUSHING_TIME_STEPS: BrushingTime[] = [
  BRUSHING_TIMES.FASTEST,
  BRUSHING_TIMES.FAST,
  BRUSHING_TIMES.NORMAL,
  BRUSHING_TIMES.SLOW,
  BRUSHING_TIMES.SLOWEST,
];

// Hammer-on/Pull-off constants
export const HAMMER_ON_PULL_OFF = {
  WINDOW_MS: 200,
  VELOCITY_MULTIPLIER: 0.7,
} as const;

// Guitar play button constants
export const GUITAR_PLAY_BUTTONS = {
  PICK_UP_VELOCITY_MULTIPLIER: 0.7,
} as const;

// Guitar strum constants
export const GUITAR_STRUM = {
  UP_VELOCITY_MULTIPLIER: 0.7,
} as const;

export const DEFAULT_GUITAR_SHORTCUTS: GuitarShortcuts = {
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

  // Note controls (Simple - Note mode)
  lowerOctaveNotes: {
    key: "asdfghjkl;'",
    description: "Lower octave note keys",
    category: "octave",
  },

  higherOctaveNotes: {
    key: "qwertyuiop[]",
    description: "Higher octave note keys",
    category: "octave",
  },

  playNote: {
    key: ",.",
    description: "Play note buttons",
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

  // Chord controls (Simple - Chord mode)
  chordNotes: {
    key: "asdfghj",
    description: "Chord selection keys",
    category: "chord",
  },

  strumUp: {
    key: ",",
    description: "Strum up",
    category: "strum",
  },

  strumDown: {
    key: ".",
    description: "Strum down",
    category: "strum",
  },

  strumSpeedDown: {
    key: "n",
    description: "Decrease strum speed",
    category: "strum",
  },

  strumSpeedUp: {
    key: "m",
    description: "Increase strum speed",
    category: "strum",
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

  // Chord modifiers
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
    key: "e",
    description: "Convert chord to sus2",
    category: "chord",
  },

  sus4: {
    key: "r",
    description: "Convert chord to sus4",
    category: "chord",
  },

  majMinToggle: {
    key: "t",
    description: "Toggle between major and minor chord quality",
    category: "chord",
  },

  powerChordToggle: {
    key: "\\",
    description: "Toggle between normal chords and power chords",
    category: "chord",
  },

  // Control keys
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

  // Brushing controls
  brushingSpeedDown: {
    key: "n",
    description: "Decrease brushing speed",
    category: "brushing",
  },

  brushingSpeedUp: {
    key: "m",
    description: "Increase brushing speed",
    category: "brushing",
  },
};

// Helper function to get chord modifier keys specifically for guitar shortcuts
export const getChordModifierKeys = (shortcuts: GuitarShortcuts): string[] => {
  return [
    shortcuts.dominant7.key,
    shortcuts.major7.key,
    shortcuts.sus2.key,
    shortcuts.sus4.key,
    shortcuts.majMinToggle.key,
    shortcuts.powerChordToggle.key,
  ];
};

// Re-export shared utilities with guitar-specific aliases
export const getGuitarShortcutsByCategory = getShortcutsByCategory;
export const getGuitarKeyDisplayName = getKeyDisplayName;
