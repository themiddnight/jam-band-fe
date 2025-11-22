import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBroadcast } from '../hooks/useBroadcast';
import { useBroadcastPlayback } from '../hooks/useBroadcastPlayback';
import { useBroadcastStore } from '../stores/broadcastStore';
import { useTrackStore } from '../stores/trackStore';

/**
 * Broadcast Feature Integration Tests
 * Tests the complete broadcast feature workflow
 */

const createMockSocket = () => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  to: vi.fn(() => ({ emit: vi.fn() })),
  connected: true,
});

describe('Broadcast Feature Integration', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.clearAllMocks();
    
    // Reset stores
    useBroadcastStore.getState().setBroadcasting(false);
    useBroadcastStore.getState().clearBroadcastingUsers();
    useTrackStore.getState().clearTracks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useBroadcast hook', () => {
    it('should initialize without errors', () => {
      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      expect(result.current.handleBroadcastToggle).toBeDefined();
      expect(result.current.broadcastMidiMessage).toBeDefined();
      expect(result.current.getBroadcastUsers).toBeDefined();
    });

    it('should emit broadcast state when toggling on', () => {
      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      act(() => {
        result.current.handleBroadcastToggle(true, 'track-1');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:broadcast_state', {
        roomId: 'test-room',
        userId: 'user-1',
        username: 'TestUser',
        broadcasting: true,
        trackId: 'track-1',
      });
    });

    it('should emit broadcast state when toggling off', () => {
      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      act(() => {
        result.current.handleBroadcastToggle(false, null);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:broadcast_state', {
        roomId: 'test-room',
        userId: 'user-1',
        username: 'TestUser',
        broadcasting: false,
        trackId: null,
      });
    });

    it('should not emit when disabled', () => {
      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: false,
        })
      );

      act(() => {
        result.current.handleBroadcastToggle(true, 'track-1');
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should broadcast MIDI note when broadcasting is enabled', () => {
      // Setup track
      act(() => {
        useTrackStore.getState().addTrack({ type: 'midi' });
      });
      const trackId = useTrackStore.getState().tracks[0].id;
      useTrackStore.getState().selectTrack(trackId);

      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      // Enable broadcasting
      act(() => {
        useBroadcastStore.getState().setBroadcasting(true);
      });

      act(() => {
        result.current.broadcastMidiMessage({
          type: 'noteon',
          channel: 0,
          note: 60,
          velocity: 100,
          raw: {} as any,
        });
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'arrange:broadcast_note',
        expect.objectContaining({
          roomId: 'test-room',
          userId: 'user-1',
          trackId,
          noteData: {
            note: 60,
            velocity: 100,
            type: 'noteon',
          },
        })
      );
    });

    it('should not broadcast MIDI note when broadcasting is disabled', () => {
      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      act(() => {
        useBroadcastStore.getState().setBroadcasting(false);
        result.current.broadcastMidiMessage({
          type: 'noteon',
          channel: 0,
          note: 60,
          velocity: 100,
          raw: {} as any,
        });
      });

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        'arrange:broadcast_note',
        expect.anything()
      );
    });

    it('should only broadcast note on/off events', () => {
      // Setup track
      act(() => {
        useTrackStore.getState().addTrack({ type: 'midi' });
      });
      const trackId = useTrackStore.getState().tracks[0].id;
      useTrackStore.getState().selectTrack(trackId);

      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      act(() => {
        useBroadcastStore.getState().setBroadcasting(true);
        
        // Try to broadcast control change (should be ignored)
        result.current.broadcastMidiMessage({
          type: 'controlchange',
          channel: 0,
          control: 64,
          value: 127,
          raw: {} as any,
        });
      });

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        'arrange:broadcast_note',
        expect.anything()
      );
    });

    it('should return list of broadcasting users', () => {
      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      act(() => {
        useBroadcastStore.getState().addBroadcastingUser('user-2', 'Alice', 'track-1');
        useBroadcastStore.getState().addBroadcastingUser('user-3', 'Bob', 'track-2');
      });

      const users = result.current.getBroadcastUsers();
      expect(users).toHaveLength(2);
      expect(users).toEqual(
        expect.arrayContaining([
          { userId: 'user-2', username: 'Alice', trackId: 'track-1' },
          { userId: 'user-3', username: 'Bob', trackId: 'track-2' },
        ])
      );
    });
  });

  describe('useBroadcastPlayback hook', () => {
    it('should initialize without errors', () => {
      const { result } = renderHook(() =>
        useBroadcastPlayback({
          socket: mockSocket as any,
          enabled: true,
        })
      );

      expect(result.current).toBeUndefined();
    });

    it('should register broadcast_note listener when enabled', () => {
      renderHook(() =>
        useBroadcastPlayback({
          socket: mockSocket as any,
          enabled: true,
        })
      );

      expect(mockSocket.on).toHaveBeenCalledWith(
        'arrange:broadcast_note',
        expect.any(Function)
      );
    });

    it('should not register listener when disabled', () => {
      renderHook(() =>
        useBroadcastPlayback({
          socket: mockSocket as any,
          enabled: false,
        })
      );

      expect(mockSocket.on).not.toHaveBeenCalled();
    });

    it('should unregister listener on unmount', () => {
      const { unmount } = renderHook(() =>
        useBroadcastPlayback({
          socket: mockSocket as any,
          enabled: true,
        })
      );

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith(
        'arrange:broadcast_note',
        expect.any(Function)
      );
    });
  });

  describe('Broadcast workflow', () => {
    it('should complete full broadcast cycle', () => {
      // Setup track
      act(() => {
        useTrackStore.getState().addTrack({ type: 'midi', name: 'Piano' });
      });
      const trackId = useTrackStore.getState().tracks[0].id;
      useTrackStore.getState().selectTrack(trackId);

      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      // Step 1: Enable broadcasting
      act(() => {
        result.current.handleBroadcastToggle(true, trackId);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:broadcast_state', {
        roomId: 'test-room',
        userId: 'user-1',
        username: 'TestUser',
        broadcasting: true,
        trackId,
      });

      // Step 2: Broadcast a note
      act(() => {
        result.current.broadcastMidiMessage({
          type: 'noteon',
          channel: 0,
          note: 60,
          velocity: 100,
          raw: {} as any,
        });
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'arrange:broadcast_note',
        expect.objectContaining({
          roomId: 'test-room',
          userId: 'user-1',
          trackId,
          noteData: {
            note: 60,
            velocity: 100,
            type: 'noteon',
          },
        })
      );

      // Step 3: Disable broadcasting
      act(() => {
        result.current.handleBroadcastToggle(false, null);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:broadcast_state', {
        roomId: 'test-room',
        userId: 'user-1',
        username: 'TestUser',
        broadcasting: false,
        trackId: null,
      });
    });

    it('should handle multiple simultaneous broadcasters', () => {
      act(() => {
        useBroadcastStore.getState().addBroadcastingUser('user-2', 'Alice', 'track-1');
        useBroadcastStore.getState().addBroadcastingUser('user-3', 'Bob', 'track-2');
        useBroadcastStore.getState().addBroadcastingUser('user-4', 'Charlie', 'track-1');
      });

      const users = useBroadcastStore.getState().broadcastingUsers;
      expect(users.size).toBe(3);
      
      // Multiple users can broadcast on the same track
      const usersOnTrack1 = Array.from(users.values()).filter(
        (u) => u.trackId === 'track-1'
      );
      expect(usersOnTrack1).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should handle null socket gracefully', () => {
      const { result } = renderHook(() =>
        useBroadcast({
          socket: null,
          roomId: 'test-room',
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      expect(() => {
        act(() => {
          result.current.handleBroadcastToggle(true, 'track-1');
        });
      }).not.toThrow();
    });

    it('should handle null roomId gracefully', () => {
      const { result } = renderHook(() =>
        useBroadcast({
          socket: mockSocket as any,
          roomId: null,
          userId: 'user-1',
          username: 'TestUser',
          enabled: true,
        })
      );

      expect(() => {
        act(() => {
          result.current.handleBroadcastToggle(true, 'track-1');
        });
      }).not.toThrow();
    });
  });
});
