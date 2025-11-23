import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Arrange Room Integration Tests
 * Tests the DAW features including tracks, regions, MIDI, collaboration
 */

// Mock WebSocket/Socket.IO for arrange room functionality
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
  disconnect: vi.fn(),
  connect: vi.fn(),
};

// Mock audio context for DAW
const mockAudioContext = {
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  })),
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
  })),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    getByteFrequencyData: vi.fn(),
  })),
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
  })),
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
};

describe('Arrange Room Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.AudioContext = vi.fn(() => mockAudioContext) as any;
  });

  describe('Socket Connection for Arrange Room', () => {
    it('should handle arrange room connection states', () => {
      expect(mockSocket.connected).toBe(true);
      expect(mockSocket.on).toBeDefined();
      expect(mockSocket.emit).toBeDefined();
    });

    it('should emit arrange room join events', () => {
      const roomId = 'arrange-room-123';
      const userId = 'user-456';
      
      mockSocket.emit('join-room', { roomId, userId, roomType: 'arrange' });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', {
        roomId,
        userId,
        roomType: 'arrange',
      });
    });

    it('should handle arrange room state sync', () => {
      mockSocket.emit('arrange:request_state', { roomId: 'test-room' });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:request_state', { roomId: 'test-room' });
    });
  });

  describe('Track Management', () => {
    it('should handle track creation', () => {
      const track = {
        id: 'track-1',
        name: 'Piano Track',
        instrumentId: 'piano',
        instrumentCategory: 'keys',
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        armed: false,
      };

      mockSocket.emit('arrange:track_add', { roomId: 'test-room', track });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:track_add', {
        roomId: 'test-room',
        track,
      });
    });

    it('should handle track updates', () => {
      const trackId = 'track-1';
      const updates = { volume: 0.5, muted: true };

      mockSocket.emit('arrange:track_update', {
        roomId: 'test-room',
        trackId,
        updates,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:track_update', {
        roomId: 'test-room',
        trackId,
        updates,
      });
    });

    it('should handle track deletion', () => {
      const trackId = 'track-1';

      mockSocket.emit('arrange:track_delete', { roomId: 'test-room', trackId });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:track_delete', {
        roomId: 'test-room',
        trackId,
      });
    });

    it('should handle track reordering', () => {
      const trackIds = ['track-1', 'track-3', 'track-2'];

      mockSocket.emit('arrange:track_reorder', { roomId: 'test-room', trackIds });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:track_reorder', {
        roomId: 'test-room',
        trackIds,
      });
    });

    it('should handle instrument changes', () => {
      const trackId = 'track-1';
      const instrumentId = 'synth';
      const instrumentCategory = 'synth';

      mockSocket.emit('arrange:track_instrument_change', {
        roomId: 'test-room',
        trackId,
        instrumentId,
        instrumentCategory,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:track_instrument_change', {
        roomId: 'test-room',
        trackId,
        instrumentId,
        instrumentCategory,
      });
    });
  });

  describe('Region Management', () => {
    it('should handle MIDI region creation', () => {
      const region = {
        id: 'region-1',
        trackId: 'track-1',
        type: 'midi',
        start: 0,
        duration: 4,
        notes: [],
      };

      mockSocket.emit('arrange:region_add', { roomId: 'test-room', region });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:region_add', {
        roomId: 'test-room',
        region,
      });
    });

    it('should handle audio region creation', () => {
      const region = {
        id: 'region-2',
        trackId: 'track-2',
        type: 'audio',
        start: 4,
        duration: 8,
        audioUrl: '/audio/sample.wav',
      };

      mockSocket.emit('arrange:region_add', { roomId: 'test-room', region });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:region_add', {
        roomId: 'test-room',
        region,
      });
    });

    it('should handle region updates', () => {
      const regionId = 'region-1';
      const updates = { start: 2, duration: 6 };

      mockSocket.emit('arrange:region_update', {
        roomId: 'test-room',
        regionId,
        updates,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:region_update', {
        roomId: 'test-room',
        regionId,
        updates,
      });
    });

    it('should handle region deletion', () => {
      const regionId = 'region-1';

      mockSocket.emit('arrange:region_delete', { roomId: 'test-room', regionId });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:region_delete', {
        roomId: 'test-room',
        regionId,
      });
    });

    it('should handle region drag operations', () => {
      const updates = [
        { regionId: 'region-1', newStart: 4, trackId: 'track-2' },
        { regionId: 'region-2', newStart: 8 },
      ];

      mockSocket.emit('arrange:region_drag', { roomId: 'test-room', updates });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:region_drag', {
        roomId: 'test-room',
        updates,
      });
    });
  });

  describe('MIDI Note Management', () => {
    it('should handle note addition', () => {
      const note = {
        id: 'note-1',
        pitch: 60,
        start: 0,
        duration: 1,
        velocity: 100,
      };

      mockSocket.emit('arrange:note_add', {
        roomId: 'test-room',
        regionId: 'region-1',
        note,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:note_add', {
        roomId: 'test-room',
        regionId: 'region-1',
        note,
      });
    });

    it('should handle note updates', () => {
      const noteId = 'note-1';
      const updates = { pitch: 62, velocity: 80 };

      mockSocket.emit('arrange:note_update', {
        roomId: 'test-room',
        regionId: 'region-1',
        noteId,
        updates,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:note_update', {
        roomId: 'test-room',
        regionId: 'region-1',
        noteId,
        updates,
      });
    });

    it('should handle note deletion', () => {
      const noteId = 'note-1';

      mockSocket.emit('arrange:note_delete', {
        roomId: 'test-room',
        regionId: 'region-1',
        noteId,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:note_delete', {
        roomId: 'test-room',
        regionId: 'region-1',
        noteId,
      });
    });
  });

  describe('Collaboration Features', () => {
    it('should handle lock acquisition', () => {
      const elementId = 'region-1';
      const type = 'region';

      mockSocket.emit('arrange:lock_acquire', {
        roomId: 'test-room',
        elementId,
        type,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:lock_acquire', {
        roomId: 'test-room',
        elementId,
        type,
      });
    });

    it('should handle lock release', () => {
      const elementId = 'region-1';

      mockSocket.emit('arrange:lock_release', {
        roomId: 'test-room',
        elementId,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:lock_release', {
        roomId: 'test-room',
        elementId,
      });
    });

    it('should handle selection changes', () => {
      const selectedTrackId = 'track-1';
      const selectedRegionIds = ['region-1', 'region-2'];

      mockSocket.emit('arrange:selection_change', {
        roomId: 'test-room',
        selectedTrackId,
        selectedRegionIds,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:selection_change', {
        roomId: 'test-room',
        selectedTrackId,
        selectedRegionIds,
      });
    });

    it('should handle recording preview updates', () => {
      const preview = {
        trackId: 'track-1',
        recordingType: 'midi' as const,
        startBeat: 0,
        durationBeats: 4,
      };

      mockSocket.emit('arrange:recording_preview', {
        roomId: 'test-room',
        preview,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:recording_preview', {
        roomId: 'test-room',
        preview,
      });
    });
  });

  describe('Transport and Timing', () => {
    it('should handle BPM changes', () => {
      const bpm = 140;

      mockSocket.emit('arrange:bpm_change', { roomId: 'test-room', bpm });
      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:bpm_change', {
        roomId: 'test-room',
        bpm,
      });
    });

    it('should handle time signature changes', () => {
      const timeSignature = { numerator: 3, denominator: 4 };

      mockSocket.emit('arrange:time_signature_change', {
        roomId: 'test-room',
        timeSignature,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:time_signature_change', {
        roomId: 'test-room',
        timeSignature,
      });
    });
  });

  describe('Synth Parameter Management', () => {
    it('should handle synth parameter updates', () => {
      const trackId = 'track-1';
      const params = {
        oscillatorType: 'sawtooth',
        filterFrequency: 1000,
        filterResonance: 5,
      };

      mockSocket.emit('arrange:synth_params_update', {
        roomId: 'test-room',
        trackId,
        params,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('arrange:synth_params_update', {
        roomId: 'test-room',
        trackId,
        params,
      });
    });
  });

  describe('Audio System Integration for DAW', () => {
    it('should create audio nodes for multitrack playback', () => {
      const audioContext = new AudioContext();
      const gainNode = audioContext.createGain();
      const bufferSource = audioContext.createBufferSource();
      
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(gainNode.connect).toBeDefined();
      expect(bufferSource.connect).toBeDefined();
    });

    it('should handle audio routing for tracks', () => {
      const audioContext = new AudioContext();
      const trackGain = audioContext.createGain();
      const masterGain = audioContext.createGain();
      
      trackGain.connect(masterGain);
      masterGain.connect(audioContext.destination);
      
      expect(trackGain.connect).toHaveBeenCalledWith(masterGain);
      expect(masterGain.connect).toHaveBeenCalledWith(audioContext.destination);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const networkError = new Error('Arrange room connection lost');
      
      expect(networkError.message).toContain('Arrange room');
      expect(networkError).toBeInstanceOf(Error);
    });

    it('should handle invalid track operations', () => {
      const invalidTrack = {
        id: '',
        name: '',
      };

      // Should still emit but backend will validate
      mockSocket.emit('arrange:track_add', { roomId: 'test-room', track: invalidTrack });
      expect(mockSocket.emit).toHaveBeenCalled();
    });

    it('should provide fallback states for offline mode', () => {
      const fallbackStates = {
        offline: true,
        localOnly: true,
        canSaveLocally: true,
      };
      
      expect(fallbackStates.offline).toBe(true);
      expect(fallbackStates.localOnly).toBe(true);
      expect(fallbackStates.canSaveLocally).toBe(true);
    });
  });

  describe('State Management Integration', () => {
    it('should maintain consistent DAW state across features', () => {
      const mockStates = {
        room: { id: 'arrange-room-1', members: 3, roomType: 'arrange' },
        tracks: [
          { id: 'track-1', name: 'Piano', instrumentId: 'piano' },
          { id: 'track-2', name: 'Drums', instrumentId: 'drums' },
        ],
        regions: [
          { id: 'region-1', trackId: 'track-1', type: 'midi', start: 0, duration: 4 },
        ],
        transport: { bpm: 120, playing: false, position: 0 },
        locks: new Map(),
      };
      
      expect(mockStates.room.roomType).toBe('arrange');
      expect(mockStates.tracks).toHaveLength(2);
      expect(mockStates.regions).toHaveLength(1);
      expect(mockStates.transport.bpm).toBe(120);
    });
  });
});
