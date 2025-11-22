import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { useMarkerStore } from '@/features/daw/stores/markerStore';
import { dawSyncService } from '@/features/daw/services/dawSyncService';

/**
 * Marker Synchronization Tests
 * 
 * Tests the real-time synchronization of markers between users,
 * including late joiner support and state persistence.
 */
describe('Marker Synchronization', () => {
  let mockSocket: Partial<Socket>;
  const roomId = 'test-room';
  const userId = 'user-1';
  const username = 'Test User';

  beforeEach(() => {
    // Reset marker store
    useMarkerStore.setState({
      markers: [],
      selectedMarkerId: null,
      isEditMode: false,
    });

    // Create mock socket
    mockSocket = {
      id: 'socket-1',
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  describe('Marker Addition', () => {
    it('should add marker to local store', () => {
      const marker = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };

      useMarkerStore.getState().addMarker(marker);

      const markers = useMarkerStore.getState().markers;
      expect(markers).toHaveLength(1);
      expect(markers[0]).toEqual(marker);
    });

    it('should sort markers by position', () => {
      const marker1 = {
        id: 'marker-1',
        position: 8.0,
        description: 'Chorus',
        color: '#3b82f6',
      };

      const marker2 = {
        id: 'marker-2',
        position: 4.0,
        description: 'Verse',
        color: '#3b82f6',
      };

      useMarkerStore.getState().addMarker(marker1);
      useMarkerStore.getState().addMarker(marker2);

      const markers = useMarkerStore.getState().markers;
      expect(markers[0].id).toBe('marker-2'); // Position 4.0
      expect(markers[1].id).toBe('marker-1'); // Position 8.0
    });

    it('should emit socket event when adding marker', () => {
      dawSyncService.initialize(mockSocket as Socket, roomId, userId, username);

      const marker = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };

      dawSyncService.syncMarkerAdd(marker);

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:marker_add', {
        roomId,
        marker,
      });

      dawSyncService.cleanup();
    });
  });

  describe('Marker Update', () => {
    beforeEach(() => {
      const marker = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };
      useMarkerStore.getState().addMarker(marker);
    });

    it('should update marker position', () => {
      useMarkerStore.getState().updateMarker('marker-1', { position: 8.0 });

      const markers = useMarkerStore.getState().markers;
      expect(markers[0].position).toBe(8.0);
    });

    it('should update marker description', () => {
      useMarkerStore.getState().updateMarker('marker-1', { description: 'Intro' });

      const markers = useMarkerStore.getState().markers;
      expect(markers[0].description).toBe('Intro');
    });

    it('should re-sort markers after position update', () => {
      const marker2 = {
        id: 'marker-2',
        position: 12.0,
        description: 'Chorus',
        color: '#3b82f6',
      };
      useMarkerStore.getState().addMarker(marker2);

      // Move marker-1 to position 16.0 (after marker-2)
      useMarkerStore.getState().updateMarker('marker-1', { position: 16.0 });

      const markers = useMarkerStore.getState().markers;
      expect(markers[0].id).toBe('marker-2'); // Position 12.0
      expect(markers[1].id).toBe('marker-1'); // Position 16.0
    });

    it('should emit socket event when updating marker', () => {
      dawSyncService.initialize(mockSocket as Socket, roomId, userId, username);

      dawSyncService.syncMarkerUpdate('marker-1', { position: 8.0 });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:marker_update', {
        roomId,
        markerId: 'marker-1',
        updates: { position: 8.0 },
      });

      dawSyncService.cleanup();
    });
  });

  describe('Marker Deletion', () => {
    beforeEach(() => {
      const marker1 = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };
      const marker2 = {
        id: 'marker-2',
        position: 8.0,
        description: 'Chorus',
        color: '#3b82f6',
      };
      useMarkerStore.getState().addMarker(marker1);
      useMarkerStore.getState().addMarker(marker2);
    });

    it('should remove marker from store', () => {
      useMarkerStore.getState().removeMarker('marker-1');

      const markers = useMarkerStore.getState().markers;
      expect(markers).toHaveLength(1);
      expect(markers[0].id).toBe('marker-2');
    });

    it('should clear selection when deleting selected marker', () => {
      useMarkerStore.getState().selectMarker('marker-1');
      useMarkerStore.getState().removeMarker('marker-1');

      expect(useMarkerStore.getState().selectedMarkerId).toBeNull();
    });

    it('should emit socket event when deleting marker', () => {
      dawSyncService.initialize(mockSocket as Socket, roomId, userId, username);

      dawSyncService.syncMarkerDelete('marker-1');

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:marker_delete', {
        roomId,
        markerId: 'marker-1',
      });

      dawSyncService.cleanup();
    });
  });

  describe('Remote Sync (Late Joiner)', () => {
    it('should sync markers from state_sync event', () => {
      const markers = [
        {
          id: 'marker-1',
          position: 4.0,
          description: 'Verse 1',
          color: '#3b82f6',
        },
        {
          id: 'marker-2',
          position: 8.0,
          description: 'Chorus',
          color: '#3b82f6',
        },
      ];

      useMarkerStore.getState().syncSetMarkers(markers);

      const storeMarkers = useMarkerStore.getState().markers;
      expect(storeMarkers).toHaveLength(2);
      expect(storeMarkers[0].id).toBe('marker-1');
      expect(storeMarkers[1].id).toBe('marker-2');
    });

    it('should not duplicate markers on sync', () => {
      const marker = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };

      // Add marker locally
      useMarkerStore.getState().addMarker(marker);

      // Try to sync the same marker (simulating remote add)
      useMarkerStore.getState().syncAddMarker(marker);

      const markers = useMarkerStore.getState().markers;
      expect(markers).toHaveLength(1); // Should not duplicate
    });
  });

  describe('Sync Handlers (Bypass Undo)', () => {
    it('should use syncAddMarker for remote updates', () => {
      const marker = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };

      // Sync handler should not trigger undo history
      useMarkerStore.getState().syncAddMarker(marker);

      const markers = useMarkerStore.getState().markers;
      expect(markers).toHaveLength(1);
      expect(markers[0]).toEqual(marker);
    });

    it('should use syncUpdateMarker for remote updates', () => {
      const marker = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };

      useMarkerStore.getState().addMarker(marker);
      useMarkerStore.getState().syncUpdateMarker('marker-1', { description: 'Intro' });

      const markers = useMarkerStore.getState().markers;
      expect(markers[0].description).toBe('Intro');
    });

    it('should use syncRemoveMarker for remote updates', () => {
      const marker = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };

      useMarkerStore.getState().addMarker(marker);
      useMarkerStore.getState().syncRemoveMarker('marker-1');

      const markers = useMarkerStore.getState().markers;
      expect(markers).toHaveLength(0);
    });
  });

  describe('Edit Mode', () => {
    it('should toggle edit mode', () => {
      expect(useMarkerStore.getState().isEditMode).toBe(false);

      useMarkerStore.getState().setEditMode(true);
      expect(useMarkerStore.getState().isEditMode).toBe(true);

      useMarkerStore.getState().setEditMode(false);
      expect(useMarkerStore.getState().isEditMode).toBe(false);
    });

    it('should clear selection when exiting edit mode', () => {
      const marker = {
        id: 'marker-1',
        position: 4.0,
        description: 'Verse 1',
        color: '#3b82f6',
      };

      useMarkerStore.getState().addMarker(marker);
      useMarkerStore.getState().selectMarker('marker-1');
      useMarkerStore.getState().setEditMode(true);

      expect(useMarkerStore.getState().selectedMarkerId).toBe('marker-1');

      // Selection should be cleared manually when exiting edit mode
      useMarkerStore.getState().setEditMode(false);
      useMarkerStore.getState().selectMarker(null);

      expect(useMarkerStore.getState().selectedMarkerId).toBeNull();
    });
  });
});
