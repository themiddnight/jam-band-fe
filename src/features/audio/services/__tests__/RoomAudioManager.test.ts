import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomAudioManager, type RoomUser } from '../RoomAudioManager';
import { InstrumentCategory } from '@/shared/constants/instruments';

// Mock AudioContext
const mockAudioContext = {
  state: 'running',
  sampleRate: 48000,
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

// Mock AudioContextManager
vi.mock('../../constants/audioConfig', () => ({
  AudioContextManager: {
    getInstrumentContext: vi.fn(() => mockAudioContext),
  },
}));

// Mock instrument manager
const mockInstrumentManager = {
  preloadInstruments: vi.fn().mockResolvedValue(undefined),
  cleanupRemoteUser: vi.fn(),
};

// Mock fallback utility
vi.mock('@/shared/utils/webkitCompat', () => ({
  findNextCompatibleInstrument: vi.fn().mockResolvedValue('acoustic_grand_piano'),
}));

describe('RoomAudioManager', () => {
  let roomAudioManager: RoomAudioManager;
  let mockRoomUsers: RoomUser[];

  beforeEach(() => {
    vi.clearAllMocks();
    roomAudioManager = new RoomAudioManager(mockInstrumentManager);
    
    mockRoomUsers = [
      {
        id: 'user1',
        username: 'User 1',
        currentInstrument: 'acoustic_grand_piano',
        currentCategory: InstrumentCategory.Melodic,
      },
      {
        id: 'user2',
        username: 'User 2',
        currentInstrument: 'analog_poly',
        currentCategory: InstrumentCategory.Synthesizer,
      },
      {
        id: 'user3',
        username: 'User 3',
        // No instrument set
      },
    ];
  });

  // Cleanup is handled manually in each test group as needed

  describe('initialization', () => {
    afterEach(() => {
      roomAudioManager.cleanup();
    });

    it('should initialize audio context and preload instruments for room join - Requirement 10.1, 10.2', async () => {
      await roomAudioManager.initializeForRoom(mockRoomUsers);

      expect(roomAudioManager.isAudioContextReady()).toBe(true);
      expect(mockInstrumentManager.preloadInstruments).toHaveBeenCalledWith([
        {
          userId: 'user1',
          username: 'User 1',
          instrument: 'acoustic_grand_piano',
          category: InstrumentCategory.Melodic,
        },
        {
          userId: 'user2',
          username: 'User 2',
          instrument: 'analog_poly',
          category: InstrumentCategory.Synthesizer,
        },
      ]);
    });

    it('should handle audio context suspension and resume - Requirement 10.7', async () => {
      mockAudioContext.state = 'suspended';
      
      await roomAudioManager.initializeForRoom(mockRoomUsers);

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should skip users without instruments', async () => {
      const usersWithoutInstruments: RoomUser[] = [
        { id: 'user1', username: 'User 1' },
        { id: 'user2', username: 'User 2' },
      ];

      await roomAudioManager.initializeForRoom(usersWithoutInstruments);

      expect(mockInstrumentManager.preloadInstruments).not.toHaveBeenCalled();
    });
  });

  describe('real-time instrument preloading', () => {
    beforeEach(async () => {
      await roomAudioManager.initializeForRoom(mockRoomUsers);
      vi.clearAllMocks();
    });

    afterEach(() => {
      roomAudioManager.cleanup();
    });

    it('should preload new instrument when user changes - Requirement 10.3', async () => {
      await roomAudioManager.handleUserInstrumentChange(
        'user4',
        'User 4',
        'electric_guitar_clean',
        InstrumentCategory.Melodic
      );

      expect(mockInstrumentManager.preloadInstruments).toHaveBeenCalledWith([
        {
          userId: 'user4',
          username: 'User 4',
          instrument: 'electric_guitar_clean',
          category: InstrumentCategory.Melodic,
        },
      ]);
    });

    it('should skip preloading if instrument already preloaded', async () => {
      // First call should preload (user1 with acoustic_grand_piano was already preloaded during initialization)
      // So let's try with a different instrument first
      await roomAudioManager.handleUserInstrumentChange(
        'user1',
        'User 1',
        'electric_guitar_clean',
        InstrumentCategory.Melodic
      );

      expect(mockInstrumentManager.preloadInstruments).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Second call with same instrument should skip
      await roomAudioManager.handleUserInstrumentChange(
        'user1',
        'User 1',
        'electric_guitar_clean',
        InstrumentCategory.Melodic
      );

      expect(mockInstrumentManager.preloadInstruments).not.toHaveBeenCalled();
    });

    it('should handle preloading when audio context not initialized', async () => {
      const uninitializedManager = new RoomAudioManager(mockInstrumentManager);
      
      await uninitializedManager.handleUserInstrumentChange(
        'user1',
        'User 1',
        'acoustic_grand_piano',
        InstrumentCategory.Melodic
      );

      expect(mockInstrumentManager.preloadInstruments).not.toHaveBeenCalled();
      uninitializedManager.cleanup();
    });
  });

  describe('user cleanup', () => {
    beforeEach(async () => {
      await roomAudioManager.initializeForRoom(mockRoomUsers);
      vi.clearAllMocks();
    });

    afterEach(() => {
      roomAudioManager.cleanup();
    });

    it('should clean up user instruments when user leaves - Requirement 10.4', () => {
      roomAudioManager.handleUserLeft('user1');

      expect(mockInstrumentManager.cleanupRemoteUser).toHaveBeenCalledWith('user1');
    });

    it('should remove user from tracking', async () => {
      // First, add a user instrument change to track them
      await roomAudioManager.handleUserInstrumentChange(
        'user4',
        'User 4',
        'electric_guitar_clean',
        InstrumentCategory.Melodic
      );

      expect(roomAudioManager.getRoomUsersCount()).toBe(4); // Original 3 users + 1 new user

      roomAudioManager.handleUserLeft('user4');

      // User should be removed from tracking
      expect(mockInstrumentManager.cleanupRemoteUser).toHaveBeenCalledWith('user4');
    });
  });

  describe('fallback handling', () => {
    beforeEach(async () => {
      await roomAudioManager.initializeForRoom([]);
    });

    afterEach(() => {
      roomAudioManager.cleanup();
    });

    it('should handle instrument loading failures with fallback - Requirement 10.5', async () => {
      // Mock preloadInstruments to fail for batch, then fail for original, then succeed for fallback
      mockInstrumentManager.preloadInstruments
        .mockRejectedValueOnce(new Error('Batch preload failed')) // First call (batch)
        .mockRejectedValueOnce(new Error('Failed to load instrument')) // Second call (original instrument)
        .mockResolvedValueOnce(undefined); // Third call (fallback instrument)

      await roomAudioManager.handleUserInstrumentChange(
        'user1',
        'User 1',
        'failing_instrument',
        InstrumentCategory.Melodic
      );

      // Should have been called 3 times - batch, original, fallback
      expect(mockInstrumentManager.preloadInstruments).toHaveBeenCalledTimes(3);
      
      // Third call should be with fallback instrument
      expect(mockInstrumentManager.preloadInstruments).toHaveBeenLastCalledWith([
        {
          userId: 'user1',
          username: 'User 1',
          instrument: 'acoustic_grand_piano', // fallback
          category: InstrumentCategory.Melodic,
        },
      ]);
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources - Requirement 10.4', async () => {
      // Reset mock state to ensure clean test
      mockAudioContext.state = 'running';
      vi.clearAllMocks();
      
      // Create a fresh instance to avoid interference from global beforeEach
      const testManager = new RoomAudioManager(mockInstrumentManager);
      
      // Initialize first
      await testManager.initializeForRoom(mockRoomUsers);
      
      // Verify it's initialized
      expect(testManager.isAudioContextReady()).toBe(true);
      expect(testManager.getRoomUsersCount()).toBe(3);
      expect(testManager.getPreloadedInstrumentsCount()).toBe(2);

      // Now test cleanup
      testManager.cleanup();

      expect(testManager.isAudioContextReady()).toBe(false);
      expect(testManager.getRoomUsersCount()).toBe(0);
      expect(testManager.getPreloadedInstrumentsCount()).toBe(0);
    });
  });

  describe('audio context management', () => {
    beforeEach(async () => {
      // Reset mock audio context state
      mockAudioContext.state = 'running';
      await roomAudioManager.initializeForRoom(mockRoomUsers);
    });

    afterEach(() => {
      roomAudioManager.cleanup();
    });

    it('should suspend and resume audio context', async () => {
      // Mock the audio context state for suspend/resume
      mockAudioContext.state = 'running';
      await roomAudioManager.suspend();
      expect(mockAudioContext.suspend).toHaveBeenCalled();

      mockAudioContext.state = 'suspended';
      await roomAudioManager.resume();
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should provide audio context status', () => {
      // The beforeEach already initialized the room audio manager
      expect(roomAudioManager.isAudioContextReady()).toBe(true);
      expect(roomAudioManager.getAudioContext()).toBe(mockAudioContext);
    });
  });

  describe('monitoring', () => {
    beforeEach(async () => {
      await roomAudioManager.initializeForRoom(mockRoomUsers);
    });

    afterEach(() => {
      roomAudioManager.cleanup();
    });

    it('should provide monitoring information', () => {
      expect(roomAudioManager.getRoomUsersCount()).toBe(3);
      expect(roomAudioManager.getPreloadedInstrumentsCount()).toBe(2); // Only users with instruments
    });
  });
});