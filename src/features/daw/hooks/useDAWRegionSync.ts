import { useRef, useCallback, useEffect } from 'react';
import { dawSyncService, type RegionDragUpdatePayload } from '../services/dawSyncService';
import { useLockStore } from '../stores/lockStore';
import { useRegionStore } from '../stores/regionStore';
import { useUserStore } from '@/shared/stores/userStore';
import type { Region, AudioRegion } from '../types/daw';
import type { RegionRealtimeUpdate } from '../contexts/DAWCollaborationContext.shared';
import { createThrottledEmitter } from '@/shared/utils/performanceUtils';
import { COLLAB_THROTTLE_INTERVALS } from '@/features/daw/config/collaborationThrottles';
import { getRegionLockId } from '../utils/collaborationLocks';

export const useDAWRegionSync = () => {
  const { userId, username } = useUserStore();
  
  // Throttled Emitters & Queues
  const regionDragQueueRef = useRef<Map<string, RegionDragUpdatePayload>>(new Map());
  const regionDragEmitterRef = useRef(
    createThrottledEmitter<void>(() => {
      const queue = regionDragQueueRef.current;
      if (queue.size === 0) {
        return;
      }

      const batch = Array.from(queue.values()).map((update) => ({
        ...update,
        newStart: Math.max(0, update.newStart),
      }));

      queue.clear();
      dawSyncService.syncRegionDragBatch(batch);
    }, COLLAB_THROTTLE_INTERVALS.regionDragMs)
  );

  const regionRealtimeQueueRef = useRef<Map<string, Partial<Region>>>(new Map());
  const regionRealtimeEmitterRef = useRef(
    createThrottledEmitter<void>(() => {
      const queue = regionRealtimeQueueRef.current;
      if (queue.size === 0) {
        return;
      }

      queue.forEach((updates, regionId) => {
        if (!updates || Object.keys(updates).length === 0) {
          return;
        }

        const sanitizedUpdates: Partial<Region> = { ...updates };
        if (typeof sanitizedUpdates.start === 'number') {
          sanitizedUpdates.start = Math.max(0, sanitizedUpdates.start);
        }
        if (typeof sanitizedUpdates.length === 'number') {
          sanitizedUpdates.length = Math.max(0.25, sanitizedUpdates.length);
        }
        if (typeof sanitizedUpdates.loopIterations === 'number') {
          sanitizedUpdates.loopIterations = Math.max(1, Math.round(sanitizedUpdates.loopIterations));
        }

        dawSyncService.syncRegionUpdate(regionId, sanitizedUpdates);
      });

      queue.clear();
    }, COLLAB_THROTTLE_INTERVALS.regionRealtimeMs)
  );

  // Cleanup
  useEffect(() => {
    const dragEmitter = regionDragEmitterRef.current;
    const dragQueue = regionDragQueueRef.current;
    const realtimeEmitter = regionRealtimeEmitterRef.current;
    const realtimeQueue = regionRealtimeQueueRef.current;

    return () => {
      dragEmitter.cancel();
      dragQueue.clear();
      realtimeEmitter.cancel();
      realtimeQueue.clear();
    };
  }, []);

  // Store selectors
  const acquireLock = useLockStore((state) => state.acquireLock);
  const releaseLock = useLockStore((state) => state.releaseLock);
  const isLocked = useLockStore((state) => state.isLocked);
  const isLockedByUser = useLockStore((state) => state.isLockedByUser);

  const addRegion = useRegionStore((state) => state.addRegion);
  const addAudioRegion = useRegionStore((state) => state.addAudioRegion);
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const removeRegion = useRegionStore((state) => state.removeRegion);
  const moveRegion = useRegionStore((state) => state.moveRegion);
  const moveRegionsToTrack = useRegionStore((state) => state.moveRegionsToTrack);
  const splitRegions = useRegionStore((state) => state.splitRegions);
  const selectRegion = useRegionStore((state) => state.selectRegion);
  const deselectRegion = useRegionStore((state) => state.deselectRegion);
  const clearSelection = useRegionStore((state) => state.clearSelection);
  const selectedRegionIds = useRegionStore((state) => state.selectedRegionIds);

  // Helpers
  const sanitizeRegionForSync = useCallback((region: Region): Region => {
    if (region.type === 'audio') {
      const sanitized = { ...region, audioBuffer: undefined };
      return sanitized as Region;
    }
    return region;
  }, []);

  // Handlers
  const handleRegionAdd = useCallback(
    (trackId: string, start: number, length?: number, overrides?: Partial<Region>): Region => {
      const { id: overrideId, type: overrideType, ...restOverrides } = overrides ?? {};
      const audioOverrides = restOverrides as Partial<AudioRegion>;
      const isAudioRegion =
        overrideType === 'audio' || typeof audioOverrides.audioUrl === 'string';

      let region: Region;
      if (isAudioRegion) {
        const audioLength =
          typeof restOverrides.length === 'number'
            ? restOverrides.length
            : typeof length === 'number'
              ? length
              : 4;
        const audioUrl = audioOverrides.audioUrl ?? '';
        const buffer = audioOverrides.audioBuffer;
        region = addAudioRegion(
          trackId,
          start,
          audioLength,
          audioUrl,
          buffer,
          { id: overrideId }
        );
      } else {
        region = addRegion(trackId, start, length, { id: overrideId });
      }

      const overridesToApply =
        restOverrides && Object.keys(restOverrides).length > 0 ? restOverrides : null;
      let updatedRegion: Region = region;

      if (overridesToApply) {
        updateRegion(region.id, overridesToApply);
        updatedRegion = { ...region, ...overridesToApply } as Region;
      }

      dawSyncService.syncRegionAdd(sanitizeRegionForSync(updatedRegion));
      return updatedRegion;
    },
    [addRegion, addAudioRegion, updateRegion, sanitizeRegionForSync]
  );

  const handleRegionUpdate = useCallback(
    (regionId: string, updates: Parameters<typeof updateRegion>[1]) => {
      if (!updates || Object.keys(updates).length === 0) {
        return;
      }
      const lockId = getRegionLockId(regionId);
      const lock = isLocked(lockId);
      if (lock && lock.userId !== userId) {
        return; // Locked by someone else
      }

      updateRegion(regionId, updates);
      dawSyncService.syncRegionUpdate(regionId, updates);
    },
    [updateRegion, isLocked, userId]
  );

  const handleRegionDragStart = useCallback(
    (regionIds: string[]) => {
      if (!regionIds.length) {
        return false;
      }

      const currentUserId = userId || '';
      const currentUsername = username || '';

      const hasConflict = regionIds.some((regionId) => {
        const lock = isLocked(getRegionLockId(regionId));
        return lock && lock.userId !== currentUserId;
      });

      if (hasConflict) {
        return false;
      }

      const acquired: string[] = [];

      for (const regionId of regionIds) {
        const lockId = getRegionLockId(regionId);
        if (isLockedByUser(lockId, currentUserId)) {
          continue;
        }

        const didAcquire = acquireLock(lockId, {
          userId: currentUserId,
          username: currentUsername,
          type: 'region',
          timestamp: Date.now(),
        });

        if (!didAcquire) {
          acquired.forEach((id) => {
            releaseLock(id, currentUserId);
            dawSyncService.releaseLock(id);
          });
          return false;
        }

        dawSyncService.acquireLock(lockId, 'region');
        acquired.push(lockId);
      }

      return true;
    },
    [acquireLock, releaseLock, isLocked, isLockedByUser, userId, username]
  );

  const handleRegionDragRealtime = useCallback((updates: RegionDragUpdatePayload[]) => {
    if (!updates.length) {
      return;
    }

    const queue = regionDragQueueRef.current;
    updates.forEach((update) => {
      queue.set(update.regionId, update);
    });

    regionDragEmitterRef.current.push(undefined);
  }, []);

  const handleRegionDragEnd = useCallback(
    (regionIds: string[]) => {
      regionDragEmitterRef.current.flush();
      regionDragEmitterRef.current.cancel();
      regionDragQueueRef.current.clear();

      const currentUserId = userId || '';
      const stillSelectedIds = new Set(selectedRegionIds);

      regionIds.forEach((regionId) => {
        const lockId = getRegionLockId(regionId);
        const shouldRelease = !stillSelectedIds.has(regionId);
        if (shouldRelease && isLockedByUser(lockId, currentUserId)) {
          releaseLock(lockId, currentUserId);
          dawSyncService.releaseLock(lockId);
        }
      });
    },
    [isLockedByUser, releaseLock, selectedRegionIds, userId]
  );

  const handleRegionRealtimeUpdates = useCallback((updates: RegionRealtimeUpdate[]) => {
    if (!updates.length) {
      return;
    }

    const queue = regionRealtimeQueueRef.current;

    updates.forEach(({ regionId, updates: regionUpdates }) => {
      if (!regionUpdates || Object.keys(regionUpdates).length === 0) {
        return;
      }

      const existingUpdates = queue.get(regionId) ?? {};
      queue.set(regionId, { ...existingUpdates, ...regionUpdates });
    });

    regionRealtimeEmitterRef.current.push(undefined);
  }, []);

  const handleRegionRealtimeFlush = useCallback(() => {
    regionRealtimeEmitterRef.current.flush();
    regionRealtimeEmitterRef.current.cancel();
    regionRealtimeQueueRef.current.clear();
  }, []);

  const handleRegionMove = useCallback(
    (regionId: string, deltaBeats: number) => {
      const lockId = getRegionLockId(regionId);
      const lock = isLocked(lockId);
      if (lock && lock.userId !== userId) {
        return; // Locked by someone else
      }

      const regionStore = useRegionStore.getState();
      const region = regionStore.regions.find((r) => r.id === regionId);
      if (!region) return;
      
      const baseStart = region.start;
      const originalTrackId = region.trackId;
      moveRegion(regionId, deltaBeats);
      
      const newStart = Math.max(0, baseStart + deltaBeats);
      dawSyncService.syncRegionUpdate(regionId, { 
        start: newStart,
        trackId: originalTrackId 
      });
    },
    [moveRegion, isLocked, userId]
  );

  const handleRegionMoveToTrack = useCallback(
    (regionIds: string[], targetTrackId: string, deltaBeats = 0) => {
      if (!regionIds.length) {
        return;
      }

      const lockConflict = regionIds.some((regionId) => {
        const lock = isLocked(getRegionLockId(regionId));
        return lock && lock.userId !== userId;
      });

      if (lockConflict) {
        return;
      }

      const regionsMap = new Map(useRegionStore.getState().regions.map((region) => [region.id, region]));
      moveRegionsToTrack(regionIds, targetTrackId, deltaBeats);

      regionIds.forEach((regionId) => {
        const original = regionsMap.get(regionId);
        if (!original) {
          return;
        }
        const updates: Partial<Region> = { trackId: targetTrackId };
        if (deltaBeats !== 0) {
          updates.start = Math.max(0, original.start + deltaBeats);
        }
        dawSyncService.syncRegionUpdate(regionId, updates);
      });
    },
    [moveRegionsToTrack, isLocked, userId]
  );

  const handleRegionSplit = useCallback(
    (regionIds: string[], splitPosition: number) => {
      if (!regionIds.length) {
        return;
      }

      const lockConflict = regionIds.some((regionId) => {
        const lock = isLocked(getRegionLockId(regionId));
        return lock && lock.userId !== userId;
      });

      if (lockConflict) {
        return;
      }

      const prevRegions = new Map(useRegionStore.getState().regions.map((region) => [region.id, region]));
      splitRegions(regionIds, splitPosition);
      const nextRegions = new Map(useRegionStore.getState().regions.map((region) => [region.id, region]));

      const removedRegionIds = regionIds.filter(
        (regionId) => !nextRegions.has(regionId) && prevRegions.has(regionId)
      );

      const addedRegions: Region[] = [];
      nextRegions.forEach((region, regionId) => {
        if (!prevRegions.has(regionId)) {
          addedRegions.push(region);
        }
      });

      addedRegions.forEach((region) => {
        dawSyncService.syncRegionAdd(sanitizeRegionForSync(region));
      });

      removedRegionIds.forEach((regionId) => {
        dawSyncService.syncRegionDelete(regionId);
      });
    },
    [splitRegions, isLocked, userId, sanitizeRegionForSync]
  );

  const handleRegionDelete = useCallback(
    (regionId: string) => {
      const lockId = getRegionLockId(regionId);
      const lock = isLocked(lockId);
      if (lock && lock.userId !== userId) {
        return; // Locked by someone else
      }

      removeRegion(regionId);
      dawSyncService.syncRegionDelete(regionId);
    },
    [removeRegion, isLocked, userId]
  );

  const handleRegionSelect = useCallback(
    (regionId: string, additive = false) => {
      const currentUserId = userId || '';
      const lockId = getRegionLockId(regionId);
      const lock = isLocked(lockId);
      if (!currentUserId || (lock && lock.userId !== currentUserId)) {
        return false;
      }

      if (!isLockedByUser(lockId, currentUserId)) {
        const didAcquire = acquireLock(lockId, {
          userId: currentUserId,
          username: username || '',
          type: 'region',
          timestamp: Date.now(),
        });

        if (!didAcquire) {
          return false;
        }

        dawSyncService.acquireLock(lockId, 'region');
      }

      if (!additive) {
        selectedRegionIds.forEach((selectedId) => {
          if (selectedId === regionId) {
            return;
          }
          const selectedLockId = getRegionLockId(selectedId);
          if (isLockedByUser(selectedLockId, currentUserId)) {
            releaseLock(selectedLockId, currentUserId);
            dawSyncService.releaseLock(selectedLockId);
          }
        });
      }

      selectRegion(regionId, additive);
      const newSelectedIds = additive
        ? Array.from(new Set([...selectedRegionIds, regionId]))
        : [regionId];
      dawSyncService.syncSelectionChange({ selectedRegionIds: newSelectedIds });
      return true;
    },
    [
      selectRegion,
      isLocked,
      isLockedByUser,
      acquireLock,
      releaseLock,
      userId,
      username,
      selectedRegionIds,
    ]
  );

  const handleRegionDeselect = useCallback(
    (regionId: string) => {
      if (!selectedRegionIds.includes(regionId)) {
        return;
      }

      const currentUserId = userId || '';
      const lockId = getRegionLockId(regionId);
      if (currentUserId && isLockedByUser(lockId, currentUserId)) {
        releaseLock(lockId, currentUserId);
        dawSyncService.releaseLock(lockId);
      }

      deselectRegion(regionId);
      const nextSelectedIds = selectedRegionIds.filter((id) => id !== regionId);
      dawSyncService.syncSelectionChange({ selectedRegionIds: nextSelectedIds });
    },
    [
      deselectRegion,
      selectedRegionIds,
      userId,
      isLockedByUser,
      releaseLock,
    ]
  );

  const handleRegionClearSelection = useCallback(() => {
    const currentUserId = userId || '';
    selectedRegionIds.forEach((regionId) => {
      const lockId = getRegionLockId(regionId);
      if (currentUserId && isLockedByUser(lockId, currentUserId)) {
        releaseLock(lockId, currentUserId);
        dawSyncService.releaseLock(lockId);
      }
    });
    clearSelection();
    dawSyncService.syncSelectionChange({ selectedRegionIds: [] });
  }, [selectedRegionIds, userId, isLockedByUser, releaseLock, clearSelection]);

  return {
    handleRegionAdd,
    handleRegionUpdate,
    handleRegionDragStart,
    handleRegionDragRealtime,
    handleRegionDragEnd,
    handleRegionRealtimeUpdates,
    handleRegionRealtimeFlush,
    handleRegionMove,
    handleRegionMoveToTrack,
    handleRegionDelete,
    handleRegionSplit,
    handleRegionSelect,
    handleRegionDeselect,
    handleRegionClearSelection,
  };
};
