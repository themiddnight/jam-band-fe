export interface SequencerStep {
  id: string;
  beat: number; // 0-15 (16 beats total)
  note: string; // Note name like "C4", "D#3", etc. or sample name
  velocity: number; // 0-1
  gate: number; // 0-1, gate length (50% = 0.5, 100% = 1.0 for legato)
  enabled: boolean;
}

export interface SequencerBank {
  id: string;
  name: string; // "A", "B", "C", "D"
  steps: SequencerStep[];
  enabled: boolean; // For continuous mode
}

export interface SequencerSettings {
  speed: number; // 1/16, 1/8, 1/4, 1/2, 1, 2, 4, 8, 16
  length: number; // 1-16 beats (trimming)
  bankMode: "single" | "continuous";
  displayMode: "all_notes" | "scale_notes" | "only_current";
  editMode: EditMode;
}

export interface SequencerClipboard {
  steps: SequencerStep[];
  timestamp: number;
}

export interface SequencerState {
  // Playback state
  isPlaying: boolean;
  isRecording: boolean;
  softStopRequested: boolean; // Indicates soft-stop was requested (replaces isPaused)
  currentBeat: number; // 0-15
  currentBank: string; // "A", "B", "C", "D"
  waitingForMetronome: boolean; // When play is pressed but waiting for next metronome tick
  waitingBankChange: string | null; // Bank ID waiting to switch to

  // Banks
  banks: Record<string, SequencerBank>;
  
  // Settings
  settings: SequencerSettings;
  
  // UI state
  selectedBeat: number;
  presets: SequencerPreset[];
  
  // Clipboard state
  clipboard: SequencerClipboard | null;

  // Category state management
  activeCategory: string;
  categoryStates: Record<string, SequencerCategoryState>;
}

export interface SequencerCategoryState {
  banks: Record<string, SequencerBank>;
  settings: SequencerSettings;
  currentBank: string;
  currentBeat: number;
  selectedBeat: number;
  presets: SequencerPreset[];
  clipboard: SequencerClipboard | null;
}

// Preset settings exclude UI state (displayMode and editMode)
export interface SequencerPresetSettings {
  speed: number;
  length: number;
  bankMode: "single" | "continuous";
}

export interface SequencerPreset {
  id: string;
  name: string;
  banks: Record<string, SequencerBank>;
  settings: SequencerPresetSettings;
  instrumentCategory: string;
  createdAt: number;
}

export type DisplayMode = "all_notes" | "scale_notes" | "only_current";
export type BankMode = "single" | "continuous";
export type EditMode = "note" | "gate" | "velocity";
export type PlaybackMode = "stop" | "playing" | "paused" | "waiting_metronome" | "waiting_bank_change";

// For drum instruments
export interface DrumRow {
  sampleName: string;
  displayName: string;
  visible: boolean;
}

// For melodic instruments
export interface NoteRow {
  note: string;
  octave: number;
  displayName: string;
  inScale: boolean;
  visible: boolean;
}

export type SequencerRow = DrumRow | NoteRow;

// Sequencer control events
export interface SequencerControlEvent {
  type: "play" | "stop" | "pause" | "record" | "step" | "bank_change";
  data?: any;
  timestamp: number;
}

// Re-export types from shared constants for convenience
export type { SequencerSpeed, BankName } from "@/shared/constants"; 