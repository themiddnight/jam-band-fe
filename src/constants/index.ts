// Constants Index - Centralized exports with clear categorization

// Audio & Performance
export * from "./audioConfig";

// Instruments & Sounds
export * from "./instruments";

// Presets & Configurations
export * from "./presets/synthPresets";
export * from "./presets/drumPresets";

// Virtual Keyboard Keys
export * from "./virtualKeyboardKeys";

// Scale Slots
export * from "./scaleSlots";

// UI Components
export * from "./chordModifierConfig";

// Chat & Communication
export * from "./chat";

// Shared Utilities
export * from "./utils/displayUtils";

// Re-export commonly used types and enums for convenience
export type { KeyboardShortcuts, KeyboardShortcut } from "./keyboardShortcuts";
export type { SynthPreset } from "../types/presets";
export type { DrumPreset } from "./presets/drumPresets";
export { InstrumentCategory } from "./instruments";
export { ControlType } from "../types";
export { ChordModifierType } from "./chordModifierConfig";

// Explicit exports to avoid naming conflicts
export {
  DEFAULT_KEYBOARD_SHORTCUTS,
  getChordModifierKeys as getKeyboardChordModifierKeys,
  getKeyboardShortcutsByCategory,
  getKeyboardKeyDisplayName,
} from "./keyboardShortcuts";

export {
  DEFAULT_GUITAR_SHORTCUTS,
  getGuitarShortcutsByCategory,
  getChordModifierKeys as getGuitarChordModifierKeys,
  getGuitarKeyDisplayName,
} from "./guitarShortcuts";

export {
  DEFAULT_BASS_SHORTCUTS,
  getBassShortcutsByCategory,
  getBassKeyDisplayName,
} from "./bassShortcuts";
