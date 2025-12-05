import { useRecordingStore, type RemoteRecordingPreview } from '../stores/recordingStore';

export const RecordingService = {
  setRemoteRecordingPreview: (preview: RemoteRecordingPreview) => 
    useRecordingStore.getState().setRemoteRecordingPreview(preview),
  removeRemoteRecordingPreview: (userId: string) => 
    useRecordingStore.getState().removeRemoteRecordingPreview(userId),
};
