import { useTrackStore } from '../trackStore';

// Selectors
export const selectTracks = (state: { tracks: any[] }) => state.tracks;
export const selectSelectedTrackId = (state: { selectedTrackId: string | null }) => state.selectedTrackId;
export const selectTrackById = (trackId: string) => (state: { tracks: any[] }) =>
  state.tracks.find((t) => t.id === trackId);

// Hook wrappers
export const useTracks = () => useTrackStore(selectTracks);
export const useSelectedTrackId = () => useTrackStore(selectSelectedTrackId);
export const useTrack = (trackId: string) => useTrackStore(selectTrackById(trackId));

// Action selectors
export const useTrackActions = () => useTrackStore((state) => ({
  addTrack: state.addTrack,
  removeTrack: state.removeTrack,
  updateTrack: state.updateTrack,
  setTrackName: state.setTrackName,
  setTrackVolume: state.setTrackVolume,
  setTrackPan: state.setTrackPan,
  toggleMute: state.toggleMute,
  toggleSolo: state.toggleSolo,
  moveTrackUp: state.moveTrackUp,
  moveTrackDown: state.moveTrackDown,
  reorderTrack: state.reorderTrack,
  setTrackInstrument: state.setTrackInstrument,
  attachRegionToTrack: state.attachRegionToTrack,
  detachRegionFromTrack: state.detachRegionFromTrack,
  selectTrack: state.selectTrack,
  clearTracks: state.clearTracks,
}));
