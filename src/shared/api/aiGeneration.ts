import axiosInstance from "../utils/axiosInstance";
import { endpoints } from "../utils/endpoints";

export interface AiNote {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

export interface AiGenerationRequest {
  prompt: string;
  context: any;
  maxTokens?: number;
  model?: string;
}

export interface AiGenerationResponse {
  notes: any[]; // Raw JSON output
  processedNotes: AiNote[]; // Converted to MidiNotes with IDs
  rawResponse?: string;
}

export interface AiQueueStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'canceled' | 'idle';
  provider?: string;
  createdAt?: number;
}

// Generate Notes
export async function generateNotes(request: AiGenerationRequest): Promise<AiGenerationResponse> {
  const response = await axiosInstance.post(endpoints.aiGeneration.generate, request);
  return response.data;
}

// Cancel Generation
export async function cancelGeneration(): Promise<void> {
  await axiosInstance.post(endpoints.aiGeneration.cancel);
}

// Check Status
export async function getGenerationStatus(): Promise<AiQueueStatus> {
  const response = await axiosInstance.get(endpoints.aiGeneration.status);
  return response.data;
}
