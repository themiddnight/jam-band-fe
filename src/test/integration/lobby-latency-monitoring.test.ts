import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePingMeasurement } from '@/features/audio/hooks/usePingMeasurement';
import { createMockSocket, triggerSocketEvent, type MockSocket } from '@/test/mocks/socket';
import type { Socket } from 'socket.io-client';

describe('Lobby Latency Monitoring Integration', () => {
  let mockLobbySocket: MockSocket;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock socket for lobby monitoring
    mockLobbySocket = createMockSocket({ connected: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Lobby Monitor Namespace Requirements', () => {
    it('should handle ping measurements for lobby monitoring', () => {
      // This test verifies that ping measurement works with a lobby socket
      // Requirements: 2.1, 9.1, 9.5

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true,
        interval: 1000
      }));

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isEnabled).toBe(true);

      // Send ping measurement
      act(() => {
        result.current.sendPing();
      });

      // Verify ping was sent to lobby socket
      expect(mockLobbySocket.emit).toHaveBeenCalledWith('ping_measurement', expect.objectContaining({
        pingId: expect.stringMatching(/^ping_\d+_/),
        timestamp: expect.any(Number)
      }));
    });

    it('should receive ping responses from lobby monitor namespace', () => {
      // Requirements: 2.1, 9.1

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true
      }));

      // Send ping
      act(() => {
        result.current.sendPing();
      });

      const emitCall = mockLobbySocket.emit.mock.calls.find(call => call[0] === 'ping_measurement');
      expect(emitCall).toBeDefined();

      const pingData = emitCall![1];

      // Simulate server response from lobby monitor namespace
      act(() => {
        vi.advanceTimersByTime(30); // 30ms latency
        triggerSocketEvent(mockLobbySocket, 'ping_response', {
          pingId: pingData.pingId,
          timestamp: pingData.timestamp,
          serverTimestamp: pingData.timestamp + 15
        });
        vi.advanceTimersByTime(500); // UI throttle
      });

      // Verify ping measurement result
      expect(result.current.currentPing).toBe(30);
    });
  });

  describe('Independent Latency Measurement', () => {
    it('should maintain ping measurement while browsing rooms via HTTP', () => {
      // Requirements: 2.1, 9.5 - lobby monitoring should work while user browses rooms via HTTP

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true
      }));

      // Simulate HTTP room browsing (this should not affect the lobby socket)
      // In real implementation, this would be HTTP requests to /api/rooms

      // Verify ping measurement still works
      act(() => {
        result.current.sendPing();
      });

      expect(mockLobbySocket.emit).toHaveBeenCalledWith('ping_measurement', expect.any(Object));

      // Simulate response
      const emitCall = mockLobbySocket.emit.mock.calls[mockLobbySocket.emit.mock.calls.length - 1];
      const pingData = emitCall[1];

      act(() => {
        vi.advanceTimersByTime(25);
        triggerSocketEvent(mockLobbySocket, 'ping_response', {
          pingId: pingData.pingId,
          timestamp: pingData.timestamp,
          serverTimestamp: pingData.timestamp + 10
        });
        vi.advanceTimersByTime(500);
      });

      expect(result.current.currentPing).toBe(25);
    });

    it('should handle continuous ping measurements efficiently', () => {
      // Requirements: 9.1 - independent latency measurement for lobby users

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true,
        interval: 500, // 500ms interval
        maxHistory: 10
      }));

      // Send multiple pings
      const latencies = [20, 25, 30, 22, 28];

      latencies.forEach((latency) => {
        act(() => {
          result.current.sendPing();
        });

        const emitCall = mockLobbySocket.emit.mock.calls[mockLobbySocket.emit.mock.calls.length - 1];
        const pingData = emitCall[1];

        act(() => {
          vi.advanceTimersByTime(latency);
          triggerSocketEvent(mockLobbySocket, 'ping_response', {
            pingId: pingData.pingId,
            timestamp: pingData.timestamp,
            serverTimestamp: pingData.timestamp + Math.floor(latency / 2)
          });
          vi.advanceTimersByTime(500); // UI throttle
        });
      });

      // Should have calculated average from measurements
      expect(result.current.averagePing).toBeGreaterThan(0);
      expect(result.current.currentPing).toBeGreaterThan(0);
    });
  });

  describe('Namespace Isolation', () => {
    it('should isolate lobby monitoring from room functionality', () => {
      // Requirements: 2.1, 9.5 - lobby monitoring should not interfere with room functionality

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true
      }));

      // Simulate room-related events that should not affect lobby monitoring
      // These events would normally come from room namespaces, not lobby monitor
      act(() => {
        triggerSocketEvent(mockLobbySocket, 'room_joined', { room: { id: 'test-room' } });
        triggerSocketEvent(mockLobbySocket, 'user_joined', { user: { id: 'user1' } });
        triggerSocketEvent(mockLobbySocket, 'note_played', { notes: ['C4'], userId: 'user1' });
        triggerSocketEvent(mockLobbySocket, 'metronome_tick', { bpm: 120 });
      });

      // Ping measurement should still work normally
      act(() => {
        result.current.sendPing();
      });

      expect(mockLobbySocket.emit).toHaveBeenCalledWith('ping_measurement', expect.any(Object));
      expect(result.current.isConnected).toBe(true);
    });

    it('should only handle ping-related events in lobby monitor namespace', () => {
      // Requirements: 2.1 - lobby should use only HTTP for room info, socket only for latency

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true
      }));

      // Send ping
      act(() => {
        result.current.sendPing();
      });

      // Verify only ping_measurement events are sent to lobby socket
      const emitCalls = mockLobbySocket.emit.mock.calls;
      const pingCalls = emitCalls.filter(call => call[0] === 'ping_measurement');
      const nonPingCalls = emitCalls.filter(call => call[0] !== 'ping_measurement');

      expect(pingCalls.length).toBeGreaterThan(0);
      expect(nonPingCalls.length).toBe(0);

      // Verify ping response handling
      const pingData = pingCalls[0][1];
      act(() => {
        vi.advanceTimersByTime(20);
        triggerSocketEvent(mockLobbySocket, 'ping_response', {
          pingId: pingData.pingId,
          timestamp: pingData.timestamp,
          serverTimestamp: pingData.timestamp + 10
        });
        vi.advanceTimersByTime(500);
      });

      expect(result.current.currentPing).toBe(20);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected disconnections from lobby', () => {
      // Requirements: 9.1 - latency monitoring should handle connection issues gracefully

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true
      }));

      expect(result.current.isConnected).toBe(true);

      // Simulate unexpected disconnection
      act(() => {
        mockLobbySocket.connected = false;
        triggerSocketEvent(mockLobbySocket, 'disconnect', 'transport close');
      });

      // Ping measurement should detect disconnection
      expect(result.current.isConnected).toBe(false);
      expect(result.current.currentPing).toBeNull();
      expect(result.current.averagePing).toBeNull();
    });

    it('should handle invalid ping responses gracefully', () => {
      // Requirements: 9.1 - robust latency measurement

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true
      }));

      // Send a valid ping
      act(() => {
        result.current.sendPing();
      });

      const initialPing = result.current.currentPing;

      // Send invalid responses
      act(() => {
        triggerSocketEvent(mockLobbySocket, 'ping_response', null);
        triggerSocketEvent(mockLobbySocket, 'ping_response', {});
        triggerSocketEvent(mockLobbySocket, 'ping_response', { pingId: 'wrong-id' });
        vi.advanceTimersByTime(500);
      });

      // Ping should remain unchanged
      expect(result.current.currentPing).toBe(initialPing);
    });
  });

  describe('Performance Requirements', () => {
    it('should handle high-frequency ping measurements efficiently', () => {
      // Requirements: 9.1, 9.5 - efficient latency monitoring that doesn't interfere with room functionality

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true,
        interval: 100, // 100ms interval
        maxHistory: 50
      }));

      // Send multiple pings rapidly
      const pingCount = 20;
      for (let i = 0; i < pingCount; i++) {
        act(() => {
          result.current.sendPing();
          vi.advanceTimersByTime(10); // Small delay between pings
        });
      }

      // Verify pings were sent (may include some from previous tests)
      const pingCalls = mockLobbySocket.emit.mock.calls.filter(call => call[0] === 'ping_measurement');
      expect(pingCalls.length).toBeGreaterThanOrEqual(pingCount);

      // Simulate responses for the last 20 pings
      const recentPingCalls = pingCalls.slice(-pingCount);
      recentPingCalls.forEach((call, index) => {
        const pingData = call[1];
        act(() => {
          vi.advanceTimersByTime(20 + index); // Varying latencies
          triggerSocketEvent(mockLobbySocket, 'ping_response', {
            pingId: pingData.pingId,
            timestamp: pingData.timestamp,
            serverTimestamp: pingData.timestamp + 10
          });
        });
      });

      // Wait for UI throttle
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should have calculated average from recent measurements
      expect(result.current.averagePing).toBeGreaterThan(0);
      expect(result.current.currentPing).toBeGreaterThan(0);
    });

    it('should throttle UI updates to prevent performance issues', () => {
      // Requirements: 9.5 - efficient monitoring that doesn't interfere with other functionality

      const { result } = renderHook(() => usePingMeasurement({
        socket: mockLobbySocket as unknown as Socket,
        enabled: true
      }));

      // Send ping
      act(() => {
        result.current.sendPing();
      });

      const emitCall = mockLobbySocket.emit.mock.calls.find(call => call[0] === 'ping_measurement');
      const pingData = emitCall![1];

      // Send response
      act(() => {
        vi.advanceTimersByTime(30);
        triggerSocketEvent(mockLobbySocket, 'ping_response', {
          pingId: pingData.pingId,
          timestamp: pingData.timestamp,
          serverTimestamp: pingData.timestamp + 15
        });
      });

      // Should not update immediately due to throttling
      expect(result.current.currentPing).toBeNull();

      // Should update after throttle period
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.currentPing).toBe(30);
    });
  });
});