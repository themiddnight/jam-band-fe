import { useRef, useCallback, useEffect } from 'react';
import { dawSyncService } from '../services/dawSyncService';
import { useLockStore } from '../stores/lockStore';
import { usePianoRollStore } from '../stores/pianoRollStore';
import { useUserStore } from '@/shared/stores/userStore';
import type { MidiNote } from '../types/daw';
import { createThrottledEmitter } from '@/shared/utils/performanceUtils';
import { COLLAB_THROTTLE_INTERVALS } from '@/features/daw/config/collaborationThrottles';
import { getRegionLockId } from '../utils/collaborationLocks';

export const useDAWNoteSync = () => {
  const { userId } = useUserStore();
  
  // Throttled Emitter
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

  // Cleanup
  useEffect(() => {
    const emitter = noteRealtimeEmitterRef.current;
    const queue = noteRealtimeQueueRef.current;
    return () => {
      emitter.cancel();
      queue.clear();
    };
  }, []);

  // Store selectors
  const isLocked = useLockStore((state) => state.isLocked);
  const addNote = usePianoRollStore((state) => state.addNote);
  const updateNote = usePianoRollStore((state) => state.updateNote);
  const deleteNote = usePianoRollStore((state) => state.deleteNote);
  const activeRegionId = usePianoRollStore((state) => state.activeRegionId);

  // Handlers
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

  return {
    handleNoteAdd,
    handleNoteUpdate,
    handleNoteDelete,
    handleNoteRealtimeUpdates,
    handleNoteRealtimeFlush,
  };
};
