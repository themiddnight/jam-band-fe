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
  type: 'basic' | 'simple-note' | 'simple-chord';
  description: string;
}

export interface StrumConfig {
  speed: number; // milliseconds between notes
  direction: 'up' | 'down';
  isActive: boolean;
}

export interface GuitarState {
  mode: GuitarMode;
  velocity: number;
  sustain: boolean;
  sustainToggle: boolean;
  currentOctave: number;
  chordVoicing: number;
  chordModifiers: Set<string>;
  pressedNotes: Set<string>;
  pressedChords: Set<number>;
  strumConfig: StrumConfig;
} 