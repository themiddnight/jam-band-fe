import { getKeyDisplayName, getShortcutsByCategory } from "./utils/displayUtils";

export interface BassShortcut {
  key: string;
  description: string;
  category: "mode" | "control" | "octave" | "velocity" | "melody";
}

export interface BassShortcuts {
  // Mode controls
  toggleMode: BassShortcut;

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
    key: "shift",
    description: "Toggle between melody and basic modes",
    category: "mode",
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