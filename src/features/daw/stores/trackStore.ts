import { create } from 'zustand';

import {
  DEFAULT_INSTRUMENT_ID,
  DEFAULT_TRACK_COLOR,
} from '../types/daw';
import { InstrumentCategory } from '@/shared/constants/instruments';
import type { Track, TrackId } from '../types/daw';

const TRACK_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#f97316', // orange
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#14b8a6', // teal
  '#ef4444', // red
];

interface TrackStoreState {
  tracks: Track[];
  selectedTrackId: TrackId | null;
  addTrack: (overrides?: Partial<Track>) => Track;
  removeTrack: (trackId: TrackId) => void;
  updateTrack: (trackId: TrackId, updates: Partial<Track>) => void;
  setTrackName: (trackId: TrackId, name: string) => void;
  setTrackVolume: (trackId: TrackId, volume: number) => void;
  setTrackPan: (trackId: TrackId, pan: number) => void;
  toggleMute: (trackId: TrackId, value?: boolean) => void;
  toggleSolo: (trackId: TrackId, value?: boolean) => void;
  moveTrackUp: (trackId: TrackId) => void;
  moveTrackDown: (trackId: TrackId) => void;
  reorderTrack: (trackId: TrackId, newIndex: number) => void;
  setTrackInstrument: (
    trackId: TrackId,
    instrumentId: string,
    instrumentCategory?: InstrumentCategory,
  ) => void;
  attachRegionToTrack: (trackId: TrackId, regionId: string) => void;
  detachRegionFromTrack: (trackId: TrackId, regionId: string) => void;
  selectTrack: (trackId: TrackId | null) => void;
  clearTracks: () => void;
  // Sync handlers (bypass undo history)
  syncSetTracks: (tracks: Track[]) => void;
  syncAddTrack: (track: Track) => void;
  syncUpdateTrack: (trackId: TrackId, updates: Partial<Track>) => void;
  syncRemoveTrack: (trackId: TrackId) => void;
  syncSetTrackInstrument: (
    trackId: TrackId,
    instrumentId: string,
    instrumentCategory?: InstrumentCategory,
  ) => void;
  syncSelectTrack: (trackId: TrackId | null) => void;
  syncReorderTracks: (trackIds: TrackId[]) => void;
}

const createTrack = (index: number, overrides?: Partial<Track>): Track => {
  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };
  const id = overrides?.id ?? generateId();
  const color = overrides?.color ?? TRACK_COLORS[index % TRACK_COLORS.length] ?? DEFAULT_TRACK_COLOR;
  const type = overrides?.type ?? 'midi';
  const trackName = overrides?.name ?? `${type === 'audio' ? 'Audio' : 'MIDI'} ${index + 1}`;

  return {
    id,
    name: trackName,
    type,
    instrumentId: type === 'midi' ? (overrides?.instrumentId ?? DEFAULT_INSTRUMENT_ID) : undefined,
    instrumentCategory: type === 'midi' ? (overrides?.instrumentCategory ?? InstrumentCategory.Melodic) : undefined,
    volume: overrides?.volume ?? 0.8,
    pan: overrides?.pan ?? 0,
    mute: overrides?.mute ?? false,
    solo: overrides?.solo ?? false,
    color,
    regionIds: overrides?.regionIds ?? [],
  };
};

export const useTrackStore = create<TrackStoreState>((set, get) => ({
  tracks: [],
  selectedTrackId: null,
  addTrack: (overrides) => {
    const index = get().tracks.length;
    const track = createTrack(index, overrides);
    set((state) => ({
      tracks: [...state.tracks, track],
      selectedTrackId: track.id,
    }));
    return track;
  },
  removeTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.filter((track) => track.id !== trackId),
      selectedTrackId:
        state.selectedTrackId === trackId ? null : state.selectedTrackId,
    })),
  updateTrack: (trackId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, ...updates } : track
      ),
    })),
  setTrackName: (trackId, name) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, name } : track
      ),
    })),
  setTrackVolume: (trackId, volume) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, volume: Math.min(Math.max(volume, 0), 1) } : track
      ),
    })),
  setTrackPan: (trackId, pan) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? { ...track, pan: Math.min(Math.max(pan, -1), 1) }
          : track
      ),
    })),
  toggleMute: (trackId, value) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? { ...track, mute: typeof value === 'boolean' ? value : !track.mute }
          : track
      ),
    })),
  toggleSolo: (trackId, value) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? { ...track, solo: typeof value === 'boolean' ? value : !track.solo }
          : track
      ),
    })),
  moveTrackUp: (trackId) =>
    set((state) => {
      const index = state.tracks.findIndex((track) => track.id === trackId);
      if (index <= 0) {
        return state;
      }

      const updatedTracks = [...state.tracks];
      [updatedTracks[index - 1], updatedTracks[index]] = [
        updatedTracks[index],
        updatedTracks[index - 1],
      ];

      return { ...state, tracks: updatedTracks };
    }),
  moveTrackDown: (trackId) =>
    set((state) => {
      const index = state.tracks.findIndex((track) => track.id === trackId);
      if (index === -1 || index >= state.tracks.length - 1) {
        return state;
      }

      const updatedTracks = [...state.tracks];
      [updatedTracks[index], updatedTracks[index + 1]] = [
        updatedTracks[index + 1],
        updatedTracks[index],
      ];

      return { ...state, tracks: updatedTracks };
    }),
  reorderTrack: (trackId, newIndex) =>
    set((state) => {
      const currentIndex = state.tracks.findIndex((track) => track.id === trackId);
      if (currentIndex === -1 || newIndex < 0 || newIndex >= state.tracks.length) {
        return state;
      }

      const updatedTracks = [...state.tracks];
      const [movedTrack] = updatedTracks.splice(currentIndex, 1);
      updatedTracks.splice(newIndex, 0, movedTrack);

      return { ...state, tracks: updatedTracks };
    }),
  setTrackInstrument: (trackId, instrumentId, instrumentCategory) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? {
            ...track,
            instrumentId,
            instrumentCategory:
              instrumentCategory ?? track.instrumentCategory,
          }
          : track
      ),
    })),
  attachRegionToTrack: (trackId, regionId) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId && !track.regionIds.includes(regionId)
          ? { ...track, regionIds: [...track.regionIds, regionId] }
          : track
      ),
    })),
  detachRegionFromTrack: (trackId, regionId) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? {
            ...track,
            regionIds: track.regionIds.filter((id) => id !== regionId),
          }
          : track
      ),
    })),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  clearTracks: () => set({ tracks: [], selectedTrackId: null }),
  // Sync handlers (bypass undo history - called from DAWSyncService)
  syncSetTracks: (tracks) => set({ tracks }),
  syncAddTrack: (track) =>
    set((state) => {
      const exists = state.tracks.some((t) => t.id === track.id);
      if (exists) {
        return state;
      }

      return {
        tracks: [...state.tracks, track],
        selectedTrackId: state.selectedTrackId ?? track.id,
      };
    }),
  syncUpdateTrack: (trackId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, ...updates } : track
      ),
    })),
  syncRemoveTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.filter((track) => track.id !== trackId),
      selectedTrackId:
        state.selectedTrackId === trackId ? null : state.selectedTrackId,
    })),
  syncSetTrackInstrument: (trackId, instrumentId, instrumentCategory) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? {
            ...track,
            instrumentId,
            instrumentCategory:
              instrumentCategory ?? track.instrumentCategory,
          }
          : track
      ),
    })),
  syncSelectTrack: (trackId) => set({ selectedTrackId: trackId }),
  syncReorderTracks: (trackIds) =>
    set((state) => {
      // Reorder tracks based on the provided order of track IDs
      const trackMap = new Map(state.tracks.map((track) => [track.id, track]));
      const reorderedTracks = trackIds
        .map((id) => trackMap.get(id))
        .filter((track): track is Track => track !== undefined);

      // Add any tracks that weren't in the reorder list (shouldn't happen, but safety check)
      const existingIds = new Set(trackIds);
      const remainingTracks = state.tracks.filter((track) => !existingIds.has(track.id));

      return { ...state, tracks: [...reorderedTracks, ...remainingTracks] };
    }),
}));

