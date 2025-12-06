import { useLockStore, type LockInfo } from '../stores/lockStore';

export const LockService = {
  getLocks: () => useLockStore.getState().locks,
  setLocks: (locks: Array<{ elementId: string } & LockInfo>) => 
    useLockStore.getState().setLocks(locks),
  acquireLock: (elementId: string, lockInfo: LockInfo) => 
    useLockStore.getState().acquireLock(elementId, lockInfo),
  releaseLock: (elementId: string, userId: string) => 
    useLockStore.getState().releaseLock(elementId, userId),
  isLocked: (elementId: string) => useLockStore.getState().isLocked(elementId),
};
