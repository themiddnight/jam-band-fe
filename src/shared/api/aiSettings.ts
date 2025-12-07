import axiosInstance from "../utils/axiosInstance";
import { endpoints } from "../utils/endpoints";

export interface AiSettings {
  provider: string; // 'openai' | 'gemini'
  enabled: boolean;
  hasApiKey: boolean; // Computed by backend
  settings: any;
}

export interface UpdateAiSettingsRequest {
  provider: string;
  enabled: boolean;
  apiKey?: string; // Optional, only sent when changing
  settings?: any;
}

export interface AiSettingsResponse {
  settings: AiSettings;
}

// Get AI Settings
export async function getAiSettings(): Promise<AiSettingsResponse> {
  const response = await axiosInstance.get(endpoints.aiSettings);
  return response.data;
}

// Update AI Settings
export async function updateAiSettings(data: UpdateAiSettingsRequest): Promise<AiSettingsResponse> {
  const response = await axiosInstance.put(endpoints.aiSettings, data);
  return response.data;
}
