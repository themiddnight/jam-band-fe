import type { SequencerState, SequencerStep, SequencerSettings, BankMode, DisplayMode, EditMode } from "./index";

export interface SequencerActions {
  // Step management
  addStep: (bankId: string, beat: number, note: string, velocity?: number, gate?: number) => void;
  removeStep: (bankId: string, stepId: string) => void;
  updateStep: (bankId: string, beat: number, note: string, updates: Partial<SequencerStep>) => void;
  toggleStep: (bankId: string, beat: number, note: string) => void;
  clearBeat: (bankId: string, beat: number) => void;
  clearBank: (bankId: string) => void;
  clearAllBanks: () => void;

  // Bank management
  switchBank: (bankId: string) => void;
  toggleBankEnabled: (bankId: string) => void;
  duplicateBank: (fromBankId: string, toBankId: string) => void;

  // Copy/Paste functionality
  copyBank: (bankId: string) => void;
  pasteBank: (bankId: string) => void;
  clearClipboard: () => void;

  // Playback control
  play: () => void;
  stop: () => void;
  pause: () => void;
  softStop: () => void; // New: request soft-stop (wait for sequence end)
  cancelSoftStop: () => void; // New: cancel pending soft-stop request
  hardStop: () => void; // New: immediate stop with note-off
  togglePlayback: () => void;
  setCurrentBeat: (beat: number) => void;
  nextBeat: () => void;
  resetToStart: () => void;

  // Recording
  toggleRecording: () => void;
  recordStep: (note: string, velocity?: number, gate?: number, isRealtime?: boolean) => void;

  // Settings
  updateSettings: (settings: Partial<SequencerSettings>) => void;
  setSpeed: (speed: number) => void;
  setLength: (length: number) => void;
  setBankMode: (mode: BankMode) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setEditMode: (mode: EditMode) => void;

  // UI state
  setSelectedBeat: (beat: number) => void;
  setWaitingForMetronome: (waiting: boolean) => void;
  setWaitingBankChange: (bankId: string | null) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;

  // Preset management
  savePreset: (name: string, instrumentCategory: string) => Promise<void>;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => Promise<void>;
  exportPreset: (presetId: string) => string;
  importPreset: (presetData: string) => Promise<void>;
  // API sync methods
  loadPresetsFromAPI: () => Promise<void>;
  syncPresetsToAPI: () => Promise<void>;

  // Utility functions
  getStepsForBeat: (bankId: string, beat: number) => SequencerStep[];
  getActiveStepsForBeat: (beat: number) => SequencerStep[];
  hasStepAtBeat: (bankId: string, beat: number, note: string) => boolean;
  getNextEnabledBank: () => string | null;
  getBeatStepsCount: (bankId: string, beat: number) => number;
  getTotalStepsCount: (bankId: string) => number;

  // Reset
  reset: () => void;
  resetUI: () => void;

  // Category management
  setActiveCategory: (category: string) => void;
}

export interface SequencerStore extends SequencerState, SequencerActions {}
