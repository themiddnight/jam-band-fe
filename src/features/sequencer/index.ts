// Main component
export { StepSequencer } from "./components/StepSequencer";

// Sub-components (for advanced usage)
export { StepGrid } from "./components/StepGrid";

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