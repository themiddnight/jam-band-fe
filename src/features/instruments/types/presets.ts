import type { SynthState } from "@/features/instruments";

export interface SynthPreset {
  id: string;
  name: string;
  synthType: "analog" | "fm";
  polyphony: "mono" | "poly";
  parameters: SynthState;
  createdAt: Date;
  updatedAt: Date;
}

export interface PresetBank {
  presets: SynthPreset[];
  version: string;
}

export interface PresetManagerState {
  currentPreset: SynthPreset | null;
  presets: SynthPreset[];
  isLoading: boolean;
  error: string | null;
}

export interface PresetManagerActions {
  savePreset: (
    name: string,
    synthType: "analog" | "fm",
    polyphony: "mono" | "poly",
    parameters: SynthState,
  ) => Promise<void>;
  loadPreset: (preset: SynthPreset) => void;
  deletePreset: (presetId: string) => Promise<void>;
  exportPresets: () => string;
  importPresets: (data: string, mode?: 'replace' | 'merge') => Promise<void>;
  getPresetsForSynth: (
    synthType: "analog" | "fm",
    polyphony: "mono" | "poly",
  ) => SynthPreset[];
}

export type PresetManager = PresetManagerState & PresetManagerActions;
