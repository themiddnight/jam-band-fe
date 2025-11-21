import { create } from 'zustand';

export type LockType =
  | 'region'
  | 'track'
  | 'track_property'
  | 'note'
  | 'sustain'
  | 'control';

export interface LockInfo {
  userId: string;
  username: string;
  type: LockType;
  timestamp: number;
}

interface LockStoreState {
  locks: Map<string, LockInfo>; // elementId -> LockInfo
  acquireLock: (elementId: string, lockInfo: LockInfo) => boolean;
  releaseLock: (elementId: string, userId: string) => boolean;
  releaseUserLocks: (userId: string) => void;
  isLocked: (elementId: string) => LockInfo | null;
  isLockedByUser: (elementId: string, userId: string) => boolean;
  clearAllLocks: () => void;
  setLocks: (locks: Array<{ elementId: string } & LockInfo>) => void;
}

export const useLockStore = create<LockStoreState>((set, get) => ({
  locks: new Map(),

  acquireLock: (elementId, lockInfo) => {
    const state = get();
    const existingLock = state.locks.get(elementId);
    
    // If already locked by someone else, return false
    if (existingLock && existingLock.userId !== lockInfo.userId) {
      return false;
    }

    // Acquire lock
    const newLocks = new Map(state.locks);
    newLocks.set(elementId, lockInfo);
    set({ locks: newLocks });
    return true;
  },

  releaseLock: (elementId, userId) => {
    const state = get();
    const lock = state.locks.get(elementId);
    
    if (!lock || lock.userId !== userId) {
      return false;
    }

    const newLocks = new Map(state.locks);
    newLocks.delete(elementId);
    set({ locks: newLocks });
    return true;
  },

  releaseUserLocks: (userId) => {
    const state = get();
    const newLocks = new Map(state.locks);
    
    for (const [elementId, lock] of state.locks.entries()) {
      if (lock.userId === userId) {
        newLocks.delete(elementId);
      }
    }
    
    set({ locks: newLocks });
  },

  isLocked: (elementId) => {
    return get().locks.get(elementId) || null;
  },

  isLockedByUser: (elementId, userId) => {
    const lock = get().locks.get(elementId);
    return lock?.userId === userId;
  },

  clearAllLocks: () => {
    set({ locks: new Map() });
  },

  setLocks: (locksArray) => {
    const newLocks = new Map<string, LockInfo>();
    locksArray.forEach(({ elementId, ...lockInfo }) => {
      newLocks.set(elementId, lockInfo);
    });
    set({ locks: newLocks });
  },
}));

