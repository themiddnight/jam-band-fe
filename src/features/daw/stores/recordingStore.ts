import { create } from 'zustand';
import type { TrackId } from '../types/daw';

type RecordingType = 'midi' | 'audio';

interface RecordingStoreState {
  isRecording: boolean;
  recordingType: RecordingType | null;
  recordingTrackId: TrackId | null;
  recordingStartBeat: number;
  recordingDurationBeats: number;
  startRecording: (trackId: TrackId, startBeat: number, type: RecordingType) => void;
  updateRecordingDuration: (durationBeats: number) => void;
  stopRecording: () => void;
}

export const useRecordingStore = create<RecordingStoreState>((set) => ({
  isRecording: false,
  recordingType: null,
  recordingTrackId: null,
  recordingStartBeat: 0,
  recordingDurationBeats: 0,
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
}));

