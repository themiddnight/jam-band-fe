import { createContext } from 'react';

import type { SynthState } from '@/features/instruments';
import type { InstrumentCategory } from '@/shared/constants/instruments';
import type { LockType } from '../stores/lockStore';

import type { RegionDragUpdatePayload } from '../services/dawSyncService';
import type { MidiNote, Region, TimeSignature } from '../types/daw';
import type { TimeMarker } from '../types/marker';
import { useProjectStore } from '../stores/projectStore';
import { useRegionStore } from '../stores/regionStore';
import { useSynthStore } from '../stores/synthStore';
import { useTrackStore } from '../stores/trackStore';
import { useMarkerStore } from '../stores/markerStore';

export interface DAWCollaborationContextValue {
  // Track handlers
  handleTrackAdd: (overrides?: any) => any;
  handleTrackUpdate: (trackId: string, updates: any) => void;
  handleTrackDelete: (trackId: string) => void;
  handleTrackNameChange: (trackId: string, name: string) => void;
  handleTrackVolumeChange: (trackId: string, volume: number) => void;
  handleTrackPanChange: (trackId: string, pan: number) => void;
  handleTrackVolumeDragEnd: () => void;
  handleTrackPanDragEnd: () => void;
  handleTrackInstrumentChange: (
    trackId: string,
    instrumentId: string,
    instrumentCategory?: InstrumentCategory
  ) => void;
  handleTrackReorder: (trackId: string, newIndex: number) => void;
  handleTrackSelect: (trackId: string | null) => void;

  // Region handlers
  handleRegionAdd: (
    trackId: string,
    start: number,
    length?: number,
    overrides?: any
  ) => any;
  handleRegionUpdate: (regionId: string, updates: any) => void;
  handleRegionMove: (regionId: string, deltaBeats: number) => void;
  handleRegionMoveToTrack: (
    regionIds: string[],
    targetTrackId: string,
    deltaBeats?: number
  ) => void;
  handleRegionDragStart: (regionIds: string[]) => boolean;
  handleRegionDragRealtime: (updates: RegionDragUpdatePayload[]) => void;
  handleRegionDragEnd: (regionIds: string[]) => void;
  handleRegionRealtimeUpdates: (updates: RegionRealtimeUpdate[]) => void;
  handleRegionRealtimeFlush: () => void;
  handleRegionDelete: (regionId: string) => void;
  handleRegionSplit: (regionIds: string[], splitPosition: number) => void;
  handleRegionSelect: (regionId: string, additive?: boolean) => boolean;
  handleRegionDeselect: (regionId: string) => void;
  handleRegionClearSelection: () => void;

  // Note handlers
  handleNoteAdd: (note: any) => any;
  handleNoteUpdate: (noteId: string, updates: any) => void;
  handleNoteDelete: (noteId: string) => void;
  handleNoteRealtimeUpdates: (
    updates: Array<{
      regionId: string;
      noteId: string;
      updates: Partial<MidiNote>;
    }>
  ) => void;
  handleNoteRealtimeFlush: () => void;

  // Effect chain
  handleEffectChainUpdate: (trackId: string, chainType: string, effectChain: any) => void;

  // Synth / project
  handleSynthParamsChange: (trackId: string, params: Partial<SynthState>) => void;
  handleBpmChange: (bpm: number) => void;
  handleTimeSignatureChange: (timeSignature: TimeSignature) => void;

  // Marker handlers
  handleMarkerAdd: (marker: TimeMarker) => void;
  handleMarkerUpdate: (markerId: string, updates: Partial<TimeMarker>) => void;
  handleMarkerUpdateFlush: () => void;
  handleMarkerDelete: (markerId: string) => void;

  // Lock utilities
  isLocked: (elementId: string) => any;
  isLockedByUser: (elementId: string) => boolean;
  acquireInteractionLock: (elementId: string, type: LockType) => boolean;
  releaseInteractionLock: (elementId: string) => void;
}

export interface RegionRealtimeUpdate {
  regionId: string;
  updates: Partial<Region>;
}

export const DAWCollaborationContext = createContext<DAWCollaborationContextValue | null>(null);

export const createNoopDAWCollaborationValue = (): DAWCollaborationContextValue => ({
  handleTrackAdd: (overrides?: any) => {
    return useTrackStore.getState().addTrack(overrides);
  },
  handleTrackUpdate: () => {},
  handleTrackDelete: () => {},
  handleTrackNameChange: () => {},
  handleTrackVolumeChange: () => {},
  handleTrackPanChange: () => {},
  handleTrackVolumeDragEnd: () => {},
  handleTrackPanDragEnd: () => {},
  handleTrackInstrumentChange: () => {},
  handleTrackReorder: () => {},
  handleTrackSelect: () => {},
  handleRegionAdd: (
    trackId: string,
    start: number,
    length?: number,
    overrides?: any
  ) => {
    const regionStore = useRegionStore.getState();
    const {
      id: overrideId,
      type: overrideType,
      audioBuffer,
      ...restOverrides
    } = overrides ?? {};

    const isAudioRegion = overrideType === 'audio' || typeof restOverrides?.audioUrl === 'string';

    let region;
    if (isAudioRegion) {
      const resolvedLength =
        typeof restOverrides?.length === 'number'
          ? restOverrides.length
          : typeof length === 'number'
            ? length
            : 4;
      const audioUrl = restOverrides?.audioUrl ?? '';
      region = regionStore.addAudioRegion(
        trackId,
        start,
        resolvedLength,
        audioUrl,
        audioBuffer,
        { id: overrideId }
      );
    } else {
      region = regionStore.addRegion(trackId, start, length, { id: overrideId });
    }

    if (restOverrides && Object.keys(restOverrides).length > 0) {
      regionStore.updateRegion(region.id, restOverrides);
      return { ...region, ...restOverrides };
    }
    return region;
  },
  handleRegionUpdate: () => {},
  handleRegionMove: () => {},
  handleRegionMoveToTrack: (regionIds: string[], targetTrackId: string, deltaBeats = 0) => {
    useRegionStore.getState().moveRegionsToTrack(regionIds, targetTrackId, deltaBeats);
  },
  handleRegionDragStart: () => false,
  handleRegionDragRealtime: () => {},
  handleRegionDragEnd: () => {},
  handleRegionRealtimeUpdates: () => {},
  handleRegionRealtimeFlush: () => {},
  handleRegionDelete: () => {},
  handleRegionSplit: (regionIds: string[], splitPosition: number) => {
    useRegionStore.getState().splitRegions(regionIds, splitPosition);
  },
  handleRegionSelect: () => false,
  handleRegionDeselect: () => {},
  handleRegionClearSelection: () => {
    useRegionStore.getState().clearSelection();
  },
  handleNoteAdd: () => null,
  handleNoteUpdate: () => {},
  handleNoteDelete: () => {},
  handleNoteRealtimeUpdates: () => {},
  handleNoteRealtimeFlush: () => {},
  handleEffectChainUpdate: () => {},
  handleSynthParamsChange: (trackId: string, params: Partial<SynthState>) => {
    const synthStore = useSynthStore.getState();
    if (synthStore.synthStates[trackId]) {
      synthStore.updateSynthState(trackId, params);
    }
  },
  handleBpmChange: (bpm: number) => {
    useProjectStore.getState().setBpm(bpm);
  },
  handleTimeSignatureChange: (timeSignature: TimeSignature) => {
    useProjectStore.getState().setTimeSignature(timeSignature);
  },
  handleMarkerAdd: (marker: TimeMarker) => {
    useMarkerStore.getState().addMarker(marker);
  },
  handleMarkerUpdate: (markerId: string, updates: Partial<TimeMarker>) => {
    useMarkerStore.getState().updateMarker(markerId, updates);
  },
  handleMarkerUpdateFlush: () => {},
  handleMarkerDelete: (markerId: string) => {
    useMarkerStore.getState().removeMarker(markerId);
  },
  isLocked: () => null,
  isLockedByUser: () => false,
  acquireInteractionLock: () => false,
  releaseInteractionLock: () => {},
});
