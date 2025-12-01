import axiosInstance from "../utils/axiosInstance";
import { endpoints } from "../utils/endpoints";

export type PresetType = "SYNTH" | "EFFECT" | "SEQUENCER" | "INSTRUMENT";

export interface UserPreset {
  id: string;
  userId: string;
  presetType: PresetType;
  name: string;
  data: any; // JSON data
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  settingsType: string;
  data: any; // JSON data
  updatedAt: string;
}

export interface GetPresetsResponse {
  presets: UserPreset[];
}

export interface SavePresetRequest {
  presetType: PresetType;
  name: string;
  data: any;
}

export interface SavePresetResponse {
  preset: UserPreset;
}

export interface UpdatePresetRequest {
  name?: string;
  data?: any;
}

export interface GetSettingsResponse {
  settings: UserSettings[];
}

export interface UpdateSettingsRequest {
  settingsType: string;
  data: any;
}

export interface UpdateSettingsResponse {
  settings: UserSettings;
}

// Get all user presets (optionally filtered by type)
export async function getPresets(
  type?: PresetType
): Promise<GetPresetsResponse> {
  const response = await axiosInstance.get(endpoints.getUserPresets(type));
  return response.data;
}

// Save a new preset
export async function savePreset(
  data: SavePresetRequest
): Promise<SavePresetResponse> {
  const response = await axiosInstance.post(endpoints.savePreset, data);
  return response.data;
}

// Update an existing preset
export async function updatePreset(
  id: string,
  data: UpdatePresetRequest
): Promise<SavePresetResponse> {
  const response = await axiosInstance.put(endpoints.updatePreset(id), data);
  return response.data;
}

// Delete a preset
export async function deletePreset(id: string): Promise<{ message: string }> {
  const response = await axiosInstance.delete(endpoints.deletePreset(id));
  return response.data;
}

// Get user settings (optionally filtered by type)
export async function getSettings(
  type?: string
): Promise<GetSettingsResponse> {
  const response = await axiosInstance.get(endpoints.getUserSettings(type));
  return response.data;
}

// Update user settings
export async function updateSettings(
  data: UpdateSettingsRequest
): Promise<UpdateSettingsResponse> {
  const response = await axiosInstance.put(endpoints.updateUserSettings, data);
  return response.data;
}

