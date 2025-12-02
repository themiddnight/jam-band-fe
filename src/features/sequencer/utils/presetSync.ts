import * as userPresetsAPI from "@/shared/api/userPresets";
import type { SequencerPreset } from "../types";
import type { UserPreset } from "@/shared/api/userPresets";

// Helper to convert UserPreset to SequencerPreset
export const userPresetToSequencerPreset = (userPreset: UserPreset): SequencerPreset => {
  const data = userPreset.data as SequencerPreset;
  return {
    id: userPreset.id,
    name: userPreset.name,
    banks: data.banks,
    settings: data.settings,
    instrumentCategory: data.instrumentCategory,
    createdAt: data.createdAt || Date.now(),
  };
};

// Helper to convert SequencerPreset to API format
export const sequencerPresetToAPIData = (preset: SequencerPreset) => ({
  banks: preset.banks,
  settings: preset.settings,
  instrumentCategory: preset.instrumentCategory,
  createdAt: preset.createdAt,
});

// Load sequencer presets from API
export async function loadSequencerPresetsFromAPI(): Promise<SequencerPreset[]> {
  try {
    const response = await userPresetsAPI.getPresets("SEQUENCER");
    return response.presets.map(userPresetToSequencerPreset);
  } catch (error) {
    console.error("Error loading sequencer presets from API:", error);
    return [];
  }
}

// Save sequencer preset to API
export async function saveSequencerPresetToAPI(
  preset: SequencerPreset
): Promise<SequencerPreset> {
  try {
    const response = await userPresetsAPI.savePreset({
      presetType: "SEQUENCER",
      name: preset.name,
      data: sequencerPresetToAPIData(preset),
    });
    return userPresetToSequencerPreset(response.preset);
  } catch (error) {
    console.error("Error saving sequencer preset to API:", error);
    throw error;
  }
}

// Delete sequencer preset from API
export async function deleteSequencerPresetFromAPI(presetId: string): Promise<void> {
  try {
    await userPresetsAPI.deletePreset(presetId);
  } catch (error) {
    console.error("Error deleting sequencer preset from API:", error);
    throw error;
  }
}

// Sync presets from localStorage to API (for migration)
export async function syncPresetsToAPI(
  localPresets: SequencerPreset[]
): Promise<void> {
  try {
    for (const preset of localPresets) {
      try {
        await saveSequencerPresetToAPI(preset);
      } catch (error) {
        console.error(`Error syncing preset ${preset.name} to API:`, error);
      }
    }
  } catch (error) {
    console.error("Error syncing presets to API:", error);
  }
}

