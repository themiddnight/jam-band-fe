import { useState, useEffect, useCallback } from "react";
import type { SynthPreset, PresetManager, PresetBank } from "../types/presets";
import type { SynthState } from "../utils/InstrumentEngine";

const STORAGE_KEY = "jam-band-synth-presets";
const PRESET_VERSION = "1.0.0";

export const usePresetManager = (): PresetManager => {
  const [currentPreset, setCurrentPreset] = useState<SynthPreset | null>(null);
  const [presets, setPresets] = useState<SynthPreset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadPresetsFromStorage = () => {
    try {
      setIsLoading(true);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const presetBank: PresetBank = JSON.parse(stored);
        // Convert date strings back to Date objects
        const parsedPresets = presetBank.presets.map(preset => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: new Date(preset.updatedAt)
        }));
        setPresets(parsedPresets);
      }
      setError(null);
    } catch (err) {
      setError("Failed to load presets from storage");
      console.error("Error loading presets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load presets from localStorage on initialization
  useEffect(() => {
    loadPresetsFromStorage();
  }, []);

  const savePresetsToStorage = useCallback((presetsToSave: SynthPreset[]) => {
    try {
      const presetBank: PresetBank = {
        presets: presetsToSave,
        version: PRESET_VERSION
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presetBank));
    } catch (err) {
      setError("Failed to save presets to storage");
      console.error("Error saving presets:", err);
    }
  }, []);

  const savePreset = useCallback((
    name: string,
    synthType: "analog" | "fm",
    polyphony: "mono" | "poly",
    parameters: SynthState
  ) => {
    try {
      const now = new Date();
      const newPreset: SynthPreset = {
        id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        synthType,
        polyphony,
        parameters: { ...parameters },
        createdAt: now,
        updatedAt: now
      };

      const updatedPresets = [...presets, newPreset];
      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets);
      setCurrentPreset(newPreset);
      setError(null);
    } catch (err) {
      setError("Failed to save preset");
      console.error("Error saving preset:", err);
    }
  }, [presets, savePresetsToStorage]);

  const loadPreset = useCallback((preset: SynthPreset) => {
    setCurrentPreset(preset);
    setError(null);
  }, []);

  const deletePreset = useCallback((presetId: string) => {
    try {
      const updatedPresets = presets.filter(preset => preset.id !== presetId);
      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets);
      
      // Clear current preset if it was deleted
      if (currentPreset?.id === presetId) {
        setCurrentPreset(null);
      }
      
      setError(null);
    } catch (err) {
      setError("Failed to delete preset");
      console.error("Error deleting preset:", err);
    }
  }, [presets, currentPreset, savePresetsToStorage]);

  const exportPresets = useCallback((): string => {
    try {
      const presetBank: PresetBank = {
        presets,
        version: PRESET_VERSION
      };
      return JSON.stringify(presetBank, null, 2);
    } catch (err) {
      setError("Failed to export presets");
      console.error("Error exporting presets:", err);
      return "";
    }
  }, [presets]);

  const importPresets = useCallback((data: string) => {
    try {
      const presetBank: PresetBank = JSON.parse(data);
      
      // Validate the imported data
      if (!presetBank.presets || !Array.isArray(presetBank.presets)) {
        throw new Error("Invalid preset data format");
      }

      // Convert date strings back to Date objects and merge with existing presets
      const importedPresets = presetBank.presets.map(preset => ({
        ...preset,
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate new IDs to avoid conflicts
        createdAt: new Date(preset.createdAt),
        updatedAt: new Date(preset.updatedAt)
      }));

      const updatedPresets = [...presets, ...importedPresets];
      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets);
      setError(null);
    } catch (err) {
      setError("Failed to import presets");
      console.error("Error importing presets:", err);
    }
  }, [presets, savePresetsToStorage]);

  const getPresetsForSynth = useCallback((
    synthType: "analog" | "fm",
    polyphony: "mono" | "poly"
  ): SynthPreset[] => {
    return presets.filter(preset => 
      preset.synthType === synthType && preset.polyphony === polyphony
    );
  }, [presets]);

  return {
    currentPreset,
    presets,
    isLoading,
    error,
    savePreset,
    loadPreset,
    deletePreset,
    exportPresets,
    importPresets,
    getPresetsForSynth
  };
}; 