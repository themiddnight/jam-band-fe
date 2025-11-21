import { create } from 'zustand';
import type { TrackId } from '../types/daw';

export type RecordingType = 'midi' | 'audio';

export interface RemoteRecordingPreview {
  userId: string;
  username: string;
  trackId: TrackId;
  recordingType: RecordingType;
  startBeat: number;
  durationBeats: number;
}

export interface RecordingStoreState {
  isRecording: boolean;
  recordingType: RecordingType | null;
  recordingTrackId: TrackId | null;
  recordingStartBeat: number;
  recordingDurationBeats: number;
  remotePreviews: Record<string, RemoteRecordingPreview>;
  startRecording: (trackId: TrackId, startBeat: number, type: RecordingType) => void;
  updateRecordingDuration: (durationBeats: number) => void;
  stopRecording: () => void;
  setRemoteRecordingPreview: (preview: RemoteRecordingPreview) => void;
  removeRemoteRecordingPreview: (userId: string) => void;
  clearRemoteRecordingPreviews: () => void;
}

export const useRecordingStore = create<RecordingStoreState>((set) => ({
  isRecording: false,
  recordingType: null,
  recordingTrackId: null,
  recordingStartBeat: 0,
  recordingDurationBeats: 0,
  remotePreviews: {},
  startRecording: (trackId, startBeat, type) =>
    set({
      isRecording: true,
      recordingType: type,
      recordingTrackId: trackId,
      recordingStartBeat: startBeat,
      recordingDurationBeats: 0,
    }),
  updateRecordingDuration: (durationBeats) =>
    set({ recordingDurationBeats: durationBeats }),
  stopRecording: () =>
    set({
      isRecording: false,
      recordingType: null,
      recordingTrackId: null,
      recordingStartBeat: 0,
      recordingDurationBeats: 0,
    }),
  setRemoteRecordingPreview: (preview) =>
    set((state) => ({
      remotePreviews: {
        ...state.remotePreviews,
        [preview.userId]: preview,
      },
    })),
  removeRemoteRecordingPreview: (userId) =>
    set((state) => {
      if (!state.remotePreviews[userId]) {
        return state;
      }
      const next = { ...state.remotePreviews };
      delete next[userId];
      return { remotePreviews: next };
    }),
  clearRemoteRecordingPreviews: () => set({ remotePreviews: {} }),
}));


