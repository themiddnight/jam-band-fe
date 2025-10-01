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

    it('should create produce room with correct configuration', () => {
      const room = RoomFactory.createRoom('produce', 'test-room-2', 'Test Produce Room');
      
      expect(room.type).toBe('produce');
      expect(room.state.id).toBe('test-room-2');
      expect(room.state.name).toBe('Test Produce Room');
      expect(room.config.displayName).toBe('Produce Room');
      expect(room.config.defaultSettings.allowMultitrack).toBe(true);
      expect(room.config.defaultSettings.allowRealTimeSync).toBe(true); // Now required for collaborative editing
      expect(room.config.defaultSettings.allowConcurrentEditing).toBe(true);
      expect(room.config.collaborationModel).toBe('collaborative-production');
    });

    it('should create room-type specific services', () => {
      const performRoom = RoomFactory.createRoom('perform', 'perform-room', 'Perform');
      const produceRoom = RoomFactory.createRoom('produce', 'produce-room', 'Produce');
      
      // Perform room should have real-time jamming services
      expect(performRoom.services).toHaveProperty('realtimeSync');
      expect(performRoom.services).toHaveProperty('webrtcVoice');
      expect(performRoom.services).toHaveProperty('metronome');
      expect(performRoom.services).not.toHaveProperty('multitrack');
      expect(performRoom.services).not.toHaveProperty('collaborativeTimeline');
      
      // Produce room should have collaborative production services
      expect(produceRoom.services).toHaveProperty('multitrack');
      expect(produceRoom.services).toHaveProperty('timeline');
      expect(produceRoom.services).toHaveProperty('mixer');
      expect(produceRoom.services).toHaveProperty('realtimeSync'); // Now required for collaborative editing
      // Future collaborative services (will be added in later phases)
      // expect(produceRoom.services).toHaveProperty('collaborativeTimeline');
      // expect(produceRoom.services).toHaveProperty('presenceTracking');
    });

    it('should validate room types correctly', () => {
      expect(RoomFactory.isValidRoomType('perform')).toBe(true);
      expect(RoomFactory.isValidRoomType('produce')).toBe(true);
      expect(RoomFactory.isValidRoomType('invalid')).toBe(false);
      expect(RoomFactory.isValidRoomType('')).toBe(false);
    });

    it('should return supported room types', () => {
      const supportedTypes = RoomFactory.getSupportedRoomTypes();
      expect(supportedTypes).toContain('perform');
      expect(supportedTypes).toContain('produce');
      expect(supportedTypes).toHaveLength(2);
    });

    it('should get room type configuration', () => {
      const performConfig = RoomFactory.getRoomTypeConfig('perform');
      const produceConfig = RoomFactory.getRoomTypeConfig('produce');
      
      expect(performConfig.id).toBe('perform');
      expect(performConfig.displayName).toBe('Perform Room');
      expect(produceConfig.id).toBe('produce');
      expect(produceConfig.displayName).toBe('Produce Room');
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

    it('should have valid produce room configuration for collaborative production', () => {
      const produceConfig = ROOM_TYPES.produce;
      
      expect(produceConfig.id).toBe('produce');
      expect(produceConfig.displayName).toBe('Produce Room');
      expect(produceConfig.collaborationModel).toBe('collaborative-production');
      expect(produceConfig.description).toContain('Collaborative DAW-like environment');
      
      expect(produceConfig.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'real-time-sync', required: true }),
          expect.objectContaining({ id: 'collaborative-timeline', required: true }),
          expect.objectContaining({ id: 'multitrack-canvas', required: true }),
          expect.objectContaining({ id: 'project-persistence', required: true }),
          expect.objectContaining({ id: 'voice-chat', required: false }),
          expect.objectContaining({ id: 'version-history', required: false }),
        ])
      );
      
      expect(produceConfig.capabilities).toEqual(
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
      const produceSettings = ROOM_TYPES.produce.defaultSettings;
      
      // Perform room: Live jamming focused
      expect(performSettings.allowRealTimeSync).toBe(true);
      expect(performSettings.allowMultitrack).toBe(false);
      expect(performSettings.allowRecording).toBe(false);
      expect(performSettings.allowConcurrentEditing).toBe(false);
      expect(performSettings.maxUsers).toBe(8);
      expect(performSettings.presenceTracking).toBe(true);
      
      // Produce room: Collaborative production focused
      expect(produceSettings.allowRealTimeSync).toBe(true); // Essential for collaborative editing
      expect(produceSettings.allowMultitrack).toBe(true);
      expect(produceSettings.allowRecording).toBe(true);
      expect(produceSettings.allowConcurrentEditing).toBe(true);
      expect(produceSettings.maxUsers).toBe(10); // Higher capacity for collaborative editing
      expect(produceSettings.conflictResolution).toBe('operational-transform');
      expect(produceSettings.presenceTracking).toBe(true);
      expect(produceSettings.versionHistory).toBe(true);
    });

    it('should have both room types requiring real-time sync', () => {
      // Both room types now need real-time sync for different reasons
      expect(ROOM_TYPES.perform.defaultSettings.allowRealTimeSync).toBe(true); // For live audio sync
      expect(ROOM_TYPES.produce.defaultSettings.allowRealTimeSync).toBe(true); // For collaborative editing sync
      
      // Both should have real-time-sync as required feature
      const performRealTimeSync = ROOM_TYPES.perform.features.find(f => f.id === 'real-time-sync');
      const produceRealTimeSync = ROOM_TYPES.produce.features.find(f => f.id === 'real-time-sync');
      
      expect(performRealTimeSync?.required).toBe(true);
      expect(produceRealTimeSync?.required).toBe(true);
    });

    it('should differentiate collaboration models correctly', () => {
      expect(ROOM_TYPES.perform.collaborationModel).toBe('live-jamming');
      expect(ROOM_TYPES.produce.collaborationModel).toBe('collaborative-production');
      
      // Verify different focuses
      const performCapabilities = ROOM_TYPES.perform.capabilities.map(c => c.id);
      const produceCapabilities = ROOM_TYPES.produce.capabilities.map(c => c.id);
      
      // Perform room: Live jamming capabilities
      expect(performCapabilities).toContain('collaborative-jamming');
      expect(performCapabilities).toContain('ephemeral-sessions');
      expect(performCapabilities).not.toContain('collaborative-editing');
      
      // Produce room: Production capabilities
      expect(produceCapabilities).toContain('collaborative-editing');
      expect(produceCapabilities).toContain('canvas-collaboration');
      expect(produceCapabilities).not.toContain('ephemeral-sessions');
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