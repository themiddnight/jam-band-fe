import type { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { SequencerStore } from "../../types/store";
import type { SequencerPreset, SequencerSettings } from "../../types";
import { buildCategoryUpdate } from "../../utils/sequencerUtils";
import { useUserStore } from "@/shared/stores/userStore";
import * as presetSync from "../../utils/presetSync";

export interface PresetSlice {
  savePreset: (name: string, instrumentCategory: string) => Promise<void>;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => Promise<void>;
  exportPreset: (presetId: string) => string;
  importPreset: (presetData: string) => Promise<void>;
  loadPresetsFromAPI: () => Promise<void>;
  syncPresetsToAPI: () => Promise<void>;
}

export const createPresetSlice: StateCreator<SequencerStore, [], [], PresetSlice> = (set, get) => ({
  savePreset: async (name, instrumentCategory) => {
    const state = get();
    const { isAuthenticated, userType } = useUserStore.getState();
    const isGuest = userType === "GUEST" || !isAuthenticated;

    // Exclude displayMode and editMode from saved settings (UI state only)
    const { speed, length, bankMode } = state.settings;
    const preset: SequencerPreset = {
      id: uuidv4(),
      name,
      banks: state.banks,
      settings: { speed, length, bankMode },
      instrumentCategory,
      createdAt: Date.now(),
    };

    if (!isGuest) {
      // Authenticated: save to API
      try {
        const serverPreset = await presetSync.saveSequencerPresetToAPI(preset);
        preset.id = serverPreset.id; // Use server ID
      } catch (error) {
        console.error("Error saving preset to API:", error);
        // Continue with local save even if API fails
      }
    }

    set((state) => {
      const updatedPresets = [...state.presets, preset];
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        presets: updatedPresets,
      });

      return {
        presets: updatedPresets,
        categoryStates: nextCategoryStates,
      };
    });
  },

  loadPreset: (presetId) => {
    const state = get();
    const preset = state.presets.find(p => p.id === presetId);
    if (!preset) return;

    set((currentState) => {
      const presetBanks = preset.banks;
      // Merge preset settings with current UI state (displayMode and editMode)
      const presetSettings: SequencerSettings = {
        ...preset.settings,
        displayMode: currentState.settings.displayMode,
        editMode: currentState.settings.editMode,
      };

      const { nextCategoryStates } = buildCategoryUpdate(currentState, {
        banks: presetBanks,
        settings: presetSettings,
        currentBeat: 0,
        selectedBeat: 0,
      });

      return {
        banks: presetBanks,
        settings: presetSettings,
        currentBeat: 0,
        selectedBeat: 0,
        categoryStates: nextCategoryStates,
      };
    });
  },

  deletePreset: async (presetId) => {
    const { isAuthenticated, userType } = useUserStore.getState();
    const isGuest = userType === "GUEST" || !isAuthenticated;

    if (!isGuest) {
      // Authenticated: delete from API
      try {
        await presetSync.deleteSequencerPresetFromAPI(presetId);
      } catch (error) {
        console.error("Error deleting preset from API:", error);
        // Continue with local delete even if API fails
      }
    }

    set((state) => {
      const updatedPresets = state.presets.filter(p => p.id !== presetId);
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        presets: updatedPresets,
      });

      return {
        presets: updatedPresets,
        categoryStates: nextCategoryStates,
      };
    });
  },

  exportPreset: (presetId) => {
    const state = get();
    const preset = state.presets.find(p => p.id === presetId);
    return preset ? JSON.stringify(preset, null, 2) : "";
  },

  importPreset: async (presetData) => {
    try {
      const { isAuthenticated, userType } = useUserStore.getState();
      const isGuest = userType === "GUEST" || !isAuthenticated;

      const preset: SequencerPreset = JSON.parse(presetData);
      // Regenerate ID to avoid conflicts
      preset.id = uuidv4();
      preset.createdAt = Date.now();

      if (!isGuest) {
        // Authenticated: save to API
        try {
          const serverPreset = await presetSync.saveSequencerPresetToAPI(preset);
          preset.id = serverPreset.id; // Use server ID
        } catch (error) {
          console.error("Error saving imported preset to API:", error);
          // Continue with local import even if API fails
        }
      }

      set((state) => {
        const updatedPresets = [...state.presets, preset];
        const { nextCategoryStates } = buildCategoryUpdate(state, {
          presets: updatedPresets,
        });

        return {
          presets: updatedPresets,
          categoryStates: nextCategoryStates,
        };
      });
    } catch (error) {
      console.error("Failed to import preset:", error);
    }
  },

  loadPresetsFromAPI: async () => {
    try {
      const apiPresets = await presetSync.loadSequencerPresetsFromAPI();
      set((state) => {
        const { nextCategoryStates } = buildCategoryUpdate(state, {
          presets: apiPresets,
        });
        return {
          presets: apiPresets,
          categoryStates: nextCategoryStates,
        };
      });
    } catch (error) {
      console.error("Error loading presets from API:", error);
    }
  },

  syncPresetsToAPI: async () => {
    const state = get();
    await presetSync.syncPresetsToAPI(state.presets);
  },
});
