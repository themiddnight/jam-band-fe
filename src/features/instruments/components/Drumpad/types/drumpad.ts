import type { DrumPreset } from "../../../../../constants/presets/drumPresets";

export interface DrumPad {
  id: string;
  label: string;
  color: string;
  sound?: string;
  isPressed: boolean;
  keyboardShortcut: string;
  group: "A" | "B";
  volume?: number; // Individual pad volume multiplier
}

export interface DrumpadState {
  velocity: number;
  pressedPads: Set<string>;
  padAssignments: Record<string, string>;
  padVolumes: Record<string, number>; // Individual pad volume multipliers
  isEditMode: boolean; // Changed from isAssignMode
  selectedPadForAssign: string | null;
  currentInstrument: string;
}

export interface DrumpadActions {
  setVelocity: (velocity: number) => void;
  setPressedPads: (pads: Set<string>) => void;
  setPadAssignments: (assignments: Record<string, string>) => void;
  setPadVolumes: (volumes: Record<string, number>) => void;
  setPadVolume: (padId: string, volume: number) => void;
  setIsEditMode: (isEditMode: boolean) => void;
  setSelectedPadForAssign: (padId: string | null) => void;
  setCurrentInstrument: (instrument: string) => void;
  handlePadPress: (padId: string, sound?: string) => Promise<void>;
  handlePadRelease: (padId: string) => void;
  handleSoundAssignment: (sound: string) => void;
  resetAssignments: () => void;
  toggleEditMode: () => void;
  cancelAssignment: () => void;
  loadPreset: (preset: DrumPreset) => void;

  // Store actions
  savePreset: (
    name: string,
    description: string,
    padAssignments: Record<string, string>,
    padVolumes: Record<string, number>,
  ) => void;
  deletePreset: (presetId: string) => void;
  exportPreset: (preset: DrumPreset) => void;
  importPreset: (presetData: DrumPreset) => void;

  // Additional state
  pads: DrumPad[];
  currentPreset: DrumPreset | null;
}

export interface DrumpadProps {
  scaleState: {
    rootNote: string;
    scale: any;
    getScaleNotes: (root: string, scaleType: any, octave: number) => string[];
  };
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onPlayNotesLocal?: (
    notes: string[],
    velocity: number,
    isKeyHeld: boolean,
  ) => void;
  onStopNotes: (notes: string[]) => void;
  onStopSustainedNotes: () => void;
  onReleaseKeyHeldNote: (note: string) => void;
  onSustainChange: (sustain: boolean) => void;
  availableSamples: string[];
  currentInstrument?: string;
}

export interface PadButtonProps {
  pad: DrumPad;
  isEditMode: boolean;
  selectedPadForAssign: string | null;
  onPress: (isSliderClick?: boolean) => void;
  onRelease: () => void;
  onVolumeChange: (volume: number) => void;
  availableSamples?: string[];
}

export interface PresetManagerProps {
  currentPreset: DrumPreset | null;
  onLoadPreset: (preset: DrumPreset) => void;
  onSavePreset: (name: string, description: string) => void;
  onDeletePreset: (presetId: string) => void;
  onExportPreset: (preset: DrumPreset) => void;
  onImportPreset: (file: File) => void;
}

export interface SoundSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (sound: string) => void;
  onPreview: (sound: string) => void;
  availableSamples: string[];
  selectedPad: string | null;
  padShortcut: string | null;
}
