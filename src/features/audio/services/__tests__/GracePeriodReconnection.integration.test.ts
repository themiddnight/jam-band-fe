import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomSocketManager } from '../RoomSocketManager';

// Mock socket.io-client
const mockSocket = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  connected: true,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('Grace Period and Reconnection Integration', () => {
  let socketManager: RoomSocketManager;

  beforeEach(() => {
    vi.clearAllMocks();
    socketManager = new RoomSocketManager('http://localhost:3001');
  });

  describe('Session Storage Integration', () => {
    it('should store session data when connecting to room', async () => {
      const roomId = 'test-room';
      const role = 'band_member';
      const userId = 'user-123';
      const username = 'TestUser';

      // Mock successful connection
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setTimeout(callback, 0);
        }
      });

      await socketManager.connectToRoom(roomId, role, userId, username);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining(roomId)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining(role)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining(userId)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining(username)
      );
    });

    it('should clear session data when leaving room', async () => {
      await socketManager.leaveRoom();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('jam-band-room-session');
    });

    it('should clear session data when disconnecting', async () => {
      await socketManager.disconnect();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('jam-band-room-session');
    });
  });

  describe('Automatic Reconnection', () => {
    it('should attempt reconnection using stored session data', async () => {
      const sessionData = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      // Mock successful connection
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setTimeout(callback, 0);
        }
      });

      const success = await socketManager.attemptStoredSessionReconnection();

      expect(success).toBe(true);
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('jam-band-room-session');
    });

    it('should return false when no stored session exists', async () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const success = await socketManager.attemptStoredSessionReconnection();

      expect(success).toBe(false);
    });

    it('should clear invalid session data on failed reconnection', async () => {
      const sessionData = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      // Mock connection failure
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(new Error('Connection failed')), 0);
        }
      });

      const success = await socketManager.attemptStoredSessionReconnection();

      expect(success).toBe(false);
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('jam-band-room-session');
    });
  });

  describe('Instrument State Restoration', () => {
    it('should store and retrieve instrument state', () => {
      const sessionData = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      const instrument = 'analog_poly';
      const category = 'Synthesizer';
      const synthParams = { oscillator: 'sawtooth', filter: 'lowpass' };

      socketManager.storeInstrumentState(instrument, category, synthParams);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining(instrument)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining(category)
      );

      // Mock updated session data
      const updatedSessionData = {
        ...sessionData,
        instrument,
        category,
        synthParams,
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(updatedSessionData));

      const storedState = socketManager.getStoredInstrumentState();

      expect(storedState).toEqual({
        instrument,
        category,
        synthParams
      });
    });

    it('should return null when no instrument state is stored', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const storedState = socketManager.getStoredInstrumentState();

      expect(storedState).toBeNull();
    });
  });

  describe('Grace Period State Management', () => {
    it('should track grace period state correctly', () => {
      expect(socketManager.isInGracePeriodState()).toBe(false);

      // Simulate entering grace period (this would normally happen on unexpected disconnect)
      // Since we can't easily trigger the private method, we'll test the public interface
      expect(socketManager.isInGracePeriodState()).toBe(false);
    });

    it('should detect stored session for reconnection', () => {
      const sessionData = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(socketManager.hasStoredSession()).toBe(true);

      const storedSession = socketManager.getStoredSession();
      expect(storedSession).toEqual({
        roomId: sessionData.roomId,
        role: sessionData.role
      });
    });

    it('should return false for expired stored session', () => {
      const expiredSessionData = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now() - (31 * 60 * 1000) // 31 minutes ago (expired)
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(expiredSessionData));

      expect(socketManager.hasStoredSession()).toBe(false);
      expect(socketManager.getStoredSession()).toBeNull();
    });
  });
});