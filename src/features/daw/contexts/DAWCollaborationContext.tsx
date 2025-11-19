import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useDAWCollaboration } from '../hooks/useDAWCollaboration';
import type { Socket } from 'socket.io-client';
import type { SynthState } from '@/features/instruments';
import type { TimeSignature } from '../types/daw';
import type { InstrumentCategory } from '@/shared/constants/instruments';
import { useTrackStore } from '../stores/trackStore';
import { useRegionStore } from '../stores/regionStore';
import { useSynthStore } from '../stores/synthStore';
import { useProjectStore } from '../stores/projectStore';

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
  handleTrackInstrumentChange: (trackId: string, instrumentId: string, instrumentCategory?: InstrumentCategory) => void;
  handleTrackReorder: (trackId: string, newIndex: number) => void;
  handleTrackSelect: (trackId: string | null) => void;

  // Region handlers
  handleRegionAdd: (trackId: string, start: number, length?: number, overrides?: any) => any;
  handleRegionUpdate: (regionId: string, updates: any) => void;
  handleRegionMove: (regionId: string, deltaBeats: number) => void;
  handleRegionMoveToTrack: (regionIds: string[], targetTrackId: string, deltaBeats?: number) => void;
  handleRegionDelete: (regionId: string) => void;
  handleRegionSplit: (regionIds: string[], splitPosition: number) => void;
  handleRegionSelect: (regionId: string, additive?: boolean) => void;
  handleRegionDeselect: (regionId: string) => void;

  // Note handlers
  handleNoteAdd: (note: any) => any;
  handleNoteUpdate: (noteId: string, updates: any) => void;
  handleNoteDelete: (noteId: string) => void;

  // Effect chain
  handleEffectChainUpdate: (trackId: string, chainType: string, effectChain: any) => void;

  // Synth / project
  handleSynthParamsChange: (trackId: string, params: Partial<SynthState>) => void;
  handleBpmChange: (bpm: number) => void;
  handleTimeSignatureChange: (timeSignature: TimeSignature) => void;

  // Lock utilities
  isLocked: (elementId: string) => any;
  isLockedByUser: (elementId: string) => boolean;
}

const DAWCollaborationContext = createContext<DAWCollaborationContextValue | null>(null);

interface DAWCollaborationProviderProps {
  children: ReactNode;
  socket: Socket | null;
  roomId: string | null;
  enabled?: boolean;
  value?: DAWCollaborationContextValue;
}

export const DAWCollaborationProvider: React.FC<DAWCollaborationProviderProps> = ({
  children,
  socket,
  roomId,
  enabled = true,
  value,
}) => {
  const collaboration = value ?? useDAWCollaboration({ socket, roomId, enabled });

  return (
    <DAWCollaborationContext.Provider value={collaboration}>
      {children}
    </DAWCollaborationContext.Provider>
  );
};

export const useDAWCollaborationContext = (): DAWCollaborationContextValue => {
  const context = useContext(DAWCollaborationContext);
  if (!context) {
    // Return no-op handlers when not in collaborative mode
    return {
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
      handleRegionAdd: (trackId: string, start: number, length?: number, overrides?: any) => {
        const regionStore = useRegionStore.getState();
        const {
          id: overrideId,
          type: overrideType,
          audioBuffer,
          ...restOverrides
        } = overrides ?? {};

        const isAudioRegion =
          overrideType === 'audio' || typeof restOverrides?.audioUrl === 'string';

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
      handleRegionDelete: () => {},
      handleRegionSplit: (regionIds: string[], splitPosition: number) => {
        useRegionStore.getState().splitRegions(regionIds, splitPosition);
      },
      handleRegionSelect: () => {},
      handleRegionDeselect: () => {},
      handleNoteAdd: () => null,
      handleNoteUpdate: () => {},
      handleNoteDelete: () => {},
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
      isLocked: () => null,
      isLockedByUser: () => false,
    };
  }
  return context;
};

