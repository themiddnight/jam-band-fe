import { vi } from 'vitest'
import type { Socket } from 'socket.io-client'

export interface MockSocket extends Partial<Socket> {
  id: string
  connected: boolean
  emit: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  onAny: ReturnType<typeof vi.fn>
  listeners: Map<string, Function[]>
}

export function createMockSocket(options: { connected?: boolean; id?: string } = {}): MockSocket {
  const listeners = new Map<string, Function[]>()
  
  const mockSocket: MockSocket = {
    id: options.id || 'mock-socket-id',
    connected: options.connected ?? true,
    listeners,
    emit: vi.fn(),
    on: vi.fn((event: string, callback: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(callback)
    }),
    off: vi.fn((event: string, callback?: Function) => {
      if (callback) {
        const eventListeners = listeners.get(event) || []
        const index = eventListeners.indexOf(callback)
        if (index > -1) {
          eventListeners.splice(index, 1)
        }
      } else {
        listeners.delete(event)
      }
    }),
    once: vi.fn((event: string, callback: Function) => {
      const wrappedCallback = (...args: any[]) => {
        callback(...args)
        mockSocket.off(event, wrappedCallback)
      }
      mockSocket.on(event, wrappedCallback)
    }),
    removeAllListeners: vi.fn(() => {
      listeners.clear()
    }),
    disconnect: vi.fn(() => {
      mockSocket.connected = false
      // Trigger disconnect event
      const disconnectListeners = listeners.get('disconnect') || []
      disconnectListeners.forEach(callback => callback('client disconnect'))
    }),
    connect: vi.fn(() => {
      mockSocket.connected = true
      // Trigger connect event
      const connectListeners = listeners.get('connect') || []
      connectListeners.forEach(callback => callback())
    }),
    onAny: vi.fn(),
  }

  return mockSocket
}

export function triggerSocketEvent(socket: MockSocket, event: string, data?: any) {
  const eventListeners = socket.listeners.get(event) || []
  eventListeners.forEach(callback => callback(data))
}

export function createMockSocketManager() {
  const mockSockets = new Map<string, MockSocket>()
  
  return {
    createSocket: (namespace: string, options?: { connected?: boolean }) => {
      const socket = createMockSocket(options)
      mockSockets.set(namespace, socket)
      return socket
    },
    getSocket: (namespace: string) => mockSockets.get(namespace),
    getAllSockets: () => Array.from(mockSockets.values()),
    clear: () => mockSockets.clear(),
  }
}

// Mock socket.io-client
export const mockIo = vi.fn((url: string) => {
  return createMockSocket({ connected: false })
})

// Mock the entire socket.io-client module
vi.mock('socket.io-client', async () => {
  const actual = await vi.importActual('socket.io-client')
  return {
    ...actual,
    io: mockIo,
  }
})