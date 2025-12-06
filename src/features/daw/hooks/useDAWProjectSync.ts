import { useRef, useCallback, useEffect } from 'react';
import { dawSyncService } from '../services/dawSyncService';
import { useSynthStore } from '../stores/synthStore';
import { useProjectStore } from '../stores/projectStore';
import { useMarkerStore } from '../stores/markerStore';
import type { SynthState } from '@/features/instruments';
import type { TimeSignature } from '../types/daw';
import type { TimeMarker } from '../types/marker';
import { createThrottledEmitter } from '@/shared/utils/performanceUtils';
import { COLLAB_THROTTLE_INTERVALS } from '@/features/daw/config/collaborationThrottles';

export const useDAWProjectSync = () => {
  // Synth Params Sync
  const synthParamsQueueRef = useRef<Map<string, Partial<SynthState>>>(new Map());
  const synthParamsEmitterRef = useRef(
    createThrottledEmitter<void>(() => {
      const queue = synthParamsQueueRef.current;
      if (queue.size === 0) {
        return;
      }

      queue.forEach((params, trackId) => {
        if (!params || Object.keys(params).length === 0) {
          return;
        }
        dawSyncService.syncSynthParams(trackId, params);
      });

      queue.clear();
    }, COLLAB_THROTTLE_INTERVALS.synthParamsMs)
  );

  // Marker Sync
  const markerQueueRef = useRef<Map<string, Partial<TimeMarker>>>(new Map());
  const markerEmitterRef = useRef(
    createThrottledEmitter<void>(() => {
      const queue = markerQueueRef.current;
      if (queue.size === 0) {
        return;
      }

      queue.forEach((updates, markerId) => {
        if (!updates || Object.keys(updates).length === 0) {
          return;
        }
        dawSyncService.syncMarkerUpdate(markerId, updates);
      });

      queue.clear();
    }, COLLAB_THROTTLE_INTERVALS.markerMs)
  );

  // Cleanup
  useEffect(() => {
    const synthEmitter = synthParamsEmitterRef.current;
    const synthQueue = synthParamsQueueRef.current;
    const markerEmitter = markerEmitterRef.current;
    const markerQueue = markerQueueRef.current;

    return () => {
      synthEmitter.cancel();
      synthQueue.clear();
      markerEmitter.cancel();
      markerQueue.clear();
    };
  }, []);

  // Store Selectors
  const setBpm = useProjectStore((state) => state.setBpm);
  const setTimeSignature = useProjectStore((state) => state.setTimeSignature);
  const updateSynthStateStore = useSynthStore((state) => state.updateSynthState);
  const addMarker = useMarkerStore((state) => state.addMarker);
  const updateMarker = useMarkerStore((state) => state.updateMarker);
  const removeMarker = useMarkerStore((state) => state.removeMarker);

  // Synth Handlers
  const handleSynthParamsChange = useCallback(
    (trackId: string, params: Partial<SynthState>) => {
      updateSynthStateStore(trackId, params);
      const existing = synthParamsQueueRef.current.get(trackId) ?? {};
      synthParamsQueueRef.current.set(trackId, { ...existing, ...params });
      synthParamsEmitterRef.current.push(undefined);
    },
    [updateSynthStateStore]
  );

  // Project Handlers
  const handleBpmChange = useCallback(
    (value: number) => {
      setBpm(value);
      dawSyncService.syncBpmChange(value);
    },
    [setBpm]
  );

  const handleTimeSignatureChange = useCallback(
    (signature: TimeSignature) => {
      setTimeSignature(signature);
      dawSyncService.syncTimeSignatureChange(signature);
    },
    [setTimeSignature]
  );

  const handleProjectScaleChange = useCallback(
    (rootNote: string, scale: 'major' | 'minor') => {
      const setProjectScale = useProjectStore.getState().setProjectScale;
      setProjectScale(rootNote, scale);
      dawSyncService.syncProjectScaleChange(rootNote, scale);
    },
    []
  );

  // Marker Handlers
  const handleMarkerAdd = useCallback(
    (marker: TimeMarker) => {
      addMarker(marker);
      dawSyncService.syncMarkerAdd(marker);
    },
    [addMarker]
  );

  const handleMarkerUpdate = useCallback(
    (markerId: string, updates: Partial<TimeMarker>) => {
      updateMarker(markerId, updates);
      
      const queue = markerQueueRef.current;
      const existing = queue.get(markerId) ?? {};
      queue.set(markerId, { ...existing, ...updates });
      markerEmitterRef.current.push(undefined);
    },
    [updateMarker]
  );

  const handleMarkerUpdateFlush = useCallback(() => {
    markerEmitterRef.current.flush();
    markerEmitterRef.current.cancel();
    markerQueueRef.current.clear();
  }, []);

  const handleMarkerDelete = useCallback(
    (markerId: string) => {
      removeMarker(markerId);
      dawSyncService.syncMarkerDelete(markerId);
    },
    [removeMarker]
  );

  return {
    handleSynthParamsChange,
    handleBpmChange,
    handleTimeSignatureChange,
    handleProjectScaleChange,
    handleMarkerAdd,
    handleMarkerUpdate,
    handleMarkerUpdateFlush,
    handleMarkerDelete,
  };
};
