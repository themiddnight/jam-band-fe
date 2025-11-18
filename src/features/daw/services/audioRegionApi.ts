import axiosInstance from '@/shared/utils/axiosInstance';
import { endpoints } from '@/shared/utils/endpoints';

export interface UploadAudioRegionParams {
  roomId: string;
  regionId: string;
  trackId: string;
  userId: string;
  audioBlob: Blob;
  originalName?: string;
}

export interface UploadAudioRegionResponse {
  success: boolean;
  regionId: string;
  audioUrl: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  sizeBytes: number;
  format: string;
}

export const uploadAudioRegion = async ({
  roomId,
  regionId,
  trackId,
  userId,
  audioBlob,
  originalName,
}: UploadAudioRegionParams): Promise<UploadAudioRegionResponse> => {
  const formData = new FormData();
  const filename = originalName || `recording-${regionId}.webm`;
  formData.append('audio', audioBlob, filename);
  formData.append('regionId', regionId);
  formData.append('trackId', trackId);
  formData.append('userId', userId);
  formData.append('originalName', filename);

  const { data } = await axiosInstance.post<UploadAudioRegionResponse>(
    endpoints.roomAudioRegions(roomId),
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return data;
};

