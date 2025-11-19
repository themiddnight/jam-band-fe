import { useRef, useState } from 'react';
import { useDAWCollaborationContext } from '../../contexts/DAWCollaborationContext';
import { useProjectStore } from '../../stores/projectStore';
import { useTrackStore } from '../../stores/trackStore';
import { useRoomStore } from '@/features/rooms/stores/roomStore';
import axiosInstance from '@/shared/utils/axiosInstance';
import { endpoints } from '@/shared/utils/endpoints';

interface AddAudioClipButtonProps {
  disabled?: boolean;
}

export const AddAudioClipButton = ({ disabled }: AddAudioClipButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const tracks = useTrackStore((state) => state.tracks);
  const playhead = useProjectStore((state) => state.playhead);
  const { handleRegionAdd } = useDAWCollaborationContext();
  const roomId = useRoomStore((state) => state.currentRoom?.id);
  const userId = useRoomStore((state) => state.currentUser?.id);

  const selectedTrack = selectedTrackId ? tracks.find((t) => t.id === selectedTrackId) : null;
  const isEnabled = !disabled && selectedTrack?.type === 'audio' && !isUploading;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTrackId || !roomId || !userId) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file');
      return;
    }

    // Validate file size (max 100MB for safety)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setError('File size exceeds 100MB limit');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Generate region ID
      const regionId = crypto.randomUUID();

      // Prepare form data
      const formData = new FormData();
      formData.append('audio', file, file.name);
      formData.append('regionId', regionId);
      formData.append('trackId', selectedTrackId);
      formData.append('userId', userId);
      formData.append('originalName', file.name);

      // Upload to backend with progress tracking
      const { data: response } = await axiosInstance.post(
        endpoints.roomAudioRegions(roomId),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 70) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            }
          },
        }
      );

      setUploadProgress(75);

      // Decode audio for waveform (in background, non-blocking)
      const arrayBuffer = await file.arrayBuffer();
      setUploadProgress(80);
      
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      await audioContext.close();

      setUploadProgress(90);

      // Calculate length in beats
      const bpm = useProjectStore.getState().bpm;
      const durationBeats = (response.durationSeconds / 60) * bpm;

      // Create audio region at playhead
      handleRegionAdd(selectedTrackId, playhead, durationBeats, {
        id: regionId,
        type: 'audio',
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        audioUrl: response.audioUrl,
        audioBuffer,
        originalLength: durationBeats,
        trimStart: 0,
        gain: 0,
        fadeInDuration: 0,
        fadeOutDuration: 0,
      });

      setUploadProgress(100);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Clear progress after a short delay
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);
    } catch (err) {
      console.error('Failed to upload audio clip:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload audio clip');
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    if (isEnabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        className="btn btn-xs btn-ghost relative"
        onClick={handleButtonClick}
        disabled={!isEnabled}
        title={
          !selectedTrack
            ? 'Select an audio track first'
            : selectedTrack.type !== 'audio'
              ? 'Select an audio track to add clips'
              : isUploading
                ? 'Uploading...'
                : 'Add Audio Clip at Playhead'
        }
      >
        {isUploading ? (
          <>
            <span className="loading loading-spinner loading-xs"></span>
            <span className="text-xs ml-1">{uploadProgress}%</span>
          </>
        ) : (
          '🎵'
        )}
      </button>
      {error && (
        <div className="toast toast-top toast-end">
          <div className="alert alert-error">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};
