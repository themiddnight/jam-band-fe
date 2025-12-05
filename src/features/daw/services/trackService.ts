import { useTrackStore } from '../stores/trackStore';
import type { Track, TrackId } from '../types/daw';
import { InstrumentCategory } from '@/shared/constants/instruments';

/**
 * Service for interacting with the Track Store.
 * Abstracts direct Zustand store access (getState).
 */
export const TrackService = {
  // Getters
  getTracks: (): Track[] => useTrackStore.getState().tracks,
  getTrack: (trackId: TrackId): Track | undefined => 
    useTrackStore.getState().tracks.find((t) => t.id === trackId),
  
  // Actions
  clearTracks: () => useTrackStore.getState().clearTracks(),
  
  // Region management
  attachRegionToTrack: (trackId: TrackId, regionId: string) => 
    useTrackStore.getState().attachRegionToTrack(trackId, regionId),
  detachRegionFromTrack: (trackId: TrackId, regionId: string) => 
    useTrackStore.getState().detachRegionFromTrack(trackId, regionId),
    
  // Sync actions
  syncSetTracks: (tracks: Track[]) => useTrackStore.getState().syncSetTracks(tracks),
  syncAddTrack: (track: Track) => useTrackStore.getState().syncAddTrack(track),
  syncUpdateTrack: (trackId: TrackId, updates: Partial<Track>) => 
    useTrackStore.getState().syncUpdateTrack(trackId, updates),
  syncRemoveTrack: (trackId: TrackId) => useTrackStore.getState().syncRemoveTrack(trackId),
  syncSetTrackInstrument: (
    trackId: TrackId, 
    instrumentId: string, 
    instrumentCategory?: InstrumentCategory
  ) => useTrackStore.getState().syncSetTrackInstrument(trackId, instrumentId, instrumentCategory),
  syncReorderTracks: (trackIds: TrackId[]) => useTrackStore.getState().syncReorderTracks(trackIds),
};
