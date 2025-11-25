import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { useProjectStore } from '../../stores/projectStore';
import { useTrackStore } from '../../stores/trackStore';
import { useRecordingStore } from '../../stores/recordingStore';
import { useRegionStore } from '../../stores/regionStore';
import {
  startRecording,
  stopRecording,
  cancelRecording,
  requestMicrophoneAccess,
} from '../../utils/audioRecorder';
import { uploadAudioRegion } from '../../services/audioRegionApi';
import { useRoomStore } from '@/features/rooms';
import { useDAWCollaborationContext } from '../../contexts/useDAWCollaborationContext';
import type { DAWCollaborationContextValue } from '../../contexts/useDAWCollaborationContext';

const resolveAudioUrl = (url: string): string => {
  if (!url) {
    return url;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  return `${base}${url}`;
};

interface UseAudioRecordingEngineOptions {
  handleRegionAdd?: DAWCollaborationContextValue['handleRegionAdd'];
}

export const useAudioRecordingEngine = (options?: UseAudioRecordingEngineOptions) => {
  const { handleRegionAdd: contextHandleRegionAdd } = useDAWCollaborationContext();
  const handleRegionAdd = options?.handleRegionAdd ?? contextHandleRegionAdd;

  const transportState = useProjectStore((state) => state.transportState);
  const playhead = useProjectStore((state) => state.playhead);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const tracks = useTrackStore((state) => state.tracks);
  const updateRegionStore = useRegionStore((state) => state.updateRegion);
  const startRecordingPreview = useRecordingStore((state) => state.startRecording);
  const updateRecordingDuration = useRecordingStore((state) => state.updateRecordingDuration);
  const stopRecordingPreview = useRecordingStore((state) => state.stopRecording);
  const currentRoomId = useRoomStore((state) => state.currentRoom?.id);
  const currentUserId = useRoomStore((state) => state.currentUser?.id);

  const isRecordingRef = useRef(false);
  const recordingStartBeatRef = useRef(0);
  const recordingStartTimeRef = useRef(0);
  const durationUpdateIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    requestMicrophoneAccess().catch((error) => {
      console.error('Failed to request microphone access:', error);
    });
  }, []);

  useEffect(() => {
    const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

    if (
      transportState === 'recording' &&
      selectedTrack &&
      selectedTrack.type === 'audio' &&
      !isRecordingRef.current
    ) {
      isRecordingRef.current = true;
      recordingStartBeatRef.current = playhead;
      recordingStartTimeRef.current = Date.now();

      startRecordingPreview(selectedTrack.id, playhead, 'audio');

      durationUpdateIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        const bpm = Tone.Transport.bpm.value;
        const durationBeats = (elapsed / 1000) * (bpm / 60);
        updateRecordingDuration(durationBeats);
      }, 50);

      startRecording(playhead).catch((error) => {
        console.error('Failed to start recording:', error);
        isRecordingRef.current = false;
        stopRecordingPreview();
        if (durationUpdateIntervalRef.current) {
          clearInterval(durationUpdateIntervalRef.current);
          durationUpdateIntervalRef.current = null;
        }
      });
    }

    if (transportState !== 'recording' && isRecordingRef.current) {
      isRecordingRef.current = false;

      if (durationUpdateIntervalRef.current) {
        clearInterval(durationUpdateIntervalRef.current);
        durationUpdateIntervalRef.current = null;
      }

      stopRecording()
        .then(async (result) => {
          if (!selectedTrack || selectedTrack.type !== 'audio') {
            stopRecordingPreview();
            return;
          }

          const regionLength = Math.max(0.25, result.durationBeats);

          const applyLocalRegion = (audioUrl: string) => {
            const region = handleRegionAdd(selectedTrack.id, result.startBeat, regionLength, {
              type: 'audio',
              audioUrl,
              length: regionLength,
              originalLength: regionLength,
              trimStart: 0,
            });
            if (region) {
              // Store both audioBuffer and audioBlob for better save quality
              updateRegionStore(region.id, { 
                audioBuffer: result.audioBuffer,
                audioBlob: result.audioBlob, // Preserve original opus/webm format
              });
            }
          };

          if (!currentRoomId || !currentUserId) {
            applyLocalRegion(result.audioUrl);
            stopRecordingPreview();
            return;
          }

          const regionId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}`;

          try {
            const response = await uploadAudioRegion({
              roomId: currentRoomId,
              regionId,
              trackId: selectedTrack.id,
              userId: currentUserId,
              audioBlob: result.audioBlob,
              originalName: `recording-${regionId}.webm`,
            });

            const resolvedUrl = resolveAudioUrl(response.audioUrl);
            const region = handleRegionAdd(selectedTrack.id, result.startBeat, regionLength, {
              id: response.regionId,
              type: 'audio',
              audioUrl: resolvedUrl,
              length: regionLength,
              originalLength: regionLength,
              trimStart: 0,
            });

            if (region) {
              // Store both audioBuffer and audioBlob for better save quality
              updateRegionStore(region.id, { 
                audioBuffer: result.audioBuffer,
                audioBlob: result.audioBlob, // Preserve original opus/webm format
              });
            }
          } catch (error) {
            console.error('Failed to upload audio region:', error);
            applyLocalRegion(result.audioUrl);
          } finally {
            stopRecordingPreview();
          }
        })
        .catch((error) => {
          console.error('Failed to stop recording:', error);
          cancelRecording();
          stopRecordingPreview();
        });
    }
  }, [
    transportState,
    selectedTrackId,
    tracks,
    playhead,
    handleRegionAdd,
    currentRoomId,
    currentUserId,
    startRecordingPreview,
    updateRecordingDuration,
    stopRecordingPreview,
    updateRegionStore,
  ]);

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        cancelRecording();
      }
      if (durationUpdateIntervalRef.current) {
        clearInterval(durationUpdateIntervalRef.current);
      }
    };
  }, []);
};
