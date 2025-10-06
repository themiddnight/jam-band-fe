// Main component
export { StepSequencer } from "./components/StepSequencer";

// Sub-components (for advanced usage)
export { VirtualizedStepGrid } from "./components/VirtualizedStepGrid";

// Hooks
export { useSequencer } from "./hooks/useSequencer";
export { useSequencerRows, useDisplayModeOptions } from "./hooks/useSequencerRows";

// Store
export { useSequencerStore } from "./stores/sequencerStore";

// Service
export { SequencerService } from "./services/SequencerService";

// Types and constants
export type {
  SequencerStep,
  SequencerBank,
  SequencerSettings,
  SequencerPresetSettings,
  SequencerState,
  SequencerPreset,
  SequencerRow,
  DrumRow,
  NoteRow,
  SequencerSpeed,
  BankMode,
  DisplayMode,
  BankName,
  SequencerControlEvent,
} from "./types";

export { 
  SEQUENCER_CONSTANTS,
  SEQUENCER_SPEEDS,
} from "@/shared/constants";

// Constants
export { DEFAULT_MELODIC_PRESETS } from "./constants/defaultPresets";
export { DEFAULT_DRUM_BEAT_PRESETS } from "./constants/defaultDrumPresets"; 