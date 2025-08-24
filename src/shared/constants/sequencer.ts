// Sequencer-specific constants and shortcuts
export const SEQUENCER_CONSTANTS = {
  // Bank shortcuts
  BANK_SHORTCUTS: {
    "6": "A",
    "7": "B", 
    "8": "C",
    "9": "D"
  } as const,
  
  // Grid layout configuration
  // To change grid size, modify these values:
  // - CELL_SIZE: Controls the width and height of each step cell
  // - CELL_GAP: Controls the spacing between cells
  // - LABEL_WIDTH: Controls the width of row labels
  // - BEAT_HEADER_HEIGHT: Controls the height of beat number headers
  GRID: {
    CELL_SIZE: 32, // pixels - width and height of each step cell
    CELL_GAP: 4,   // pixels - gap between cells
    LABEL_WIDTH: 64, // pixels - width of row labels
    BEAT_HEADER_HEIGHT: 32, // pixels - height of beat number header
  } as const,
  
  // Beat configuration
  MAX_BEATS: 32,
  MIN_BEATS: 1,
  
  // Default values
  DEFAULT_GATE: 0.7, // Changed to 70%
  DEFAULT_VELOCITY: 0.7,
  DEFAULT_SPEED: 1/4,
  DEFAULT_LENGTH: 16,
  DEFAULT_EDIT_MODE: "note" as const,
  
  // Stepped values for velocity and gate (10 steps)
  VELOCITY_STEPS: 10,
  GATE_STEPS: 10,
  MIN_GATE: 0.1, // 10% minimum
  MIN_VELOCITY: 0.1, // 10% minimum
  
  // Bank configuration
  BANK_NAMES: ["A", "B", "C", "D"] as const,
} as const;

// Speed configuration
export const SEQUENCER_SPEEDS = [
  { value: 1/16, label: "1/16", bpmMultiplier: 16 },
  { value: 1/8, label: "1/8", bpmMultiplier: 8 },
  { value: 1/4, label: "1/4", bpmMultiplier: 4 },
  { value: 1/2, label: "1/2", bpmMultiplier: 2 },
  { value: 1, label: "1", bpmMultiplier: 1 },
  { value: 2, label: "2", bpmMultiplier: 0.5 },
  { value: 4, label: "4", bpmMultiplier: 0.25 },
  { value: 8, label: "8", bpmMultiplier: 0.125 },
  { value: 16, label: "16", bpmMultiplier: 0.0625 },
] as const;

// Type helpers
export type SequencerBankShortcuts = typeof SEQUENCER_CONSTANTS.BANK_SHORTCUTS;
export type BankShortcutKey = keyof SequencerBankShortcuts;
export type BankShortcutValue = SequencerBankShortcuts[BankShortcutKey];
export type SequencerSpeed = typeof SEQUENCER_SPEEDS[number]["value"];
export type BankName = typeof SEQUENCER_CONSTANTS.BANK_NAMES[number]; 