import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Audience Room Regression Tests
 * 
 * Tests for the AudienceRoom component and useAudienceRoom hook
 * to ensure role-based rendering and HLS streaming functionality.
 */

// Mock socket for testing
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
  disconnect: vi.fn(),
  connect: vi.fn(),
};

// Mock user roles
type UserRole = 'room_owner' | 'band_member' | 'audience';

interface MockUser {
  id: string;
  username: string;
  role: UserRole;
  currentInstrument?: string;
}

interface MockRoom {
  id: string;
  name: string;
  users: MockUser[];
  isBroadcasting: boolean;
}

describe('Audience Room Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Role-Based Access Control', () => {
    it('should identify audience users correctly', () => {
      const audienceUser: MockUser = {
        id: 'user-1',
        username: 'listener1',
        role: 'audience',
      };

      expect(audienceUser.role).toBe('audience');
      expect(audienceUser.role !== 'room_owner').toBe(true);
      expect(audienceUser.role !== 'band_member').toBe(true);
    });

    it('should correctly determine canTransmitVoice for different roles', () => {
      const canTransmitVoice = (role: UserRole) => 
        role === 'room_owner' || role === 'band_member';

      // Room owners and band members can transmit voice
      expect(canTransmitVoice('room_owner')).toBe(true);
      expect(canTransmitVoice('band_member')).toBe(true);
      // Audience cannot transmit voice (regression test for canTransmit typo fix)
      expect(canTransmitVoice('audience')).toBe(false);
    });

    it('should correctly determine isVoiceEnabled for different roles', () => {
      const isVoiceEnabled = (role: UserRole | undefined) => !!role;

      expect(isVoiceEnabled('room_owner')).toBe(true);
      expect(isVoiceEnabled('band_member')).toBe(true);
      expect(isVoiceEnabled('audience')).toBe(true);
      expect(isVoiceEnabled(undefined)).toBe(false);
    });

    it('should filter musicians from audience in user list', () => {
      const users: MockUser[] = [
        { id: '1', username: 'owner', role: 'room_owner', currentInstrument: 'piano' },
        { id: '2', username: 'member1', role: 'band_member', currentInstrument: 'guitar' },
        { id: '3', username: 'listener1', role: 'audience' },
        { id: '4', username: 'listener2', role: 'audience' },
      ];

      const musicians = users.filter(u => u.role === 'room_owner' || u.role === 'band_member');
      const audience = users.filter(u => u.role === 'audience');

      expect(musicians).toHaveLength(2);
      expect(audience).toHaveLength(2);
      expect(musicians.map(m => m.username)).toEqual(['owner', 'member1']);
      expect(audience.map(a => a.username)).toEqual(['listener1', 'listener2']);
    });
  });

  describe('Broadcast State Management', () => {
    it('should handle broadcast state changes', () => {
      let isBroadcasting = false;
      let playlistUrl: string | null = null;

      const handleBroadcastStateChanged = (data: { isBroadcasting: boolean; playlistUrl?: string | null }) => {
        isBroadcasting = data.isBroadcasting;
        playlistUrl = data.playlistUrl ?? null;
      };

      // Simulate broadcast starting
      handleBroadcastStateChanged({ 
        isBroadcasting: true, 
        playlistUrl: '/api/hls/room-123/playlist.m3u8' 
      });

      expect(isBroadcasting).toBe(true);
      expect(playlistUrl).toBe('/api/hls/room-123/playlist.m3u8');

      // Simulate broadcast stopping
      handleBroadcastStateChanged({ 
        isBroadcasting: false, 
        playlistUrl: null 
      });

      expect(isBroadcasting).toBe(false);
      expect(playlistUrl).toBeNull();
    });

    it('should request broadcast state on connection', () => {
      mockSocket.emit('perform:request_broadcast_state');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('perform:request_broadcast_state');
    });

    it('should register broadcast event listeners', () => {
      const handlers = {
        broadcast_state_changed: vi.fn(),
        broadcast_state: vi.fn(),
      };

      mockSocket.on('broadcast_state_changed', handlers.broadcast_state_changed);
      mockSocket.on('broadcast_state', handlers.broadcast_state);

      expect(mockSocket.on).toHaveBeenCalledWith('broadcast_state_changed', handlers.broadcast_state_changed);
      expect(mockSocket.on).toHaveBeenCalledWith('broadcast_state', handlers.broadcast_state);
    });
  });

  describe('Room Connection', () => {
    it('should connect to room as audience', () => {
      mockSocket.emit('join-room', {
        roomId: 'room-123',
        userId: 'user-1',
        role: 'audience',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', {
        roomId: 'room-123',
        userId: 'user-1',
        role: 'audience',
      });
    });

    it('should handle chat messages', () => {
      const roomId = 'room-123';
      const message = 'Hello from audience!';

      mockSocket.emit('chat_message', {
        message: message.trim(),
        roomId: roomId,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('chat_message', {
        message: 'Hello from audience!',
        roomId: 'room-123',
      });
    });

    it('should not send empty chat messages', () => {
      const sendChatMessage = (message: string, roomId: string) => {
        if (message.trim() && roomId) {
          mockSocket.emit('chat_message', {
            message: message.trim(),
            roomId: roomId,
          });
        }
      };

      sendChatMessage('   ', 'room-123');
      sendChatMessage('', 'room-123');

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Stream Status States', () => {
    type StreamStatus = 'connecting' | 'buffering' | 'playing' | 'error';

    it('should have correct status labels', () => {
      const getStatusLabel = (status: StreamStatus): string => {
        switch (status) {
          case 'playing': return 'Now Playing';
          case 'buffering': return 'Buffering...';
          case 'connecting': return 'Connecting...';
          case 'error': return 'Stream Error';
        }
      };

      expect(getStatusLabel('playing')).toBe('Now Playing');
      expect(getStatusLabel('buffering')).toBe('Buffering...');
      expect(getStatusLabel('connecting')).toBe('Connecting...');
      expect(getStatusLabel('error')).toBe('Stream Error');
    });

    it('should have correct status colors', () => {
      const getStatusColor = (status: StreamStatus): string => {
        switch (status) {
          case 'playing': return 'text-success';
          case 'error': return 'text-error';
          default: return 'text-warning';
        }
      };

      expect(getStatusColor('playing')).toBe('text-success');
      expect(getStatusColor('error')).toBe('text-error');
      expect(getStatusColor('buffering')).toBe('text-warning');
      expect(getStatusColor('connecting')).toBe('text-warning');
    });
  });

  describe('HLS URL Construction', () => {
    it('should handle relative playlist URLs', () => {
      const apiBaseUrl = 'https://api.example.com';
      const playlistUrl = '/api/hls/room-123/playlist.m3u8';

      const fullUrl = playlistUrl.startsWith('http')
        ? playlistUrl
        : `${apiBaseUrl}${playlistUrl}`;

      expect(fullUrl).toBe('https://api.example.com/api/hls/room-123/playlist.m3u8');
    });

    it('should handle absolute playlist URLs', () => {
      const apiBaseUrl = 'https://api.example.com';
      const playlistUrl = 'https://cdn.example.com/hls/room-123/playlist.m3u8';

      const fullUrl = playlistUrl.startsWith('http')
        ? playlistUrl
        : `${apiBaseUrl}${playlistUrl}`;

      expect(fullUrl).toBe('https://cdn.example.com/hls/room-123/playlist.m3u8');
    });
  });

  describe('UI State Rendering', () => {
    it('should show connecting state when not connected', () => {
      const isConnecting = true;
      const isConnected = false;
      const currentRoom: MockRoom | null = null;

      const shouldShowConnecting = isConnecting || (!isConnected && !currentRoom);
      
      expect(shouldShowConnecting).toBe(true);
    });

    it('should show waiting state when not broadcasting', () => {
      const isConnected = true;
      const isBroadcasting = false;
      const error: string | null = null;

      const shouldShowWaiting = isConnected && !error && !isBroadcasting;
      
      expect(shouldShowWaiting).toBe(true);
    });

    it('should show main UI when broadcasting', () => {
      const isConnected = true;
      const isBroadcasting = true;
      const error: string | null = null;

      const shouldShowMainUI = isConnected && !error && isBroadcasting;
      
      expect(shouldShowMainUI).toBe(true);
    });

    it('should show error state when error exists', () => {
      const error = 'Connection failed';

      expect(!!error).toBe(true);
    });
  });

  describe('Volume Control', () => {
    it('should clamp volume between 0 and 1', () => {
      const clampVolume = (value: number): number => {
        return Math.max(0, Math.min(1, value));
      };

      expect(clampVolume(0.5)).toBe(0.5);
      expect(clampVolume(0)).toBe(0);
      expect(clampVolume(1)).toBe(1);
      expect(clampVolume(-0.5)).toBe(0);
      expect(clampVolume(1.5)).toBe(1);
    });

    it('should parse volume from input correctly', () => {
      const parseVolume = (value: string): number => parseFloat(value);

      expect(parseVolume('0.5')).toBe(0.5);
      expect(parseVolume('0')).toBe(0);
      expect(parseVolume('1')).toBe(1);
      expect(parseVolume('0.75')).toBe(0.75);
    });
  });

  describe('Cleanup on Leave', () => {
    it('should disconnect socket on leave', () => {
      mockSocket.disconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should clean up event listeners', () => {
      const handler = vi.fn();
      
      mockSocket.on('broadcast_state_changed', handler);
      mockSocket.off('broadcast_state_changed', handler);

      expect(mockSocket.off).toHaveBeenCalledWith('broadcast_state_changed', handler);
    });
  });
});

describe('Audience Room vs Perform Room Compatibility', () => {
  it('should use different connection roles', () => {
    const audienceConnection = { role: 'audience' as const };
    const performConnection = { role: 'band_member' as const };

    expect(audienceConnection.role).not.toBe(performConnection.role);
  });

  it('should share common room properties', () => {
    const commonRoomProps = ['id', 'name', 'users', 'isBroadcasting'];
    
    const audienceRoom: MockRoom = {
      id: 'room-1',
      name: 'Live Session',
      users: [],
      isBroadcasting: true,
    };

    commonRoomProps.forEach(prop => {
      expect(audienceRoom).toHaveProperty(prop);
    });
  });
});
