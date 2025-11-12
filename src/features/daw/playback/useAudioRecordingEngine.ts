import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { useProjectStore } from '../stores/projectStore';
import { useRegionStore } from '../stores/regionStore';
import { useTrackStore } from '../stores/trackStore';
import { useRecordingStore } from '../stores/recordingStore';
import {
  startRecording,
  stopRecording,
  cancelRecording,
  requestMicrophoneAccess,
} from '../utils/audioRecorder';

export const useAudioRecordingEngine = () => {
  const transportState = useProjectStore((state) => state.transportState);
  const playhead = useProjectStore((state) => state.playhead);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const tracks = useTrackStore((state) => state.tracks);
  const addAudioRegion = useRegionStore((state) => state.addAudioRegion);
  const startRecordingPreview = useRecordingStore((state) => state.startRecording);
  const updateRecordingDuration = useRecordingStore((state) => state.updateRecordingDuration);
  const stopRecordingPreview = useRecordingStore((state) => state.stopRecording);
  
  const isRecordingRef = useRef(false);
  const recordingStartBeatRef = useRef(0);
  const recordingStartTimeRef = useRef(0);
  const durationUpdateIntervalRef = useRef<number | null>(null);

  // Request microphone access when component mounts
  useEffect(() => {
    requestMicrophoneAccess().catch((error) => {
      console.error('Failed to request microphone access:', error);
    });
  }, []);

  useEffect(() => {
    const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
    
    // Start recording if:
    // 1. Transport is in recording state
    // 2. An audio track is selected
    // 3. Not already recording
    if (
      transportState === 'recording' &&
      selectedTrack &&
      selectedTrack.type === 'audio' &&
      !isRecordingRef.current
    ) {
      isRecordingRef.current = true;
      recordingStartBeatRef.current = playhead;
      recordingStartTimeRef.current = Date.now();
      
      // Start recording preview
      startRecordingPreview(selectedTrack.id, playhead, 'audio');
      
      // Update duration every 50ms
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

    // Stop recording if:
    // 1. Transport is no longer recording
    // 2. Currently recording
    if (transportState !== 'recording' && isRecordingRef.current) {
      isRecordingRef.current = false;
      
      // Stop duration updates
      if (durationUpdateIntervalRef.current) {
        clearInterval(durationUpdateIntervalRef.current);
        durationUpdateIntervalRef.current = null;
      }
      
      stopRecording()
        .then((result) => {
          if (selectedTrack) {
            addAudioRegion(
              selectedTrack.id,
              result.startBeat,
              result.durationBeats,
              result.audioUrl,
              result.audioBuffer
            );
          }
          stopRecordingPreview();
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
    addAudioRegion,
    startRecordingPreview,
    updateRecordingDuration,
    stopRecordingPreview,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        cancelRecording();
      }
    };
  }, []);
};

