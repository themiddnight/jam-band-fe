import {
  getKeyDisplayName,
  getShortcutsByCategory,
} from "./utils/displayUtils";

export interface BassShortcut {
  key: string;
  description: string;
  category: "mode" | "control" | "octave" | "velocity" | "melody";
}

export interface BassShortcuts {
  // Mode controls (no shortcut key - use buttons only)
  toggleMode: BassShortcut;

  // Sharp modifier (shift key = +1 semitone)
  sharpModifier: BassShortcut;

  // Note controls (Melody mode)
  lowerOctaveNotes: BassShortcut; // ASDFGHJKL;'
  higherOctaveNotes: BassShortcut; // QWERTYUIOP[]
  playNote: BassShortcut; // , .
  octaveDown: BassShortcut; // z
  octaveUp: BassShortcut; // x

  // Control keys
  sustain?: BassShortcut; // basic mode only
  sustainToggle?: BassShortcut; // basic mode only
  alwaysRoot: BassShortcut; // melody-only
}

export const DEFAULT_BASS_SHORTCUTS: BassShortcuts = {
  toggleMode: {
    key: "",
    description: "Toggle between melody and basic modes (use buttons)",
    category: "mode",
  },

  sharpModifier: {
    key: "shift",
    description: "Hold to transpose notes up by 1 semitone (+1 sharp)",
    category: "control",
  },
  lowerOctaveNotes: {
    key: "asdfghjkl;'",
    description: "Lower string note keys",
    category: "melody",
  },
  higherOctaveNotes: {
    key: "qwertyuiop[]",
    description: "Higher string note keys",
    category: "melody",
  },
  playNote: {
    key: ",.",
    description: "Play string buttons",
    category: "melody",
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
  sustain: {
    key: " ",
    description: "Sustain pedal (basic mode)",
    category: "control",
  },
  sustainToggle: {
    key: "\\",
    description: "Toggle sustain mode (basic mode)",
    category: "control",
  },
  alwaysRoot: {
    key: "\\",
    description: "Toggle Always Root range (melody mode)",
    category: "control",
  },
};

export const getBassShortcutsByCategory = getShortcutsByCategory;
export const getBassKeyDisplayName = getKeyDisplayName;
