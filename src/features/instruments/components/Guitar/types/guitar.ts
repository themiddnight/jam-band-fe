export interface GuitarNote {
  note: string;
  octave: number;
  isPressed: boolean;
  isActive?: boolean;
  isSustained?: boolean;
  onClick?: () => void;
  keyboardKey?: string;
}

export interface GuitarChord {
  rootNote: string;
  scale: string;
  degree: number;
  notes: string[];
  isPressed: boolean;
  isActive?: boolean;
  isSustained?: boolean;
  onClick?: () => void;
  keyboardKey?: string;
}

export interface GuitarMode {
  type: "basic" | "melody" | "chord";
  description: string;
}

export interface StrumConfig {
  speed: number; // milliseconds between notes
  direction: "up" | "down";
  isActive: boolean;
}

// New types for guitar string behavior
export interface GuitarString {
  id: "lower" | "higher";
  pressedNotes: Set<string>;
  activeNote: string | null;
  activeOutputNote: string | null;
  lastPlayedNote: string | null;
  lastOutputNote?: string | null;
  lastPlayTime: number;
  isHammerOnEnabled: boolean;
}

export interface HammerOnState {
  isEnabled: boolean;
  lastPlayTime: number;
  lastPlayedNote: string | null;
  windowMs: number;
}

export interface GuitarState {
  mode: GuitarMode;
  velocity: number;
  sustain: boolean;
  sustainToggle: boolean;
  currentOctave: number;
  chordVoicing: number;
  chordModifiers: Set<string>;
  powerChordMode: boolean;
  pressedNotes: Set<string>;
  pressedChords: Set<number>;
  strumConfig: StrumConfig;
  // New properties for string behavior
  strings: {
    lower: GuitarString;
    higher: GuitarString;
  };
  hammerOnState: HammerOnState;
}
