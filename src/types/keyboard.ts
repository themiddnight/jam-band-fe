import type { Scale } from "../hooks/useScaleState";

export interface ScaleState {
  rootNote: string;
  scale: Scale;
  getScaleNotes: (
    root: string,
    scaleType: Scale,
    octave: number
  ) => string[];
}

export interface KeyboardState {
  mainMode: "simple" | "advanced";
  simpleMode: "melody" | "chord";
  currentOctave: number;
  velocity: number;
  sustain: boolean;
  sustainToggle: boolean;
  hasSustainedNotes: boolean;
  heldKeys: Set<string>;
  setSustain: (sustain: boolean) => void;
  setSustainToggle: (sustainToggle: boolean) => void;
  setHeldKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSimpleMode: React.Dispatch<React.SetStateAction<"melody" | "chord">>;
  setCurrentOctave: React.Dispatch<React.SetStateAction<number>>;
  setVelocity: React.Dispatch<React.SetStateAction<number>>;
  playNote: (note: string, velocity: number, isKeyHeld: boolean) => void;
  releaseKeyHeldNote: (note: string) => void;
  stopSustainedNotes: () => void;
}

export interface VirtualKeyboardState {
  chordVoicing: number;
  setChordVoicing: React.Dispatch<React.SetStateAction<number>>;
  chordModifiers: Set<string>;
  setChordModifiers: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeTriadChords: Map<number, string[]>;
  setActiveTriadChords: React.Dispatch<
    React.SetStateAction<Map<number, string[]>>
  >;
  pressedTriads: Set<number>;
  setPressedTriads: React.Dispatch<React.SetStateAction<Set<number>>>;
  getChord: (
    root: string,
    scaleType: Scale,
    degree: number,
    voicing?: number,
    modifiers?: Set<string>
  ) => string[];
  generateVirtualKeys: any[];
} 