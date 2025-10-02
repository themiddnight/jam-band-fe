// Instruments Feature Barrel Export

// Components exports
export { default as Guitar } from "./components/Guitar";
export { default as Bass } from "./components/Bass";
export { default as Keyboard } from "./components/Keyboard";
export { default as Drumpad } from "./components/Drumpad";
export { default as Drumset } from "./components/Drumset";
// Synthesizer components are exported individually
export { SynthControls } from "./components/Synthesizer/SynthControls";
export { LatencyControls } from "./components/Synthesizer/LatencyControls";
export { default as InstrumentCategorySelector } from "./components/InstrumentCategorySelector";
export { InstrumentMute } from "./components/InstrumentMute";
export * from "./components/LazyComponents";

// Hooks exports
export { usePresetManager } from "./hooks/usePresetManager";
export { useInstrumentState } from "./hooks/useInstrumentState";
export { useInstrumentManager } from "./hooks/useInstrumentManager";
export { useInstrument } from "./hooks/useInstrument";
export { useVelocityControl } from "./hooks/useVelocityControl";
export { useInstrumentKeyboard } from "./hooks/useInstrumentKeyboard";
export { useKeyboardHandler } from "./hooks/useKeyboardHandler";
export { useInstrumentMute } from "./hooks/useInstrumentMute";

// Constants exports - using aliases to avoid naming conflicts
export {
  DEFAULT_BASS_SHORTCUTS,
  getBassShortcutsByCategory,
  getBassKeyDisplayName,
} from "./constants/bassShortcuts";

export {
  DEFAULT_GUITAR_SHORTCUTS,
  GUITAR_PLAY_BUTTONS,
  GUITAR_STRUM,
  HAMMER_ON_PULL_OFF,
  getGuitarShortcutsByCategory,
  getChordModifierKeys as getGuitarChordModifierKeys,
  getGuitarKeyDisplayName,
  BRUSHING_TIME_STEPS,
  BRUSHING_TIME_LABELS,
} from "./constants/guitarShortcuts";

export {
  DEFAULT_KEYBOARD_SHORTCUTS,
  ARPEGGIO_TIME_STEPS,
  ARPEGGIO_TIME_LABELS,
  getChordModifierKeys,
  getChordModifierKeys as getKeyboardChordModifierKeys,
  getKeyboardShortcutsByCategory,
  getKeyboardKeyDisplayName,
} from "./constants/keyboardShortcuts";

export * from "./constants/virtualKeyboardKeys";

// Presets exports
export * from "./constants/presets/drumPresets";
export * from "./constants/presets/synthPresets";

// Drumpad-specific exports
export {
  DRUMPAD_SHORTCUTS,
  DRUMPAD_COLORS,
  DRUMPAD_PAGE_SHORTCUTS,
} from "./constants/presets/drumPresets";

// General MIDI Percussion exports
export * from "./constants/generalMidiPercussion";

// Utilities exports
export * from "./constants/utils/displayUtils";

// Utilities exports
export * from "./utils/drumMachineUtils";
export * from "./utils/guitarAudioUtils";
export * from "./utils/InstrumentEngine";
export * from "./utils/instrumentGrouping";
export { gmNoteMapper } from "./utils/gmNoteMapper";

// Types exports
export * from "./types/presets";
export * from "./types/keyboard";

// Store exports
export { useGuitarStore } from "./stores/guitarStore";
export { useBassStore } from "./stores/bassStore";
export { useKeyboardStore } from "./stores/keyboardStore";
export { useDrumStore } from "./stores/drumStore";
export { useBaseInstrumentStore } from "./stores/baseInstrumentStore";
export { useDrumpadPresetsStore } from "./stores/drumpadPresetsStore";

// Store factory exports (for creating new instrument stores)
export {
  createInstrumentStore,
  createModeToggle,
  createEnumNavigation,
  type BaseInstrumentState,
} from "./stores/createInstrumentStore";
