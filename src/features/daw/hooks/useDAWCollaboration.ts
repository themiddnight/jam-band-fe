import type { Socket } from 'socket.io-client';
import { useDAWInit } from './useDAWInit';
import { useDAWTrackSync } from './useDAWTrackSync';
import { useDAWRegionSync } from './useDAWRegionSync';
import { useDAWNoteSync } from './useDAWNoteSync';
import { useDAWEffectSync } from './useDAWEffectSync';
import { useDAWProjectSync } from './useDAWProjectSync';

interface UseDAWCollaborationOptions {
  socket: Socket | null;
  roomId: string | null;
  enabled?: boolean;
}

/**
 * Hook to handle collaborative DAW operations
 * Manages sync, locking, and state updates
 * Refactored to use sub-hooks for better maintainability
 */
export const useDAWCollaboration = ({
  socket,
  roomId,
  enabled = true,
}: UseDAWCollaborationOptions) => {
  // 1. Initialization & Locks
  const {
    isLocked,
    isLockedByUser,
    acquireInteractionLock,
    releaseInteractionLock,
  } = useDAWInit({ socket, roomId, enabled });

  // 2. Track Sync
  const trackSync = useDAWTrackSync();

  // 3. Region Sync
  const regionSync = useDAWRegionSync();

  // 4. Note Sync
  const noteSync = useDAWNoteSync();

  // 5. Effect Chain Sync
  const effectSync = useDAWEffectSync(enabled);

  // 6. Project & Synth Sync
  const projectSync = useDAWProjectSync();

  return {
    // Lock utilities
    isLocked,
    isLockedByUser,
    acquireInteractionLock,
    releaseInteractionLock,

    // Track handlers
    ...trackSync,

    // Region handlers
    ...regionSync,

    // Note handlers
    ...noteSync,

    // Effect chain handlers
    ...effectSync,

    // Project handlers
    ...projectSync,
  };
};
