import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionStorageManager } from '../SessionStorageManager';

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

describe('SessionStorageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeRoomSession', () => {
    it('should store room session data with timestamp', () => {
      const sessionData = {
        roomId: 'test-room',
        role: 'band_member' as const,
        userId: 'user-123',
        username: 'TestUser'
      };

      SessionStorageManager.storeRoomSession(sessionData);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining('"roomId":"test-room"')
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining('"timestamp":')
      );
    });

    it('should handle storage errors gracefully', () => {
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const sessionData = {
        roomId: 'test-room',
        role: 'audience' as const,
        userId: 'user-123',
        username: 'TestUser'
      };

      // Should not throw
      expect(() => SessionStorageManager.storeRoomSession(sessionData)).not.toThrow();
    });
  });

  describe('getRoomSession', () => {
    it('should retrieve valid session data', () => {
      const sessionData = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = SessionStorageManager.getRoomSession();

      expect(result).toEqual(sessionData);
    });

    it('should return null for expired session', () => {
      const expiredSessionData = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now() - (31 * 60 * 1000) // 31 minutes ago (expired)
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(expiredSessionData));

      const result = SessionStorageManager.getRoomSession();

      expect(result).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('jam-band-room-session');
    });

    it('should return null when no session exists', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const result = SessionStorageManager.getRoomSession();

      expect(result).toBeNull();
    });

    it('should handle corrupted session data', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid-json');

      const result = SessionStorageManager.getRoomSession();

      expect(result).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('jam-band-room-session');
    });
  });

  describe('updateRoomSession', () => {
    it('should update existing session with new data', () => {
      const existingSession = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(existingSession));

      const updates = {
        instrument: 'piano',
        category: 'Keyboard'
      };

      SessionStorageManager.updateRoomSession(updates);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining('"instrument":"piano"')
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining('"category":"Keyboard"')
      );
    });

    it('should handle missing session gracefully', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const updates = {
        instrument: 'piano',
        category: 'Keyboard'
      };

      // Should not throw
      expect(() => SessionStorageManager.updateRoomSession(updates)).not.toThrow();
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('storeInstrumentState', () => {
    it('should store instrument state in existing session', () => {
      const existingSession = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(existingSession));

      const synthParams = { oscillator: 'sawtooth', filter: 'lowpass' };
      SessionStorageManager.storeInstrumentState('analog_poly', 'Synthesizer', synthParams);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining('"instrument":"analog_poly"')
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jam-band-room-session',
        expect.stringContaining('"synthParams":')
      );
    });
  });

  describe('getStoredInstrumentState', () => {
    it('should return stored instrument state', () => {
      const sessionWithInstrument = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        instrument: 'analog_poly',
        category: 'Synthesizer',
        synthParams: { oscillator: 'sawtooth' },
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionWithInstrument));

      const result = SessionStorageManager.getStoredInstrumentState();

      expect(result).toEqual({
        instrument: 'analog_poly',
        category: 'Synthesizer',
        synthParams: { oscillator: 'sawtooth' }
      });
    });

    it('should return null when no session exists', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const result = SessionStorageManager.getStoredInstrumentState();

      expect(result).toBeNull();
    });
  });

  describe('hasValidSession', () => {
    it('should return true for valid session', () => {
      const validSession = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(validSession));

      const result = SessionStorageManager.hasValidSession();

      expect(result).toBe(true);
    });

    it('should return false for expired session', () => {
      const expiredSession = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now() - (31 * 60 * 1000) // 31 minutes ago
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(expiredSession));

      const result = SessionStorageManager.hasValidSession();

      expect(result).toBe(false);
    });

    it('should return false when no session exists', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const result = SessionStorageManager.hasValidSession();

      expect(result).toBe(false);
    });
  });

  describe('clearRoomSession', () => {
    it('should remove session from storage', () => {
      SessionStorageManager.clearRoomSession();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('jam-band-room-session');
    });
  });

  describe('isLikelyPageRefresh', () => {
    it('should return true when valid session exists', () => {
      const validSession = {
        roomId: 'test-room',
        role: 'band_member',
        userId: 'user-123',
        username: 'TestUser',
        timestamp: Date.now()
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(validSession));

      const result = SessionStorageManager.isLikelyPageRefresh();

      expect(result).toBe(true);
    });

    it('should return false when no session exists', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const result = SessionStorageManager.isLikelyPageRefresh();

      expect(result).toBe(false);
    });
  });
});