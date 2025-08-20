import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePingMeasurement } from '../usePingMeasurement'
import { createMockSocket, triggerSocketEvent, type MockSocket } from '@/test/mocks/socket'

describe('usePingMeasurement', () => {
  let mockSocket: MockSocket
  
  beforeEach(() => {
    vi.useFakeTimers()
    mockSocket = createMockSocket({ connected: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Basic Functionality', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: false
      }))

      expect(result.current.currentPing).toBeNull()
      expect(result.current.averagePing).toBeNull()
      expect(result.current.isConnected).toBe(true)
      expect(result.current.isEnabled).toBe(false)
    })

    it('should start ping measurement when enabled and connected', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true,
        interval: 1000
      }))

      expect(result.current.isConnected).toBe(true)
      expect(result.current.isEnabled).toBe(true)

      // Fast-forward to trigger initial ping
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('ping_measurement', expect.objectContaining({
        pingId: expect.stringMatching(/^ping_\d+_/),
        timestamp: expect.any(Number)
      }))
    })

    it('should handle ping responses correctly', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true
      }))

      // Simulate sending a ping
      act(() => {
        result.current.sendPing()
      })

      const emitCall = mockSocket.emit.mock.calls.find(call => call[0] === 'ping_measurement')
      expect(emitCall).toBeDefined()
      
      const pingData = emitCall![1]
      const sendTime = pingData.timestamp

      // Simulate ping response after 50ms
      act(() => {
        vi.advanceTimersByTime(50)
        triggerSocketEvent(mockSocket, 'ping_response', {
          pingId: pingData.pingId,
          timestamp: sendTime,
          serverTimestamp: sendTime + 25
        })
      })

      // Wait for UI throttle
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current.currentPing).toBe(50)
    })

    it('should calculate average ping from multiple measurements', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true,
        maxHistory: 3
      }))

      // Send multiple pings and responses
      const pings = [30, 40, 50]
      
      pings.forEach((latency, index) => {
        act(() => {
          result.current.sendPing()
        })

        const emitCall = mockSocket.emit.mock.calls[mockSocket.emit.mock.calls.length - 1]
        const pingData = emitCall[1]

        act(() => {
          vi.advanceTimersByTime(latency)
          triggerSocketEvent(mockSocket, 'ping_response', {
            pingId: pingData.pingId,
            timestamp: pingData.timestamp
          })
          vi.advanceTimersByTime(500) // UI throttle
        })
      })

      // Average should be (30 + 40 + 50) / 3 = 40
      expect(result.current.averagePing).toBe(40)
    })
  })

  describe('Connection State Management', () => {
    it('should handle socket connection events', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true
      }))

      expect(result.current.isConnected).toBe(true)

      // Simulate disconnect
      act(() => {
        mockSocket.connected = false
        triggerSocketEvent(mockSocket, 'disconnect', 'transport close')
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.currentPing).toBeNull()
      expect(result.current.averagePing).toBeNull()
    })

    it('should start measurement after connection', () => {
      mockSocket.connected = false
      
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true
      }))

      expect(result.current.isConnected).toBe(false)
      expect(mockSocket.emit).not.toHaveBeenCalledWith('ping_measurement', expect.any(Object))

      // Simulate connection
      act(() => {
        mockSocket.connected = true
        triggerSocketEvent(mockSocket, 'connect')
        vi.advanceTimersByTime(1000) // Initial delay
      })

      expect(result.current.isConnected).toBe(true)
      expect(mockSocket.emit).toHaveBeenCalledWith('ping_measurement', expect.any(Object))
    })
  })

  describe('Error Handling', () => {
    it('should ignore invalid ping responses', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true
      }))

      // Send a ping
      act(() => {
        result.current.sendPing()
      })

      const initialPing = result.current.currentPing

      // Send invalid responses
      act(() => {
        triggerSocketEvent(mockSocket, 'ping_response', null)
        triggerSocketEvent(mockSocket, 'ping_response', {})
        triggerSocketEvent(mockSocket, 'ping_response', { pingId: 'wrong-id' })
        vi.advanceTimersByTime(500)
      })

      // Ping should remain unchanged
      expect(result.current.currentPing).toBe(initialPing)
    })

    it('should clean up old pending pings', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true
      }))

      // Send multiple pings
      act(() => {
        result.current.sendPing()
        vi.advanceTimersByTime(1000)
        result.current.sendPing()
        vi.advanceTimersByTime(1000)
        result.current.sendPing()
      })

      // Fast-forward 35 seconds to trigger cleanup
      act(() => {
        vi.advanceTimersByTime(35000)
        result.current.sendPing()
      })

      // Should still work after cleanup
      expect(mockSocket.emit).toHaveBeenCalledWith('ping_measurement', expect.any(Object))
    })
  })

  describe('Performance Optimizations', () => {
    it('should throttle UI updates', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true
      }))

      // Send ping
      act(() => {
        result.current.sendPing()
      })

      const emitCall = mockSocket.emit.mock.calls.find(call => call[0] === 'ping_measurement')
      const pingData = emitCall![1]
      const sendTime = pingData.timestamp

      // Send response after some time
      act(() => {
        vi.advanceTimersByTime(30) // Simulate 30ms latency
        triggerSocketEvent(mockSocket, 'ping_response', {
          pingId: pingData.pingId,
          timestamp: sendTime,
          serverTimestamp: sendTime + 15
        })
      })

      // Should not update immediately due to throttling
      expect(result.current.currentPing).toBeNull()

      // Should update after throttle period
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current.currentPing).toBe(30)
    })

    it('should limit history size', () => {
      const maxHistory = 3
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true,
        maxHistory
      }))

      // Send more pings than max history
      const pings = [10, 20, 30, 40, 50]
      
      pings.forEach((latency) => {
        act(() => {
          result.current.sendPing()
        })

        const emitCall = mockSocket.emit.mock.calls[mockSocket.emit.mock.calls.length - 1]
        const pingData = emitCall[1]

        act(() => {
          vi.advanceTimersByTime(latency)
          triggerSocketEvent(mockSocket, 'ping_response', {
            pingId: pingData.pingId,
            timestamp: pingData.timestamp
          })
          vi.advanceTimersByTime(500)
        })
      })

      // Average should only include last 3 measurements: (30 + 40 + 50) / 3 = 40
      expect(result.current.averagePing).toBe(40)
    })
  })

  describe('Lobby Isolation Requirements', () => {
    it('should work independently of room connections', () => {
      const { result } = renderHook(() => usePingMeasurement({
        socket: mockSocket,
        enabled: true
      }))

      // Verify ping measurement works
      act(() => {
        result.current.sendPing()
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('ping_measurement', expect.any(Object))

      // Simulate room-related events that should not affect ping measurement
      act(() => {
        triggerSocketEvent(mockSocket, 'room_joined', { room: { id: 'test' } })
        triggerSocketEvent(mockSocket, 'user_joined', { user: { id: 'user1' } })
        triggerSocketEvent(mockSocket, 'note_played', { notes: ['C4'] })
      })

      // Ping measurement should still work
      act(() => {
        result.current.sendPing()
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('ping_measurement', expect.any(Object))
    })

    it('should handle namespace-specific socket connections', () => {
      // Test with lobby monitor namespace socket
      const lobbySocket = createMockSocket({ connected: true, id: 'lobby-socket' })
      
      const { result } = renderHook(() => usePingMeasurement({
        socket: lobbySocket,
        enabled: true
      }))

      expect(result.current.isConnected).toBe(true)

      // Send ping measurement
      act(() => {
        result.current.sendPing()
      })

      expect(lobbySocket.emit).toHaveBeenCalledWith('ping_measurement', expect.objectContaining({
        pingId: expect.stringMatching(/^ping_\d+_/),
        timestamp: expect.any(Number)
      }))

      // Verify response handling
      const emitCall = lobbySocket.emit.mock.calls.find(call => call[0] === 'ping_measurement')
      const pingData = emitCall![1]

      act(() => {
        vi.advanceTimersByTime(25)
        triggerSocketEvent(lobbySocket, 'ping_response', {
          pingId: pingData.pingId,
          timestamp: pingData.timestamp,
          serverTimestamp: pingData.timestamp + 10
        })
        vi.advanceTimersByTime(500)
      })

      expect(result.current.currentPing).toBe(25)
    })
  })
})