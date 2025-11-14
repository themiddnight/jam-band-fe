import { describe, it, expect } from 'vitest';
import { RoomFactory } from '../core/services/RoomFactory';
import { ROOM_TYPES } from '../core/types/RoomType';

describe('Room Type Architecture', () => {
  describe('RoomFactory', () => {
    it('should create perform room with correct configuration', () => {
      const room = RoomFactory.createRoom('perform', 'test-room-1', 'Test Perform Room');
      
      expect(room.type).toBe('perform');
      expect(room.state.id).toBe('test-room-1');
      expect(room.state.name).toBe('Test Perform Room');
      expect(room.config.displayName).toBe('Perform Room');
      expect(room.config.defaultSettings.allowRealTimeSync).toBe(true);
      expect(room.config.defaultSettings.allowMultitrack).toBe(false);
    });

    it('should create arrange room with correct configuration', () => {
      const room = RoomFactory.createRoom('arrange', 'test-room-2', 'Test Arrange Room');
      
      expect(room.type).toBe('arrange');
      expect(room.state.id).toBe('test-room-2');
      expect(room.state.name).toBe('Test Arrange Room');
      expect(room.config.displayName).toBe('Arrange Room');
      expect(room.config.defaultSettings.allowMultitrack).toBe(true);
      expect(room.config.defaultSettings.allowRealTimeSync).toBe(true); // Now required for collaborative editing
      expect(room.config.defaultSettings.allowConcurrentEditing).toBe(true);
      expect(room.config.collaborationModel).toBe('collaborative-production');
    });

    it('should create room-type specific services', () => {
      const performRoom = RoomFactory.createRoom('perform', 'perform-room', 'Perform');
      const arrangeRoom = RoomFactory.createRoom('arrange', 'arrange-room', 'Arrange');
      
      // Perform room should have real-time jamming services
      expect(performRoom.services).toHaveProperty('realtimeSync');
      expect(performRoom.services).toHaveProperty('webrtcVoice');
      expect(performRoom.services).toHaveProperty('metronome');
      expect(performRoom.services).not.toHaveProperty('multitrack');
      expect(performRoom.services).not.toHaveProperty('collaborativeTimeline');
      
      // Arrange room should have collaborative production services
      expect(arrangeRoom.services).toHaveProperty('multitrack');
      expect(arrangeRoom.services).toHaveProperty('timeline');
      expect(arrangeRoom.services).toHaveProperty('mixer');
      expect(arrangeRoom.services).toHaveProperty('realtimeSync'); // Now required for collaborative editing
      // Future collaborative services (will be added in later phases)
      // expect(arrangeRoom.services).toHaveProperty('collaborativeTimeline');
      // expect(arrangeRoom.services).toHaveProperty('presenceTracking');
    });

    it('should validate room types correctly', () => {
      expect(RoomFactory.isValidRoomType('perform')).toBe(true);
      expect(RoomFactory.isValidRoomType('arrange')).toBe(true);
      expect(RoomFactory.isValidRoomType('invalid')).toBe(false);
      expect(RoomFactory.isValidRoomType('')).toBe(false);
    });

    it('should return supported room types', () => {
      const supportedTypes = RoomFactory.getSupportedRoomTypes();
      expect(supportedTypes).toContain('perform');
      expect(supportedTypes).toContain('arrange');
      expect(supportedTypes).toHaveLength(2);
    });

    it('should get room type configuration', () => {
      const performConfig = RoomFactory.getRoomTypeConfig('perform');
      const arrangeConfig = RoomFactory.getRoomTypeConfig('arrange');
      
      expect(performConfig.id).toBe('perform');
      expect(performConfig.displayName).toBe('Perform Room');
      expect(arrangeConfig.id).toBe('arrange');
      expect(arrangeConfig.displayName).toBe('Arrange Room');
    });
  });

  describe('Room Type Configurations', () => {
    it('should have valid perform room configuration for live jamming', () => {
      const performConfig = ROOM_TYPES.perform;
      
      expect(performConfig.id).toBe('perform');
      expect(performConfig.displayName).toBe('Perform Room');
      expect(performConfig.collaborationModel).toBe('live-jamming');
      expect(performConfig.description).toContain('Real-time jamming session');
      
      expect(performConfig.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'real-time-sync', required: true }),
          expect.objectContaining({ id: 'live-jamming', required: true }),
          expect.objectContaining({ id: 'voice-chat', required: false }),
          expect.objectContaining({ id: 'sequencer', required: false }),
          expect.objectContaining({ id: 'metronome', required: false }),
        ])
      );
      
      expect(performConfig.capabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'collaborative-jamming', enabled: true }),
          expect.objectContaining({ id: 'live-effects', enabled: true }),
          expect.objectContaining({ id: 'instrument-switching', enabled: true }),
          expect.objectContaining({ id: 'ephemeral-sessions', enabled: true }),
        ])
      );
    });

    it('should have valid arrange room configuration for collaborative production', () => {
      const arrangeConfig = ROOM_TYPES.arrange;
      
      expect(arrangeConfig.id).toBe('arrange');
      expect(arrangeConfig.displayName).toBe('Arrange Room');
      expect(arrangeConfig.collaborationModel).toBe('collaborative-production');
      expect(arrangeConfig.description).toContain('Collaborative DAW-like environment');
      
      expect(arrangeConfig.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'real-time-sync', required: true }),
          expect.objectContaining({ id: 'collaborative-timeline', required: true }),
          expect.objectContaining({ id: 'multitrack-canvas', required: true }),
          expect.objectContaining({ id: 'project-persistence', required: true }),
          expect.objectContaining({ id: 'voice-chat', required: false }),
          expect.objectContaining({ id: 'version-history', required: false }),
        ])
      );
      
      expect(arrangeConfig.capabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'collaborative-editing', enabled: true }),
          expect.objectContaining({ id: 'multi-user-timeline', enabled: true }),
          expect.objectContaining({ id: 'presence-tracking', enabled: true }),
          expect.objectContaining({ id: 'conflict-resolution', enabled: true }),
          expect.objectContaining({ id: 'region-recording', enabled: true }),
          expect.objectContaining({ id: 'collaborative-mixing', enabled: true }),
          expect.objectContaining({ id: 'canvas-collaboration', enabled: true }),
        ])
      );
    });

    it('should have collaborative features properly configured', () => {
      const performSettings = ROOM_TYPES.perform.defaultSettings;
      const arrangeSettings = ROOM_TYPES.arrange.defaultSettings;
      
      // Perform room: Live jamming focused
      expect(performSettings.allowRealTimeSync).toBe(true);
      expect(performSettings.allowMultitrack).toBe(false);
      expect(performSettings.allowRecording).toBe(false);
      expect(performSettings.allowConcurrentEditing).toBe(false);
      expect(performSettings.maxUsers).toBe(8);
      expect(performSettings.presenceTracking).toBe(true);
      
      // Arrange room: Collaborative production focused
      expect(arrangeSettings.allowRealTimeSync).toBe(true); // Essential for collaborative editing
      expect(arrangeSettings.allowMultitrack).toBe(true);
      expect(arrangeSettings.allowRecording).toBe(true);
      expect(arrangeSettings.allowConcurrentEditing).toBe(true);
      expect(arrangeSettings.maxUsers).toBe(10); // Higher capacity for collaborative editing
      expect(arrangeSettings.conflictResolution).toBe('operational-transform');
      expect(arrangeSettings.presenceTracking).toBe(true);
      expect(arrangeSettings.versionHistory).toBe(true);
    });

    it('should have both room types requiring real-time sync', () => {
      // Both room types now need real-time sync for different reasons
      expect(ROOM_TYPES.perform.defaultSettings.allowRealTimeSync).toBe(true); // For live audio sync
      expect(ROOM_TYPES.arrange.defaultSettings.allowRealTimeSync).toBe(true); // For collaborative editing sync
      
      // Both should have real-time-sync as required feature
      const performRealTimeSync = ROOM_TYPES.perform.features.find(f => f.id === 'real-time-sync');
      const arrangeRealTimeSync = ROOM_TYPES.arrange.features.find(f => f.id === 'real-time-sync');
      
      expect(performRealTimeSync?.required).toBe(true);
      expect(arrangeRealTimeSync?.required).toBe(true);
    });

    it('should differentiate collaboration models correctly', () => {
      expect(ROOM_TYPES.perform.collaborationModel).toBe('live-jamming');
      expect(ROOM_TYPES.arrange.collaborationModel).toBe('collaborative-production');
      
      // Verify different focuses
      const performCapabilities = ROOM_TYPES.perform.capabilities.map(c => c.id);
      const arrangeCapabilities = ROOM_TYPES.arrange.capabilities.map(c => c.id);
      
      // Perform room: Live jamming capabilities
      expect(performCapabilities).toContain('collaborative-jamming');
      expect(performCapabilities).toContain('ephemeral-sessions');
      expect(performCapabilities).not.toContain('collaborative-editing');
      
      // Arrange room: Production capabilities
      expect(arrangeCapabilities).toContain('collaborative-editing');
      expect(arrangeCapabilities).toContain('canvas-collaboration');
      expect(arrangeCapabilities).not.toContain('ephemeral-sessions');
    });
  });

  describe('Room Instance Management', () => {
    it('should initialize room with correct state', () => {
      const room = RoomFactory.createRoom('perform', 'room-123', 'My Room');
      
      expect(room.state.id).toBe('room-123');
      expect(room.state.name).toBe('My Room');
      expect(room.state.users).toBeInstanceOf(Map);
      expect(room.state.users.size).toBe(0);
      expect(room.state.isActive).toBe(false);
    });

    it('should have all required shared services', () => {
      const room = RoomFactory.createRoom('perform', 'test-room', 'Test');
      
      expect(room.services).toHaveProperty('instrumentEngine');
      expect(room.services).toHaveProperty('audioInput');
      expect(room.services).toHaveProperty('effects');
      expect(room.services).toHaveProperty('userSession');
      expect(room.services).toHaveProperty('socket');
    });
  });
});