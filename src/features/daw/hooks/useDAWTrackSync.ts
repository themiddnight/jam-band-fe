import { useRef, useCallback, useEffect } from 'react';
import { dawSyncService } from '../services/dawSyncService';
import { useLockStore } from '../stores/lockStore';
import { useTrackStore } from '../stores/trackStore';
import { useUserStore } from '@/shared/stores/userStore';
import type { Track } from '../types/daw';
import type { InstrumentCategory } from '@/shared/constants/instruments';
import { createThrottledEmitter } from '@/shared/utils/performanceUtils';
import { COLLAB_THROTTLE_INTERVALS } from '@/features/daw/config/collaborationThrottles';
import { getTrackPanLockId, getTrackVolumeLockId } from '../utils/collaborationLocks';

export const useDAWTrackSync = () => {
  const { userId, username } = useUserStore();
  const activeTrackControlLockRef = useRef<{ lockId: string; control: 'volume' | 'pan' } | null>(null);
  
  const trackPropertyQueueRef = useRef<Map<string, Partial<Track>>>(new Map());
  const trackPropertyEmitterRef = useRef(
    createThrottledEmitter<void>(() => {
      const queue = trackPropertyQueueRef.current;
      if (queue.size === 0) {
        return;
      }

      queue.forEach((updates, trackId) => {
        if (!updates || Object.keys(updates).length === 0) {
          return;
        }

        dawSyncService.syncTrackUpdate(trackId, updates);
      });

      queue.clear();
    }, COLLAB_THROTTLE_INTERVALS.trackPropertyMs)
  );

  // Cleanup emitter on unmount
  useEffect(() => {
    const emitter = trackPropertyEmitterRef.current;
    const queue = trackPropertyQueueRef.current;
    return () => {
      emitter.cancel();
      queue.clear();
    };
  }, []);

  const queueTrackPropertyUpdate = useCallback((trackId: string, updates: Partial<Track>) => {
    if (!updates || Object.keys(updates).length === 0) {
      return;
    }

    const queue = trackPropertyQueueRef.current;
    const existing = queue.get(trackId) ?? {};
    queue.set(trackId, { ...existing, ...updates });
    trackPropertyEmitterRef.current.push(undefined);
  }, []);

  const flushTrackPropertyUpdates = useCallback(() => {
    trackPropertyEmitterRef.current.flush();
    trackPropertyEmitterRef.current.cancel();
    trackPropertyQueueRef.current.clear();
  }, []);

  // Store selectors
  const acquireLock = useLockStore((state) => state.acquireLock);
  const releaseLock = useLockStore((state) => state.releaseLock);
  const isLockedByUser = useLockStore((state) => state.isLockedByUser);

  const addTrack = useTrackStore((state) => state.addTrack);
  const updateTrack = useTrackStore((state) => state.updateTrack);
  const removeTrack = useTrackStore((state) => state.removeTrack);
  const setTrackName = useTrackStore((state) => state.setTrackName);
  const setTrackVolume = useTrackStore((state) => state.setTrackVolume);
  const setTrackPan = useTrackStore((state) => state.setTrackPan);
  const setTrackInstrument = useTrackStore((state) => state.setTrackInstrument);
  const reorderTrack = useTrackStore((state) => state.reorderTrack);
  const selectTrack = useTrackStore((state) => state.selectTrack);

  // Handlers
  const handleTrackAdd = useCallback(
    (overrides?: Parameters<typeof addTrack>[0]) => {
      const track = addTrack(overrides);
      dawSyncService.syncTrackAdd(track);
      return track;
    },
    [addTrack]
  );

  const handleTrackUpdate = useCallback(
    (trackId: string, updates: Parameters<typeof updateTrack>[1]) => {
      updateTrack(trackId, updates);
      dawSyncService.syncTrackUpdate(trackId, updates);
    },
    [updateTrack]
  );

  const handleTrackDelete = useCallback(
    (trackId: string) => {
      removeTrack(trackId);
      dawSyncService.syncTrackDelete(trackId);
    },
    [removeTrack]
  );

  const handleTrackNameChange = useCallback(
    (trackId: string, name: string) => {
      const lockKey = `track_${trackId}_property`;
      if (!isLockedByUser(lockKey, userId || '')) {
        // Try to acquire lock
        if (acquireLock(lockKey, {
          userId: userId || '',
          username: username || '',
          type: 'track_property',
          timestamp: Date.now(),
        })) {
          dawSyncService.acquireLock(lockKey, 'track_property');
        } else {
          return; // Locked by someone else
        }
      }

      setTrackName(trackId, name);
      dawSyncService.syncTrackUpdate(trackId, { name });
    },
    [setTrackName, isLockedByUser, acquireLock, userId, username]
  );

  const handleTrackVolumeChange = useCallback(
    (trackId: string, volume: number) => {
      const lockId = getTrackVolumeLockId(trackId);
      const currentUserId = userId || '';
      if (!currentUserId) {
        return;
      }

      if (!isLockedByUser(lockId, currentUserId)) {
        const didAcquire = acquireLock(lockId, {
          userId: currentUserId,
          username: username || '',
          type: 'control',
          timestamp: Date.now(),
        });

        if (!didAcquire) {
          return;
        }

        dawSyncService.acquireLock(lockId, 'control');
      }

      activeTrackControlLockRef.current = { lockId, control: 'volume' };
      setTrackVolume(trackId, volume);
      queueTrackPropertyUpdate(trackId, { volume });
    },
    [acquireLock, isLockedByUser, queueTrackPropertyUpdate, setTrackVolume, userId, username]
  );

  const handleTrackPanChange = useCallback(
    (trackId: string, pan: number) => {
      const lockId = getTrackPanLockId(trackId);
      const currentUserId = userId || '';
      if (!currentUserId) {
        return;
      }

      if (!isLockedByUser(lockId, currentUserId)) {
        const didAcquire = acquireLock(lockId, {
          userId: currentUserId,
          username: username || '',
          type: 'control',
          timestamp: Date.now(),
        });

        if (!didAcquire) {
          return;
        }

        dawSyncService.acquireLock(lockId, 'control');
      }

      activeTrackControlLockRef.current = { lockId, control: 'pan' };
      setTrackPan(trackId, pan);
      queueTrackPropertyUpdate(trackId, { pan });
    },
    [acquireLock, isLockedByUser, queueTrackPropertyUpdate, setTrackPan, userId, username]
  );

  const releaseTrackControlLock = useCallback(
    (control: 'volume' | 'pan') => {
      if (activeTrackControlLockRef.current?.control !== control) {
        return;
      }

      const { lockId } = activeTrackControlLockRef.current;
      flushTrackPropertyUpdates();
      releaseLock(lockId, userId || '');
      dawSyncService.releaseLock(lockId);
      activeTrackControlLockRef.current = null;
    },
    [flushTrackPropertyUpdates, releaseLock, userId]
  );

  const handleTrackVolumeDragEnd = useCallback(() => {
    releaseTrackControlLock('volume');
  }, [releaseTrackControlLock]);

  const handleTrackPanDragEnd = useCallback(() => {
    releaseTrackControlLock('pan');
  }, [releaseTrackControlLock]);

  const handleTrackInstrumentChange = useCallback(
    (trackId: string, instrumentId: string, instrumentCategory?: InstrumentCategory) => {
      setTrackInstrument(trackId, instrumentId, instrumentCategory);
      dawSyncService.syncTrackInstrumentChange(trackId, instrumentId, instrumentCategory);
    },
    [setTrackInstrument]
  );

  const handleTrackReorder = useCallback(
    (trackId: string, newIndex: number) => {
      reorderTrack(trackId, newIndex);
      // Get the new order of all track IDs after reordering
      const tracks = useTrackStore.getState().tracks;
      const trackIds = tracks.map((track) => track.id);
      dawSyncService.syncTrackReorder(trackIds);
    },
    [reorderTrack]
  );

  const handleTrackSelect = useCallback(
    (trackId: string | null) => {
      selectTrack(trackId);
    },
    [selectTrack]
  );

  return {
    handleTrackAdd,
    handleTrackUpdate,
    handleTrackDelete,
    handleTrackNameChange,
    handleTrackVolumeChange,
    handleTrackPanChange,
    handleTrackVolumeDragEnd,
    handleTrackPanDragEnd,
    handleTrackInstrumentChange,
    handleTrackReorder,
    handleTrackSelect,
  };
};
