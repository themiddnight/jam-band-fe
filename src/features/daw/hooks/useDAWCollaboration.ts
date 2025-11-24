import { useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { dawSyncService, type RegionDragUpdatePayload } from '../services/dawSyncService';
import { useLockStore, type LockType } from '../stores/lockStore';
import { useTrackStore } from '../stores/trackStore';
import { useRegionStore } from '../stores/regionStore';
import { useRecordingStore, type RecordingType } from '../stores/recordingStore';
import { usePianoRollStore } from '../stores/pianoRollStore';
import { useSynthStore } from '../stores/synthStore';
import { useProjectStore } from '../stores/projectStore';
import { useUserStore } from '@/shared/stores/userStore';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import type { EffectChainState } from '@/shared/types';
import type { SynthState } from '@/features/instruments';
import type { TimeSignature, Region, AudioRegion, Track, MidiNote } from '../types/daw';
import type { InstrumentCategory } from '@/shared/constants/instruments';
import { createThrottledEmitter } from '@/shared/utils/performanceUtils';
import { COLLAB_THROTTLE_INTERVALS } from '@/features/daw/config/collaborationThrottles';
import type { RegionRealtimeUpdate } from '../contexts/DAWCollaborationContext.shared';
import { getRegionLockId, getTrackPanLockId, getTrackVolumeLockId } from '../utils/collaborationLocks';
import { useMarkerStore } from '../stores/markerStore';
import type { TimeMarker } from '../types/marker';

interface UseDAWCollaborationOptions {
  socket: Socket | null;
  roomId: string | null;
  enabled?: boolean;
}

/**
 * Hook to handle collaborative DAW operations
 * Manages sync, locking, and state updates
 */
export const useDAWCollaboration = ({
  socket,
  roomId,
  enabled = true,
}: UseDAWCollaborationOptions) => {
  const { userId, username } = useUserStore();
  const isInitializedRef = useRef(false);
  const activeTrackControlLockRef = useRef<{ lockId: string; control: 'volume' | 'pan' } | null>(null);
  const effectChainSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEffectChainsRef = useRef<Record<string, string>>({}); // Store JSON strings for comparison
  const isBroadcastingRecordingRef = useRef(false);
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
  const noteRealtimeQueueRef = useRef<Map<string, { regionId: string; updates: Partial<MidiNote> }>>(new Map());
  const noteRealtimeEmitterRef = useRef(
    createThrottledEmitter<void>(() => {
      const queue = noteRealtimeQueueRef.current;
      if (queue.size === 0) {
        return;
      }

      queue.forEach((payload, noteId) => {
        if (!payload || !payload.updates || Object.keys(payload.updates).length === 0) {
          return;
        }
        dawSyncService.syncNoteUpdate(payload.regionId, noteId, payload.updates);
      });

      queue.clear();
    }, COLLAB_THROTTLE_INTERVALS.noteRealtimeMs)
  );
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

  const effectChainQueueRef = useRef<Map<string, { trackId: string; chainType: string; chain: EffectChainState }>>(new Map());
  const effectChainEmitterRef = useRef(
    createThrottledEmitter<void>(() => {
      const queue = effectChainQueueRef.current;
      if (queue.size === 0) {
        return;
      }

      queue.forEach(({ trackId, chainType, chain }) => {
        dawSyncService.syncEffectChainUpdate(trackId, chainType, chain);
      });

      queue.clear();
    }, COLLAB_THROTTLE_INTERVALS.effectChainMs)
  );

  type RecordingPreviewPayload = {
    trackId: string;
    recordingType: RecordingType;
    startBeat: number;
    durationBeats: number;
  };

  const recordingPreviewEmitterRef = useRef(
    createThrottledEmitter<RecordingPreviewPayload | null>((payload) => {
      if (!payload) {
        dawSyncService.syncRecordingPreviewEnd();
        return;
      }

      dawSyncService.syncRecordingPreview(payload);
    }, COLLAB_THROTTLE_INTERVALS.recordingPreviewMs)
  );
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

  // Lock store
  const acquireLock = useLockStore((state) => state.acquireLock);
  const releaseLock = useLockStore((state) => state.releaseLock);
  const releaseUserLocks = useLockStore((state) => state.releaseUserLocks);
  const isLocked = useLockStore((state) => state.isLocked);
  const isLockedByUser = useLockStore((state) => state.isLockedByUser);

  // Track store
  const addTrack = useTrackStore((state) => state.addTrack);
  const updateTrack = useTrackStore((state) => state.updateTrack);
  const removeTrack = useTrackStore((state) => state.removeTrack);
  const setTrackName = useTrackStore((state) => state.setTrackName);
  const setTrackVolume = useTrackStore((state) => state.setTrackVolume);
  const setTrackPan = useTrackStore((state) => state.setTrackPan);
  const setTrackInstrument = useTrackStore((state) => state.setTrackInstrument);
  const reorderTrack = useTrackStore((state) => state.reorderTrack);
  const selectTrack = useTrackStore((state) => state.selectTrack);

  // Region store
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

  // Piano roll store
  const addNote = usePianoRollStore((state) => state.addNote);
  const updateNote = usePianoRollStore((state) => state.updateNote);
  const deleteNote = usePianoRollStore((state) => state.deleteNote);
  const activeRegionId = usePianoRollStore((state) => state.activeRegionId);

  // Project store
  const setBpm = useProjectStore((state) => state.setBpm);
  const setTimeSignature = useProjectStore((state) => state.setTimeSignature);

  // Synth store
  const updateSynthStateStore = useSynthStore((state) => state.updateSynthState);

  // Marker store
  const addMarker = useMarkerStore((state) => state.addMarker);
  const updateMarker = useMarkerStore((state) => state.updateMarker);
  const removeMarker = useMarkerStore((state) => state.removeMarker);

  // Initialize sync service
  useEffect(() => {
    if (!enabled || !socket || !roomId || !userId || !username) {
      return;
    }

    if (!isInitializedRef.current) {
      dawSyncService.initialize(socket, roomId, userId, username);
      isInitializedRef.current = true;

      // Request initial state
      dawSyncService.requestState();
    }

    return () => {
      if (isInitializedRef.current) {
        dawSyncService.cleanup();
        isInitializedRef.current = false;
      }
    };
  }, [enabled, socket, roomId, userId, username]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInitializedRef.current) {
        dawSyncService.cleanup();
        releaseUserLocks(userId || '');
        isInitializedRef.current = false;
      }
    };
  }, [userId, releaseUserLocks]);

  useEffect(() => {
    const regionDragEmitter = regionDragEmitterRef.current;
    const regionDragQueue = regionDragQueueRef.current;
    const regionRealtimeEmitter = regionRealtimeEmitterRef.current;
    const regionRealtimeQueue = regionRealtimeQueueRef.current;
    const noteRealtimeEmitter = noteRealtimeEmitterRef.current;
    const noteRealtimeQueue = noteRealtimeQueueRef.current;
    const trackPropertyEmitter = trackPropertyEmitterRef.current;
    const trackPropertyQueue = trackPropertyQueueRef.current;
    const effectChainEmitter = effectChainEmitterRef.current;
    const effectChainQueue = effectChainQueueRef.current;
    const synthParamsEmitter = synthParamsEmitterRef.current;
    const synthParamsQueue = synthParamsQueueRef.current;
    const markerEmitter = markerEmitterRef.current;
    const markerQueue = markerQueueRef.current;

    const recordingPreviewEmitter = recordingPreviewEmitterRef.current;

    return () => {
      regionDragEmitter.cancel();
      regionDragQueue.clear();
      regionRealtimeEmitter.cancel();
      regionRealtimeQueue.clear();
      noteRealtimeEmitter.cancel();
      noteRealtimeQueue.clear();
      trackPropertyEmitter.cancel();
      trackPropertyQueue.clear();
      effectChainEmitter.cancel();
      effectChainQueue.clear();
      markerEmitter.cancel();
      markerQueue.clear();
      synthParamsEmitter.cancel();
      synthParamsQueue.clear();
      recordingPreviewEmitter.cancel();
    };
  }, []);

  useEffect(() => {
    if (!enabled || !roomId) {
      useRecordingStore.getState().clearRemoteRecordingPreviews();
    }
  }, [enabled, roomId]);

  const emitRecordingPreview = useCallback(
    (preview: RecordingPreviewPayload | null) => {
      if (!enabled || !roomId) {
        return;
      }
      recordingPreviewEmitterRef.current.push(preview);
    },
    [enabled, roomId]
  );

  useEffect(() => {
    const unsubscribe = useRecordingStore.subscribe((next) => {
      const isActive =
        enabled &&
        roomId &&
        userId &&
        next.isRecording &&
        !!next.recordingTrackId &&
        !!next.recordingType;

      if (isActive) {
        emitRecordingPreview({
          trackId: next.recordingTrackId!,
          recordingType: next.recordingType as RecordingType,
          startBeat: next.recordingStartBeat,
          durationBeats: Math.max(0, next.recordingDurationBeats),
        });
        isBroadcastingRecordingRef.current = true;
      } else if (isBroadcastingRecordingRef.current) {
        emitRecordingPreview(null);
        isBroadcastingRecordingRef.current = false;
      }
    });

    return () => {
      unsubscribe();
      if (isBroadcastingRecordingRef.current) {
        emitRecordingPreview(null);
        isBroadcastingRecordingRef.current = false;
      }
    };
  }, [emitRecordingPreview, enabled, roomId, userId]);

  // ========== Track sync handlers ==========

  // Wrap track operations to sync
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

  // ========== Region sync handlers ==========

  const sanitizeRegionForSync = useCallback((region: Region): Region => {
    if (region.type === 'audio') {
      const sanitized = { ...region, audioBuffer: undefined };
      return sanitized as Region;
    }
    return region;
  }, []);

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

  const handleNoteRealtimeUpdates = useCallback(
    (
      updates: Array<{
        regionId: string;
        noteId: string;
        updates: Partial<MidiNote>;
      }>
    ) => {
      if (!updates.length) {
        return;
      }

      const queue = noteRealtimeQueueRef.current;
      updates.forEach(({ regionId, noteId, updates: noteUpdates }) => {
        if (!noteUpdates || Object.keys(noteUpdates).length === 0) {
          return;
        }
        const existing = queue.get(noteId);
        queue.set(noteId, {
          regionId,
          updates: { ...(existing?.updates ?? {}), ...noteUpdates },
        });
      });

      noteRealtimeEmitterRef.current.push(undefined);
    },
    []
  );

  const handleNoteRealtimeFlush = useCallback(() => {
    noteRealtimeEmitterRef.current.flush();
    noteRealtimeEmitterRef.current.cancel();
    noteRealtimeQueueRef.current.clear();
  }, []);

  const handleRegionMove = useCallback(
    (regionId: string, deltaBeats: number) => {
      const lockId = getRegionLockId(regionId);
      const lock = isLocked(lockId);
      if (lock && lock.userId !== userId) {
        return; // Locked by someone else
      }

      const region = useRegionStore.getState().regions.find((r) => r.id === regionId);
      const baseStart = region?.start ?? 0;
      moveRegion(regionId, deltaBeats);
      const newStart = Math.max(0, baseStart + deltaBeats);
      dawSyncService.syncRegionUpdate(regionId, { start: newStart });
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

  // ========== Note sync handlers ==========

  const handleNoteAdd = useCallback(
    (note: Parameters<typeof addNote>[0]) => {
      if (!activeRegionId) return null;
      const lockId = getRegionLockId(activeRegionId);
      const lock = isLocked(lockId);
      if (lock && lock.userId !== userId) {
        return null; // Region locked by someone else
      }

      const addedNote = addNote(note);
      if (addedNote) {
        dawSyncService.syncNoteAdd(activeRegionId, addedNote);
      }
      return addedNote;
    },
    [addNote, activeRegionId, isLocked, userId]
  );

  const handleNoteUpdate = useCallback(
    (noteId: string, updates: Parameters<typeof updateNote>[1]) => {
      if (!activeRegionId) return;
      const lockId = getRegionLockId(activeRegionId);
      const lock = isLocked(lockId);
      if (lock && lock.userId !== userId) {
        return; // Region locked by someone else
      }

      updateNote(noteId, updates);
      dawSyncService.syncNoteUpdate(activeRegionId, noteId, updates);
    },
    [updateNote, activeRegionId, isLocked, userId]
  );

  const handleNoteDelete = useCallback(
    (noteId: string) => {
      if (!activeRegionId) return;
      const lock = isLocked(activeRegionId);
      if (lock && lock.userId !== userId) {
        return; // Region locked by someone else
      }

      deleteNote(noteId);
      dawSyncService.syncNoteDelete(activeRegionId, noteId);
    },
    [deleteNote, activeRegionId, isLocked, userId]
  );

  // ========== Effect chain sync ==========

  const handleEffectChainUpdate = useCallback(
    (trackId: string, chainType: string, effectChain: any) => {
      const key = `${trackId}:${chainType}`;
      effectChainQueueRef.current.set(key, {
        trackId,
        chainType,
        chain: effectChain,
      });
      effectChainEmitterRef.current.push(undefined);
    },
    []
  );

  // ========== Synth / Project sync ==========

  const handleSynthParamsChange = useCallback(
    (trackId: string, params: Partial<SynthState>) => {
      updateSynthStateStore(trackId, params);
      const existing = synthParamsQueueRef.current.get(trackId) ?? {};
      synthParamsQueueRef.current.set(trackId, { ...existing, ...params });
      synthParamsEmitterRef.current.push(undefined);
    },
    [updateSynthStateStore]
  );

  const acquireInteractionLock = useCallback(
    (elementId: string, type: LockType) => {
      const currentUserId = userId || '';
      const currentUsername = username || '';
      if (!currentUserId) {
        return false;
      }

      if (isLockedByUser(elementId, currentUserId)) {
          return true;
      }

      const didAcquire = acquireLock(elementId, {
        userId: currentUserId,
        username: currentUsername,
        type,
        timestamp: Date.now(),
      });

      if (!didAcquire) {
        return false;
      }

      dawSyncService.acquireLock(elementId, type);
      return true;
    },
    [acquireLock, isLockedByUser, userId, username]
  );

  const releaseInteractionLock = useCallback(
    (elementId: string) => {
      const currentUserId = userId || '';
      if (!currentUserId) {
        return;
      }

      const didRelease = releaseLock(elementId, currentUserId);
      if (didRelease) {
        dawSyncService.releaseLock(elementId);
      }
    },
    [releaseLock, userId]
  );

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

  // ========== Marker sync handlers ==========

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

  // Subscribe to track-specific effect chain changes (debounced by dawSyncService)
  useEffect(() => {
    if (!enabled) return;

    let isInitialLoad = true;

    const unsubscribe = useEffectsStore.subscribe((state) => {
      // Skip initial load
      if (isInitialLoad) {
        Object.keys(state.chains).forEach((chainType) => {
          const chain = state.chains[chainType as any];
          if (chain) {
            prevEffectChainsRef.current[chainType] = JSON.stringify(chain);
          }
        });
        isInitialLoad = false;
        return;
      }

      const tracks = useTrackStore.getState().tracks;
      // Check for changes in track-specific effect chains
      tracks.forEach((track) => {
        const chainType = `track:${track.id}` as any;
        const chain = state.chains[chainType];
        if (!chain) {
          // Chain was removed, update prev state
          delete prevEffectChainsRef.current[chainType];
          return;
        }

        const chainJson = JSON.stringify(chain);
        const prevChainJson = prevEffectChainsRef.current[chainType];

        // Only sync if chain has actually changed
        if (chainJson !== prevChainJson) {
          // Small delay to avoid syncing remote updates that just came in
          // The debouncing in dawSyncService will handle rapid updates
          if (effectChainSyncTimeoutRef.current) {
            clearTimeout(effectChainSyncTimeoutRef.current);
          }
          
          effectChainSyncTimeoutRef.current = setTimeout(() => {
            // Double-check the chain still exists and is different
            const currentState = useEffectsStore.getState();
            const currentChain = currentState.chains[chainType];
            if (currentChain && JSON.stringify(currentChain) !== prevChainJson) {
              // Convert to shared format for sync
              const sharedChain: EffectChainState = {
                type: chainType as any,
                effects: currentChain.effects.map((effect) => ({
                  id: effect.id,
                  type: effect.type,
                  bypassed: effect.bypassed,
                  order: effect.order,
                  parameters: effect.parameters.map((param) => ({
                    name: param.name,
                    value: param.value,
                  })),
                })),
              };
              handleEffectChainUpdate(track.id, chainType, sharedChain);
            }
          }, 100); // Small delay to let remote updates settle
          
          prevEffectChainsRef.current[chainType] = chainJson;
        }
      });
    });

    return () => {
      unsubscribe();
      if (effectChainSyncTimeoutRef.current) {
        clearTimeout(effectChainSyncTimeoutRef.current);
      }
    };
  }, [enabled, handleEffectChainUpdate]);

  return {
    // Track handlers
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

    // Region handlers
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

    // Note handlers
    handleNoteAdd,
    handleNoteUpdate,
    handleNoteDelete,
    handleNoteRealtimeUpdates,
    handleNoteRealtimeFlush,

    // Effect chain
    handleEffectChainUpdate,

    // Synth / Project
    handleSynthParamsChange,
    handleBpmChange,
    handleTimeSignatureChange,
    handleProjectScaleChange,

    // Marker handlers
    handleMarkerAdd,
    handleMarkerUpdate,
    handleMarkerUpdateFlush,
    handleMarkerDelete,

    // Lock utilities
    isLocked,
    isLockedByUser: (elementId: string) => isLockedByUser(elementId, userId || ''),
    acquireInteractionLock,
    releaseInteractionLock,
  };
};

