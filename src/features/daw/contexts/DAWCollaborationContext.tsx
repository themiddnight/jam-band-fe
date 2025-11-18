import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useDAWCollaboration } from '../hooks/useDAWCollaboration';
import type { Socket } from 'socket.io-client';
import type { SynthState } from '@/features/instruments';
import type { TimeSignature } from '../types/daw';
import type { InstrumentCategory } from '@/shared/constants/instruments';

interface DAWCollaborationContextValue {
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
}

export const DAWCollaborationProvider: React.FC<DAWCollaborationProviderProps> = ({
  children,
  socket,
  roomId,
  enabled = true,
}) => {
  const collaboration = useDAWCollaboration({ socket, roomId, enabled });

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
        const { useTrackStore } = require('../stores/trackStore');
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
      handleTrackSelect: () => {},
      handleRegionAdd: (trackId: string, start: number, length?: number, overrides?: any) => {
        const { useRegionStore } = require('../stores/regionStore');
        const region = useRegionStore.getState().addRegion(trackId, start, length);
        if (overrides && Object.keys(overrides).length > 0) {
          useRegionStore.getState().updateRegion(region.id, overrides);
          return { ...region, ...overrides };
        }
        return region;
      },
      handleRegionUpdate: () => {},
      handleRegionMove: () => {},
      handleRegionMoveToTrack: (regionIds: string[], targetTrackId: string, deltaBeats = 0) => {
        const { useRegionStore } = require('../stores/regionStore');
        useRegionStore.getState().moveRegionsToTrack(regionIds, targetTrackId, deltaBeats);
      },
      handleRegionDelete: () => {},
      handleRegionSplit: (regionIds: string[], splitPosition: number) => {
        const { useRegionStore } = require('../stores/regionStore');
        useRegionStore.getState().splitRegions(regionIds, splitPosition);
      },
      handleRegionSelect: () => {},
      handleRegionDeselect: () => {},
      handleNoteAdd: () => null,
      handleNoteUpdate: () => {},
      handleNoteDelete: () => {},
      handleEffectChainUpdate: () => {},
      handleSynthParamsChange: (trackId: string, params: Partial<SynthState>) => {
        const { useSynthStore } = require('../stores/synthStore');
        const synthStore = useSynthStore.getState();
        if (synthStore.synthStates[trackId]) {
          synthStore.updateSynthState(trackId, params);
        }
      },
      handleBpmChange: (bpm: number) => {
        const { useProjectStore } = require('../stores/projectStore');
        useProjectStore.getState().setBpm(bpm);
      },
      handleTimeSignatureChange: (timeSignature: TimeSignature) => {
        const { useProjectStore } = require('../stores/projectStore');
        useProjectStore.getState().setTimeSignature(timeSignature);
      },
      isLocked: () => null,
      isLockedByUser: () => false,
    };
  }
  return context;
};

