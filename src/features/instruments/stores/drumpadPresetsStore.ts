import {
  DEFAULT_DRUM_PRESETS,
  getDefaultPreset,
  createSmartAssignments,
  type DrumPreset,
} from "../../../constants/presets/drumPresets";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface DrumpadPresetsState {
  presets: Record<string, DrumPreset[]>;
  currentPreset: DrumPreset | null;
  currentInstrument: string;

  // Actions
  loadPreset: (preset: DrumPreset) => void;
  savePreset: (
    name: string,
    description: string,
    padAssignments: Record<string, string>,
    padVolumes: Record<string, number>,
  ) => void;
  deletePreset: (presetId: string) => void;
  exportPreset: (preset: DrumPreset) => void;
  importPreset: (presetData: DrumPreset) => void;
  setCurrentInstrument: (instrument: string) => void;
  getPresetsForCurrentInstrument: () => DrumPreset[];
  createSmartDefaultPreset: (
    instrument: string,
    availableSamples: string[],
  ) => DrumPreset;
  resetToDefaults: () => void;
}

export const useDrumpadPresetsStore = create<DrumpadPresetsState>()(
  persist(
    (set, get) => ({
      presets: DEFAULT_DRUM_PRESETS,
      currentPreset: null,
      currentInstrument: "TR-808",

      loadPreset: (preset: DrumPreset) => {
        set({ currentPreset: preset });
      },

      savePreset: (
        name: string,
        description: string,
        padAssignments: Record<string, string>,
        padVolumes: Record<string, number>,
      ) => {
        const { currentInstrument, presets } = get();
        const newPreset: DrumPreset = {
          id: `custom-${Date.now()}`,
          name,
          description,
          drumMachine: currentInstrument,
          padAssignments: { ...padAssignments },
          padVolumes: { ...padVolumes },
        };

        const currentMachinePresets = presets[currentInstrument] || [];
        const updatedPresets = {
          ...presets,
          [currentInstrument]: [...currentMachinePresets, newPreset],
        };

        set({
          presets: updatedPresets,
          currentPreset: newPreset,
        });
      },

      deletePreset: (presetId: string) => {
        const { currentInstrument, presets, currentPreset } = get();
        const currentMachinePresets = presets[currentInstrument] || [];
        const filteredPresets = currentMachinePresets.filter(
          (p) => p.id !== presetId,
        );

        const updatedPresets = {
          ...presets,
          [currentInstrument]: filteredPresets,
        };

        // If deleted preset was current, reset to null
        const newCurrentPreset =
          currentPreset?.id === presetId ? null : currentPreset;

        set({
          presets: updatedPresets,
          currentPreset: newCurrentPreset,
        });
      },

      exportPreset: (preset: DrumPreset) => {
        const dataStr = JSON.stringify(preset, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${preset.name.toLowerCase().replace(/\s+/g, "-")}-preset.json`;
        link.click();
        URL.revokeObjectURL(url);
      },

      importPreset: (presetData: DrumPreset) => {
        try {
          const { presets } = get();
          const targetInstrument = presetData.drumMachine;
          const currentMachinePresets = presets[targetInstrument] || [];

          // Add imported preset with new ID to avoid conflicts
          const importedPreset = {
            ...presetData,
            id: `imported-${Date.now()}`,
            name: `${presetData.name} (Imported)`,
          };

          const updatedPresets = {
            ...presets,
            [targetInstrument]: [...currentMachinePresets, importedPreset],
          };

          set({ presets: updatedPresets });
        } catch (error) {
          console.error("Failed to import preset:", error);
          throw new Error("Invalid preset file format");
        }
      },

      createSmartDefaultPreset: (
        instrument: string,
        availableSamples: string[],
      ): DrumPreset => {
        const smartAssignments = createSmartAssignments(availableSamples);
        // Initialize all pad volumes to 1.0 (default multiplier)
        const defaultPadVolumes: Record<string, number> = {};
        for (let i = 0; i < 16; i++) {
          defaultPadVolumes[`pad-${i}`] = 1.0;
        }

        return {
          id: `${instrument.toLowerCase()}-default`,
          name: "Default",
          description: `Default ${instrument} layout with smart assignments`,
          drumMachine: instrument,
          padAssignments: smartAssignments,
          padVolumes: defaultPadVolumes,
        };
      },

      setCurrentInstrument: (instrument: string) => {
        const defaultPreset = getDefaultPreset(instrument);
        set({
          currentInstrument: instrument,
          currentPreset: defaultPreset,
        });
      },

      getPresetsForCurrentInstrument: () => {
        const { currentInstrument, presets } = get();
        return presets[currentInstrument] || [];
      },

      resetToDefaults: () => {
        set({
          presets: DEFAULT_DRUM_PRESETS,
          currentPreset: null,
        });
      },
    }),
    {
      name: "drumpad-presets",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        presets: state.presets,
        currentPreset: state.currentPreset,
        currentInstrument: state.currentInstrument,
      }),
    },
  ),
);
