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
  // Mode controls
  toggleMode: GuitarShortcut;

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

  // Velocity controls
  velocity1: GuitarShortcut;
  velocity2: GuitarShortcut;
  velocity3: GuitarShortcut;
  velocity4: GuitarShortcut;
  velocity5: GuitarShortcut;
  velocity6: GuitarShortcut;
  velocity7: GuitarShortcut;
  velocity8: GuitarShortcut;
  velocity9: GuitarShortcut;

  // Brushing controls
  brushingSpeedDown: GuitarShortcut;
  brushingSpeedUp: GuitarShortcut;
}

// Brushing time constants
export const BRUSHING_TIMES = {
  FASTEST: 0,
  FAST: 5,
  NORMAL: 30,
  SLOW: 60,
  SLOWEST: 120,
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

export const DEFAULT_GUITAR_SHORTCUTS: GuitarShortcuts = {
  toggleMode: {
    key: "shift",
    description:
      "Switch from basic to melody mode, or toggle between melody and chord modes",
    category: "mode",
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

  // Velocity controls
  velocity1: { key: "1", description: "Velocity 1", category: "velocity" },
  velocity2: { key: "2", description: "Velocity 2", category: "velocity" },
  velocity3: { key: "3", description: "Velocity 3", category: "velocity" },
  velocity4: { key: "4", description: "Velocity 4", category: "velocity" },
  velocity5: { key: "5", description: "Velocity 5", category: "velocity" },
  velocity6: { key: "6", description: "Velocity 6", category: "velocity" },
  velocity7: { key: "7", description: "Velocity 7", category: "velocity" },
  velocity8: { key: "8", description: "Velocity 8", category: "velocity" },
  velocity9: { key: "9", description: "Velocity 9", category: "velocity" },

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
