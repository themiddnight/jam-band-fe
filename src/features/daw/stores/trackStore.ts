import { create } from 'zustand';

import {
  DEFAULT_INSTRUMENT_ID,
  DEFAULT_TRACK_COLOR,
} from '../types/daw';
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
  setTrackInstrument: (trackId: TrackId, instrumentId: string) => void;
  attachRegionToTrack: (trackId: TrackId, regionId: string) => void;
  detachRegionFromTrack: (trackId: TrackId, regionId: string) => void;
  selectTrack: (trackId: TrackId | null) => void;
  clearTracks: () => void;
}

const createTrack = (index: number, overrides?: Partial<Track>): Track => {
  const id = overrides?.id ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now()));
  const color = overrides?.color ?? TRACK_COLORS[index % TRACK_COLORS.length] ?? DEFAULT_TRACK_COLOR;
  const type = overrides?.type ?? 'midi';
  const trackName = overrides?.name ?? `${type === 'audio' ? 'Audio' : 'MIDI'} ${index + 1}`;

  return {
    id,
    name: trackName,
    type,
    instrumentId: type === 'midi' ? (overrides?.instrumentId ?? DEFAULT_INSTRUMENT_ID) : undefined,
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
  setTrackInstrument: (trackId, instrumentId) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, instrumentId } : track
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
}));

