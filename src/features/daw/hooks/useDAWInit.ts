import { useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { dawSyncService } from '../services/dawSyncService';
import { useUserStore } from '@/shared/stores/userStore';
import { useRecordingStore, type RecordingType } from '../stores/recordingStore';
import { useLockStore, type LockType } from '../stores/lockStore';
import { createThrottledEmitter } from '@/shared/utils/performanceUtils';
import { COLLAB_THROTTLE_INTERVALS } from '@/features/daw/config/collaborationThrottles';

interface UseDAWInitProps {
  socket: Socket | null;
  roomId: string | null;
  enabled?: boolean;
}

export const useDAWInit = ({ socket, roomId, enabled = true }: UseDAWInitProps) => {
  const { userId, username } = useUserStore();
  const isInitializedRef = useRef(false);
  const isBroadcastingRecordingRef = useRef(false);

  // Recording Preview Emitter
  // Lazily initialize to avoid recreating on every render
  const recordingPreviewEmitterRef = useRef(
    createThrottledEmitter<{
      trackId: string;
      recordingType: RecordingType;
      startBeat: number;
      durationBeats: number;
    } | null>((payload) => {
      if (!payload) {
        dawSyncService.syncRecordingPreviewEnd();
        return;
      }
      dawSyncService.syncRecordingPreview(payload);
    }, COLLAB_THROTTLE_INTERVALS.recordingPreviewMs)
  );

  // Initialize sync service
  useEffect(() => {
    if (!enabled || !socket || !roomId || !userId || !username) {
      return;
    }

    if (!isInitializedRef.current) {
      dawSyncService.initialize(socket, roomId, userId, username);
      isInitializedRef.current = true;
      dawSyncService.requestState();
    }

    return () => {
      if (isInitializedRef.current) {
        dawSyncService.cleanup();
        isInitializedRef.current = false;
      }
    };
  }, [enabled, socket, roomId, userId, username]);

  // Cleanup locks on unmount
  const releaseUserLocks = useLockStore((state) => state.releaseUserLocks);
  useEffect(() => {
    const emitter = recordingPreviewEmitterRef.current;
    return () => {
      if (isInitializedRef.current) {
        dawSyncService.cleanup();
        releaseUserLocks(userId || '');
        isInitializedRef.current = false;
      }
      emitter.cancel();
    };
  }, [userId, releaseUserLocks]);

  // Clear remote previews when disabled
  useEffect(() => {
    if (!enabled || !roomId) {
      useRecordingStore.getState().clearRemoteRecordingPreviews();
    }
  }, [enabled, roomId]);

  // Recording Preview Logic
  const emitRecordingPreview = useCallback(
    (preview: {
      trackId: string;
      recordingType: RecordingType;
      startBeat: number;
      durationBeats: number;
    } | null) => {
      if (!enabled || !roomId) return;
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

  // Lock Utilities
  const isLocked = useLockStore((state) => state.isLocked);
  const isLockedByUser = useLockStore((state) => state.isLockedByUser);
  const acquireLock = useLockStore((state) => state.acquireLock);
  const releaseLock = useLockStore((state) => state.releaseLock);

  const acquireInteractionLock = useCallback(
    (elementId: string, type: LockType) => {
      const currentUserId = userId || '';
      const currentUsername = username || '';
      if (!currentUserId) return false;

      if (isLockedByUser(elementId, currentUserId)) return true;

      const didAcquire = acquireLock(elementId, {
        userId: currentUserId,
        username: currentUsername,
        type,
        timestamp: Date.now(),
      });

      if (!didAcquire) return false;

      dawSyncService.acquireLock(elementId, type);
      return true;
    },
    [acquireLock, isLockedByUser, userId, username]
  );

  const releaseInteractionLock = useCallback(
    (elementId: string) => {
      const currentUserId = userId || '';
      if (!currentUserId) return;

      const didRelease = releaseLock(elementId, currentUserId);
      if (didRelease) {
        dawSyncService.releaseLock(elementId);
      }
    },
    [releaseLock, userId]
  );

  return {
    isLocked,
    isLockedByUser: (elementId: string) => isLockedByUser(elementId, userId || ''),
    acquireInteractionLock,
    releaseInteractionLock,
  };
};
