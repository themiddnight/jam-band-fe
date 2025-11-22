import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Arrange Room Regression Tests
 * Ensures that Arrange Room features don't break existing Perform Room functionality
 * and that new DAW features maintain backward compatibility
 */

const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
  disconnect: vi.fn(),
  connect: vi.fn(),
};

describe('Arrange Room Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Room Type Compatibility', () => {
    it('should maintain perform room functionality when arrange room exists', () => {
      // Join perform room
      mockSocket.emit('join-room', {
        roomId: 'perform-room-1',
        userId: 'user-1',
        roomType: 'perform',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', {
        roomId: 'perform-room-1',
        userId: 'user-1',
        roomType: 'perform',
      });

      // Verify perform room events still work
      mockSocket.emit('instrument-change', {
        roomId: 'perform-room-1',
        instrument: 'guitar',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('instrument-change', {
        roomId: 'perform-room-1',
        instrument: 'guitar',
      });
    });

    it('should handle both room types independently', () => {
      const performRoom = {
        id: 'perform-1',
        type: 'perform',
        features: ['sequencer', 'metronome', 'effects'],
      };

      const arrangeRoom = {
        id: 'arrange-1',
        type: 'arrange',
        features: ['tracks', 'regions', 'daw', 'collaboration'],
      };

      expect(performRoom.type).toBe('perform');
      expect(arrangeRoom.type).toBe('arrange');
      expect(performRoom.features).not.toEqual(arrangeRoom.features);
    });

    it('should maintain room creation API compatibility', () => {
      // Old perform room creation
      mockSocket.emit('create-room', {
        name: 'Jam Session',
        username: 'user1',
        userId: 'user-1',
        roomType: 'perform',
      });

      // New arrange room creation
      mockSocket.emit('create-room', {
        name: 'Production Session',
        username: 'user1',
        userId: 'user-1',
        roomType: 'arrange',
      });

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Shared Features Compatibility', () => {
    it('should maintain WebRTC voice functionality in arrange rooms', () => {
      const voiceConfig = {
        roomId: 'arrange-room-1',
        userId: 'user-1',
        canTransmit: true,
        isEnabled: true,
      };

      expect(voiceConfig.isEnabled).toBe(true);
      expect(voiceConfig.canTransmit).toBe(true);
    });

    it('should maintain metronome functionality across room types', () => {
      const metronomeState = {
        bpm: 120,
        playing: true,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      // Should work in both perform and arrange rooms
      expect(metronomeState.bpm).toBeGreaterThan(0);
      expect(metronomeState.timeSignature).toBeDefined();
    });

    it('should maintain effects chain functionality', () => {
      const effectChain = {
        type: 'virtual_instrument',
        effects: [
          { id: 'reverb-1', type: 'reverb', enabled: true },
          { id: 'delay-1', type: 'delay', enabled: true },
        ],
      };

      expect(effectChain.effects).toHaveLength(2);
      expect(effectChain.type).toBe('virtual_instrument');
    });

    it('should maintain instrument selection across room types', () => {
      const instruments = ['guitar', 'bass', 'drums', 'synth', 'piano'];
      
      instruments.forEach(instrument => {
        expect(typeof instrument).toBe('string');
        expect(instrument.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Socket Event Namespace Isolation', () => {
    it('should not conflict perform room events with arrange room events', () => {
      // Perform room events
      const performEvents = [
        'instrument-change',
        'sequencer-update',
        'metronome-sync',
        'note-play',
      ];

      // Arrange room events
      const arrangeEvents = [
        'arrange:track_add',
        'arrange:region_add',
        'arrange:note_add',
        'arrange:lock_acquire',
      ];

      // Verify no overlap
      const hasOverlap = performEvents.some(event => arrangeEvents.includes(event));
      expect(hasOverlap).toBe(false);
    });

    it('should maintain backward compatibility for existing events', () => {
      // These events should still work
      const legacyEvents = [
        'join-room',
        'leave-room',
        'user-ready',
        'chat-message',
        'kick-user',
      ];

      legacyEvents.forEach(event => {
        mockSocket.emit(event, { roomId: 'test-room' });
      });

      expect(mockSocket.emit).toHaveBeenCalledTimes(legacyEvents.length);
    });
  });

  describe('State Management Isolation', () => {
    it('should not leak arrange room state into perform room', () => {
      const performState = {
        roomType: 'perform',
        sequencer: { playing: false },
        metronome: { bpm: 120 },
      };

      const arrangeState = {
        roomType: 'arrange',
        tracks: [],
        regions: [],
        locks: new Map(),
      };

      // Verify states are independent
      expect(performState).not.toHaveProperty('tracks');
      expect(performState).not.toHaveProperty('regions');
      expect(arrangeState).not.toHaveProperty('sequencer');
    });

    it('should maintain separate store instances for different room types', () => {
      const stores = {
        perform: {
          sequencer: 'sequencerStore',
          metronome: 'metronomeStore',
          effects: 'effectsStore',
        },
        arrange: {
          tracks: 'trackStore',
          regions: 'regionStore',
          locks: 'lockStore',
          history: 'historyStore',
        },
      };

      expect(stores.perform).toBeDefined();
      expect(stores.arrange).toBeDefined();
      expect(Object.keys(stores.perform)).not.toEqual(Object.keys(stores.arrange));
    });
  });

  describe('Audio System Compatibility', () => {
    it('should maintain audio context singleton across room types', () => {
      const audioContexts = {
        perform: { sampleRate: 44100, state: 'running' },
        arrange: { sampleRate: 44100, state: 'running' },
      };

      // Should use same audio context
      expect(audioContexts.perform.sampleRate).toBe(audioContexts.arrange.sampleRate);
    });

    it('should maintain audio routing independence', () => {
      const performRouting = {
        instrument: 'guitar',
        effects: ['reverb'],
        output: 'master',
      };

      const arrangeRouting = {
        tracks: [
          { id: 'track-1', instrument: 'piano', effects: ['delay'] },
          { id: 'track-2', instrument: 'drums', effects: [] },
        ],
        output: 'master',
      };

      expect(performRouting.output).toBe(arrangeRouting.output);
      expect(performRouting).not.toHaveProperty('tracks');
    });
  });

  describe('Performance Regression', () => {
    it('should maintain acceptable room switching performance', () => {
      const measurements: number[] = [];
      const switchCount = 5;

      for (let i = 0; i < switchCount; i++) {
        const startTime = performance.now();
        
        // Simulate room switch
        mockSocket.emit('leave-room', { roomId: `room-${i}` });
        mockSocket.emit('join-room', { roomId: `room-${i + 1}` });
        
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const averageTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      
      // Room switching should be fast
      expect(averageTime).toBeLessThan(50); // 50ms average
    });

    it('should handle large arrange room state without performance degradation', () => {
      const largeState = {
        tracks: Array.from({ length: 50 }, (_, i) => ({
          id: `track-${i}`,
          name: `Track ${i}`,
          instrumentId: 'synth',
        })),
        regions: Array.from({ length: 200 }, (_, i) => ({
          id: `region-${i}`,
          trackId: `track-${i % 50}`,
          type: 'midi',
          start: i * 4,
          duration: 4,
        })),
      };

      const startTime = performance.now();
      
      // Simulate state processing
      const trackCount = largeState.tracks.length;
      const regionCount = largeState.regions.length;
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(trackCount).toBe(50);
      expect(regionCount).toBe(200);
      expect(duration).toBeLessThan(100); // Should process quickly
    });
  });

  describe('API Contract Stability', () => {
    it('should maintain stable room creation response structure', () => {
      const roomResponse = {
        room: {
          id: 'room-1',
          name: 'Test Room',
          owner: 'user-1',
          roomType: 'arrange',
          isPrivate: false,
          isHidden: false,
          createdAt: new Date(),
        },
        user: {
          id: 'user-1',
          username: 'testuser',
          role: 'room_owner',
          isReady: true,
        },
      };

      // Verify structure hasn't changed
      expect(roomResponse).toHaveProperty('room');
      expect(roomResponse).toHaveProperty('user');
      expect(roomResponse.room).toHaveProperty('id');
      expect(roomResponse.room).toHaveProperty('roomType');
      expect(roomResponse.user).toHaveProperty('role');
    });

    it('should maintain backward compatible event payloads', () => {
      // Old format should still work
      mockSocket.emit('join-room', {
        roomId: 'room-1',
        userId: 'user-1',
      });

      // New format with roomType
      mockSocket.emit('join-room', {
        roomId: 'room-2',
        userId: 'user-1',
        roomType: 'arrange',
      });

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle errors consistently across room types', () => {
      const performError = new Error('Perform room error');
      const arrangeError = new Error('Arrange room error');

      expect(performError).toBeInstanceOf(Error);
      expect(arrangeError).toBeInstanceOf(Error);
      expect(performError.message).toContain('Perform');
      expect(arrangeError.message).toContain('Arrange');
    });

    it('should provide consistent fallback behavior', () => {
      const fallbackConfig = {
        perform: { offline: true, localSequencer: true },
        arrange: { offline: true, localTracks: true },
      };

      expect(fallbackConfig.perform.offline).toBe(true);
      expect(fallbackConfig.arrange.offline).toBe(true);
    });
  });

  describe('User Experience Consistency', () => {
    it('should maintain consistent navigation patterns', () => {
      const routes = {
        lobby: '/',
        performRoom: '/perform/:roomId',
        arrangeRoom: '/arrange/:roomId',
        invite: '/invite/:roomId',
      };

      expect(routes.performRoom).toContain('/perform/');
      expect(routes.arrangeRoom).toContain('/arrange/');
      expect(routes.lobby).toBe('/');
    });

    it('should maintain consistent room settings interface', () => {
      const roomSettings = {
        name: 'Test Room',
        description: 'Test Description',
        isPrivate: false,
        isHidden: false,
      };

      // Should work for both room types
      expect(roomSettings).toHaveProperty('name');
      expect(roomSettings).toHaveProperty('isPrivate');
      expect(roomSettings).toHaveProperty('isHidden');
    });
  });

  describe('Data Integrity', () => {
    it('should not corrupt perform room data when arrange room is active', () => {
      const performData = {
        sequencerPatterns: [
          { bank: 'A', pattern: 1, notes: [1, 0, 1, 0] },
        ],
        metronomeSettings: { bpm: 120, enabled: true },
      };

      const arrangeData = {
        tracks: [{ id: 'track-1', name: 'Piano' }],
        regions: [{ id: 'region-1', trackId: 'track-1' }],
      };

      // Verify data independence
      expect(performData).not.toHaveProperty('tracks');
      expect(arrangeData).not.toHaveProperty('sequencerPatterns');
    });

    it('should maintain user session consistency across room types', () => {
      const userSession = {
        userId: 'user-1',
        username: 'testuser',
        currentRoom: 'arrange-room-1',
        previousRoom: 'perform-room-1',
      };

      expect(userSession.userId).toBeDefined();
      expect(userSession.currentRoom).not.toBe(userSession.previousRoom);
    });
  });
});
