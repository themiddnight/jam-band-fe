import { create } from 'zustand';

import { useTrackStore } from './trackStore';
import type {
  MidiRegion,
  AudioRegion,
  Region,
  RegionId,
  TrackId,
} from '../types/daw';

interface RegionStoreState {
  regions: Region[];
  selectedRegionIds: RegionId[];
  lastSelectedRegionId: RegionId | null;
  addRegion: (trackId: TrackId, start: number, length?: number, options?: { id?: string }) => MidiRegion;
  addAudioRegion: (
    trackId: TrackId,
    start: number,
    length: number,
    audioUrl: string,
    audioBuffer?: AudioBuffer,
    options?: { id?: string }
  ) => AudioRegion;
  updateRegion: (regionId: RegionId, updates: Partial<Region>) => void;
  removeRegion: (regionId: RegionId) => void;
  moveRegion: (regionId: RegionId, deltaBeats: number) => void;
  moveRegions: (regionIds: RegionId[], deltaBeats: number) => void;
  moveRegionsToTrack: (regionIds: RegionId[], targetTrackId: TrackId, deltaBeats?: number) => void;
  resizeRegion: (regionId: RegionId, newLength: number) => void;
  setRegionLoop: (regionId: RegionId, loopEnabled: boolean, loopIterations?: number) => void;
  selectRegion: (regionId: RegionId, additive?: boolean) => void;
  selectRegions: (regionIds: RegionId[]) => void;
  toggleRegionSelection: (regionId: RegionId) => void;
  deselectRegion: (regionId: RegionId) => void;
  clearSelection: () => void;
  duplicateRegion: (regionId: RegionId, offsetBeats: number) => Region | null;
  splitRegions: (regionIds: RegionId[], splitPosition: number) => void;
  // Sync handlers (bypass undo history)
  syncSetRegions: (regions: Region[]) => void;
  syncAddRegion: (region: Region) => void;
  syncUpdateRegion: (regionId: RegionId, updates: Partial<Region>) => void;
  syncRemoveRegion: (regionId: RegionId) => void;
  syncMoveRegion: (regionId: RegionId, newStart: number) => void;
  syncSelectRegions: (regionIds: RegionId[]) => void;
}

const clampLength = (length: number) => Math.max(length, 0.25);

const createRegion = (
  trackId: TrackId,
  index: number,
  start: number,
  length = 4,
  customId?: string
): MidiRegion => {
  const id =
    customId ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${index}`);
  const track = useTrackStore.getState().tracks.find((t) => t.id === trackId);

  return {
    id,
    trackId,
    type: 'midi',
    name: `Region ${index + 1}`,
    start,
    length,
    loopEnabled: false,
    loopIterations: 1,
    notes: [],
    sustainEvents: [],
    color: track?.color ?? '#6b7280',
  };
};

const createAudioRegion = (
  trackId: TrackId,
  index: number,
  start: number,
  length: number,
  audioUrl: string,
  audioBuffer?: AudioBuffer,
  customId?: string
): AudioRegion => {
  const id =
    customId ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${index}`);
  const track = useTrackStore.getState().tracks.find((t) => t.id === trackId);

  return {
    id,
    trackId,
    type: 'audio',
    name: `Audio ${index + 1}`,
    start,
    length,
    loopEnabled: false,
    loopIterations: 1,
    audioUrl,
    audioBuffer,
    audioFileId: id, // Use region ID as the original audio file reference
    trimStart: 0,
    originalLength: length,
    color: track?.color ?? '#6b7280',
  };
};

export const useRegionStore = create<RegionStoreState>((set, get) => ({
  regions: [],
  selectedRegionIds: [],
  lastSelectedRegionId: null,
  addRegion: (trackId, start, length, options) => {
    const index = get().regions.length;
    const region = createRegion(trackId, index, start, length, options?.id);
    set((state) => ({
      regions: [...state.regions, region],
      selectedRegionIds: [region.id],
      lastSelectedRegionId: region.id,
    }));
    useTrackStore.getState().attachRegionToTrack(trackId, region.id);
    return region;
  },
  addAudioRegion: (trackId, start, length, audioUrl, audioBuffer, options) => {
    const index = get().regions.length;
    const region = createAudioRegion(
      trackId,
      index,
      start,
      length,
      audioUrl,
      audioBuffer,
      options?.id
    );
    set((state) => ({
      regions: [...state.regions, region],
      selectedRegionIds: [region.id],
      lastSelectedRegionId: region.id,
    }));
    useTrackStore.getState().attachRegionToTrack(trackId, region.id);
    return region;
  },
  updateRegion: (regionId, updates) =>
    set((state) => ({
      regions: state.regions.map((region) => {
        if (region.id !== regionId) {
          return region;
        }
        // Type-safe update for different region types
        if (region.type === 'midi') {
          return { ...region, ...updates } as MidiRegion;
        } else {
          return { ...region, ...updates } as AudioRegion;
        }
      }),
    })),
  removeRegion: (regionId) =>
    set((state) => {
      const region = state.regions.find((r) => r.id === regionId);
      if (region) {
        useTrackStore.getState().detachRegionFromTrack(region.trackId, regionId);
      }
      return {
        regions: state.regions.filter((region) => region.id !== regionId),
        selectedRegionIds: state.selectedRegionIds.filter((id) => id !== regionId),
        lastSelectedRegionId:
          state.lastSelectedRegionId === regionId ? null : state.lastSelectedRegionId,
      };
    }),
  moveRegion: (regionId, deltaBeats) =>
    set((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId
          ? {
              ...region,
              start: Math.max(0, region.start + deltaBeats),
            }
          : region
      ),
    })),
  moveRegions: (regionIds, deltaBeats) =>
    set((state) => {
      return {
        regions: state.regions.map((region) =>
          regionIds.includes(region.id)
            ? {
                ...region,
                start: Math.max(0, region.start + deltaBeats),
              }
            : region
        ),
      };
    }),
  moveRegionsToTrack: (regionIds, targetTrackId, deltaBeats = 0) =>
    set((state) => {
      const trackStore = useTrackStore.getState();
      const regions = state.regions.map((region) => {
        if (!regionIds.includes(region.id)) {
          return region;
        }

        if (region.trackId !== targetTrackId) {
          trackStore.detachRegionFromTrack(region.trackId, region.id);
          trackStore.attachRegionToTrack(targetTrackId, region.id);
        }

        return {
          ...region,
          trackId: targetTrackId,
          start: Math.max(0, region.start + deltaBeats),
        };
      });

      return { regions };
    }),
  resizeRegion: (regionId, newLength) =>
    set((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId
          ? { ...region, length: clampLength(newLength) }
          : region
      ),
    })),
  setRegionLoop: (regionId, loopEnabled, loopIterations = 1) =>
    set((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId
          ? {
              ...region,
              loopEnabled,
              loopIterations: Math.max(loopIterations, 1),
            }
          : region
      ),
    })),
  selectRegion: (regionId, additive = false) =>
    set((state) => {
      if (additive) {
        if (state.selectedRegionIds.includes(regionId)) {
          return state;
        }
        return {
          selectedRegionIds: [...state.selectedRegionIds, regionId],
          lastSelectedRegionId: regionId,
        };
      }
      return {
        selectedRegionIds: [regionId],
        lastSelectedRegionId: regionId,
      };
    }),
  selectRegions: (regionIds) =>
    set(() => ({
      selectedRegionIds: Array.from(new Set(regionIds)),
      lastSelectedRegionId: regionIds.at(-1) ?? null,
    })),
  toggleRegionSelection: (regionId) =>
    set((state) => {
      if (state.selectedRegionIds.includes(regionId)) {
        const filtered = state.selectedRegionIds.filter((id) => id !== regionId);
        return {
          selectedRegionIds: filtered,
          lastSelectedRegionId:
            state.lastSelectedRegionId === regionId ? filtered.at(-1) ?? null : state.lastSelectedRegionId,
        };
      }
      return {
        selectedRegionIds: [...state.selectedRegionIds, regionId],
        lastSelectedRegionId: regionId,
      };
    }),
  deselectRegion: (regionId) =>
    set((state) => {
      if (!state.selectedRegionIds.includes(regionId)) {
        return state;
      }
      const selectedRegionIds = state.selectedRegionIds.filter((id) => id !== regionId);
      return {
        selectedRegionIds,
        lastSelectedRegionId:
          state.lastSelectedRegionId === regionId ? selectedRegionIds.at(-1) ?? null : state.lastSelectedRegionId,
      };
    }),
  clearSelection: () => set({ selectedRegionIds: [], lastSelectedRegionId: null }),
  duplicateRegion: (regionId, offsetBeats) => {
    const region = get().regions.find((r) => r.id === regionId);
    if (!region) {
      return null;
    }
    const newStart = Math.max(0, region.start + offsetBeats);
    const newId = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-copy`;
    
    let duplicated: Region;
    
    if (region.type === 'midi') {
      duplicated = {
        ...region,
        id: newId,
        start: newStart,
        // Notes are region-relative, so keep same relative positions (just new IDs)
        notes: region.notes.map((note) => ({
          ...note,
          id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `${note.id}-copy`,
          // Don't add offset - notes are already region-relative
        })),
        // Sustain events are also region-relative
        sustainEvents: region.sustainEvents.map((event) => ({
          ...event,
          id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `${event.id}-copy`,
          // Don't add offset - events are already region-relative
        })),
      };
    } else {
      // Audio region - preserve audioFileId to reference the same audio file
      const audioFileId = region.audioFileId || region.id;
      duplicated = {
        ...region,
        id: newId,
        start: newStart,
        audioFileId, // Keep reference to original audio file
      };
    }
    
    set((state) => ({
      regions: [...state.regions, duplicated],
      selectedRegionIds: [duplicated.id],
      lastSelectedRegionId: duplicated.id,
    }));
    useTrackStore.getState().attachRegionToTrack(region.trackId, duplicated.id);
    return duplicated;
  },
  splitRegions: (regionIds, splitPosition) => {
    const state = get();
    const newRegions: Region[] = [];
    const regionsToRemove: RegionId[] = [];
    const newSelectedIds: RegionId[] = [];
    
    regionIds.forEach((regionId) => {
      const region = state.regions.find((r) => r.id === regionId);
      if (!region) return;
      
      // Check if split position is within the region bounds
      const regionEnd = region.start + region.length;
      if (splitPosition <= region.start || splitPosition >= regionEnd) {
        // Split position is outside region, skip
        return;
      }
      
      // Calculate lengths for the two new regions
      const leftLength = splitPosition - region.start;
      const rightLength = regionEnd - splitPosition;
      
      // Create IDs for the new regions
      const leftId = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${regionId}-left`;
      const rightId = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${regionId}-right`;
      
      if (region.type === 'midi') {
        // Split MIDI region
        const leftNotes = region.notes.filter((note) => note.start < leftLength);
        const rightNotes = region.notes
          .filter((note) => note.start >= leftLength)
          .map((note) => ({
            ...note,
            id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `${note.id}-right`,
            start: note.start - leftLength, // Adjust to be relative to new region start
          }));
        
        const leftSustainEvents = region.sustainEvents.filter((event) => event.start < leftLength);
        const rightSustainEvents = region.sustainEvents
          .filter((event) => event.start >= leftLength)
          .map((event) => ({
            ...event,
            id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `${event.id}-right`,
            start: event.start - leftLength,
            end: event.end - leftLength,
          }));
        
        const leftRegion: MidiRegion = {
          ...region,
          id: leftId,
          length: leftLength,
          notes: leftNotes,
          sustainEvents: leftSustainEvents,
          loopEnabled: false, // Disable loop on split regions
          loopIterations: 1,
        };
        
        const rightRegion: MidiRegion = {
          ...region,
          id: rightId,
          start: splitPosition,
          length: rightLength,
          notes: rightNotes,
          sustainEvents: rightSustainEvents,
          loopEnabled: false,
          loopIterations: 1,
        };
        
        newRegions.push(leftRegion, rightRegion);
        newSelectedIds.push(leftId, rightId);
      } else {
        // Split Audio region
        const leftTrimStart = region.trimStart || 0;
        const rightTrimStart = leftTrimStart + leftLength;
        
        // Preserve audioFileId to reference the same audio file
        const audioFileId = region.audioFileId || region.id;
        
        const leftRegion: AudioRegion = {
          ...region,
          id: leftId,
          length: leftLength,
          trimStart: leftTrimStart,
          originalLength: region.originalLength,
          audioFileId, // Keep reference to original audio file
          loopEnabled: false,
          loopIterations: 1,
        };
        
        const rightRegion: AudioRegion = {
          ...region,
          id: rightId,
          start: splitPosition,
          length: rightLength,
          trimStart: rightTrimStart,
          originalLength: region.originalLength,
          audioFileId, // Keep reference to original audio file
          loopEnabled: false,
          loopIterations: 1,
        };
        
        newRegions.push(leftRegion, rightRegion);
        newSelectedIds.push(leftId, rightId);
      }
      
      regionsToRemove.push(regionId);
      
      // Attach new regions to track
      useTrackStore.getState().attachRegionToTrack(region.trackId, leftId);
      useTrackStore.getState().attachRegionToTrack(region.trackId, rightId);
    });
    
    // Remove old regions and add new split regions
    set((state) => ({
      regions: [
        ...state.regions.filter((r) => !regionsToRemove.includes(r.id)),
        ...newRegions,
      ],
      selectedRegionIds: newSelectedIds,
    }));
    
    // Detach old regions from track
    regionsToRemove.forEach((regionId) => {
      const region = state.regions.find((r) => r.id === regionId);
      if (region) {
        useTrackStore.getState().detachRegionFromTrack(region.trackId, regionId);
      }
    });
  },
  // Sync handlers (bypass undo history - called from DAWSyncService)
  syncSetRegions: (regions) => set({ regions }),
  syncAddRegion: (region) =>
    set((state) => {
      // Check if region already exists
      if (state.regions.find((r) => r.id === region.id)) {
        return state;
      }
      // Attach region to track
      useTrackStore.getState().attachRegionToTrack(region.trackId, region.id);
      return {
        regions: [...state.regions, region],
        selectedRegionIds: state.selectedRegionIds.includes(region.id)
          ? state.selectedRegionIds
          : [...state.selectedRegionIds, region.id],
        lastSelectedRegionId: region.id,
      };
    }),
  syncUpdateRegion: (regionId, updates) =>
    set((state) => ({
      regions: state.regions.map((region) => {
        if (region.id !== regionId) {
          return region;
        }
        // Type-safe update for different region types
        if (region.type === 'midi') {
          return { ...region, ...updates } as MidiRegion;
        } else {
          return { ...region, ...updates } as AudioRegion;
        }
      }),
    })),
  syncRemoveRegion: (regionId) =>
    set((state) => {
      const region = state.regions.find((r) => r.id === regionId);
      if (region) {
        useTrackStore.getState().detachRegionFromTrack(region.trackId, regionId);
      }
      return {
        regions: state.regions.filter((region) => region.id !== regionId),
        selectedRegionIds: state.selectedRegionIds.filter((id) => id !== regionId),
        lastSelectedRegionId:
          state.lastSelectedRegionId === regionId ? null : state.lastSelectedRegionId,
      };
    }),
  syncMoveRegion: (regionId, newStart) =>
    set((state) => ({
      regions: state.regions.map((region) =>
        region.id === regionId
          ? {
              ...region,
              start: Math.max(0, newStart),
            }
          : region
      ),
    })),
  syncSelectRegions: (regionIds) =>
    set(() => ({
      selectedRegionIds: Array.from(new Set(regionIds)),
      lastSelectedRegionId: regionIds.at(-1) ?? null,
    })),
}));

