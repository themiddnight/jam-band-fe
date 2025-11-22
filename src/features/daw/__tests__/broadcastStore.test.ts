import { describe, it, expect, beforeEach } from 'vitest';
import { useBroadcastStore } from '../stores/broadcastStore';

describe('broadcastStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useBroadcastStore.getState();
    store.setBroadcasting(false);
    store.clearBroadcastingUsers();
  });

  describe('local broadcast state', () => {
    it('should initialize with broadcasting disabled', () => {
      const { isBroadcasting } = useBroadcastStore.getState();
      expect(isBroadcasting).toBe(false);
    });

    it('should enable broadcasting', () => {
      const { setBroadcasting } = useBroadcastStore.getState();
      setBroadcasting(true);
      
      const { isBroadcasting } = useBroadcastStore.getState();
      expect(isBroadcasting).toBe(true);
    });

    it('should disable broadcasting', () => {
      const { setBroadcasting } = useBroadcastStore.getState();
      setBroadcasting(true);
      setBroadcasting(false);
      
      const { isBroadcasting } = useBroadcastStore.getState();
      expect(isBroadcasting).toBe(false);
    });
  });

  describe('broadcasting users management', () => {
    it('should initialize with empty broadcasting users', () => {
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.size).toBe(0);
    });

    it('should add a broadcasting user', () => {
      const { addBroadcastingUser } = useBroadcastStore.getState();
      addBroadcastingUser('user-1', 'Alice', 'track-1');
      
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.size).toBe(1);
      expect(broadcastingUsers.get('user-1')).toEqual({
        userId: 'user-1',
        username: 'Alice',
        trackId: 'track-1',
      });
    });

    it('should add multiple broadcasting users', () => {
      const { addBroadcastingUser } = useBroadcastStore.getState();
      addBroadcastingUser('user-1', 'Alice', 'track-1');
      addBroadcastingUser('user-2', 'Bob', 'track-2');
      
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.size).toBe(2);
    });

    it('should update existing broadcasting user', () => {
      const { addBroadcastingUser } = useBroadcastStore.getState();
      addBroadcastingUser('user-1', 'Alice', 'track-1');
      addBroadcastingUser('user-1', 'Alice', 'track-2');
      
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.size).toBe(1);
      expect(broadcastingUsers.get('user-1')?.trackId).toBe('track-2');
    });

    it('should remove a broadcasting user', () => {
      const { addBroadcastingUser, removeBroadcastingUser } = useBroadcastStore.getState();
      addBroadcastingUser('user-1', 'Alice', 'track-1');
      addBroadcastingUser('user-2', 'Bob', 'track-2');
      
      removeBroadcastingUser('user-1');
      
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.size).toBe(1);
      expect(broadcastingUsers.has('user-1')).toBe(false);
      expect(broadcastingUsers.has('user-2')).toBe(true);
    });

    it('should update broadcasting user track', () => {
      const { addBroadcastingUser, updateBroadcastingUserTrack } = useBroadcastStore.getState();
      addBroadcastingUser('user-1', 'Alice', 'track-1');
      
      updateBroadcastingUserTrack('user-1', 'track-3');
      
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.get('user-1')?.trackId).toBe('track-3');
    });

    it('should not update track for non-existent user', () => {
      const { updateBroadcastingUserTrack } = useBroadcastStore.getState();
      updateBroadcastingUserTrack('non-existent', 'track-1');
      
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.size).toBe(0);
    });

    it('should clear all broadcasting users', () => {
      const { addBroadcastingUser, clearBroadcastingUsers } = useBroadcastStore.getState();
      addBroadcastingUser('user-1', 'Alice', 'track-1');
      addBroadcastingUser('user-2', 'Bob', 'track-2');
      
      clearBroadcastingUsers();
      
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.size).toBe(0);
    });
  });

  describe('state isolation', () => {
    it('should not affect broadcasting users when changing local broadcast state', () => {
      const { addBroadcastingUser, setBroadcasting } = useBroadcastStore.getState();
      addBroadcastingUser('user-1', 'Alice', 'track-1');
      
      setBroadcasting(true);
      
      const { broadcastingUsers } = useBroadcastStore.getState();
      expect(broadcastingUsers.size).toBe(1);
    });

    it('should not affect local broadcast state when managing broadcasting users', () => {
      const { setBroadcasting, addBroadcastingUser, removeBroadcastingUser } = useBroadcastStore.getState();
      setBroadcasting(true);
      
      addBroadcastingUser('user-1', 'Alice', 'track-1');
      removeBroadcastingUser('user-1');
      
      const { isBroadcasting } = useBroadcastStore.getState();
      expect(isBroadcasting).toBe(true);
    });
  });
});
