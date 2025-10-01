import type { RoomType, RoomTypeConfig, RoomInstance } from '../types/RoomType';
import { ROOM_TYPES } from '../types/RoomType';

export class RoomFactory {
  static createRoom(
    type: RoomType,
    roomId: string,
    roomName: string,
    customSettings?: Partial<RoomTypeConfig>
  ): RoomInstance {
    const config = { ...ROOM_TYPES[type], ...customSettings };
    
    const services = this.createServices(type);
    
    const state = {
      id: roomId,
      name: roomName,
      users: new Map(),
      settings: config.defaultSettings,
      isActive: false,
    };
    
    return {
      type,
      config,
      services,
      state,
    };
  }
  
  private static createServices(type: RoomType) {
    const baseServices = {
      instrumentEngine: null, // Will be injected
      audioInput: null,       // Will be injected
      effects: null,          // Will be injected
      userSession: null,      // Will be injected
      socket: null,           // Will be injected
    };
    
    // Add room-type specific services
    switch (type) {
      case 'perform':
        return {
          ...baseServices,
          realtimeSync: null,    // Live jamming synchronization
          webrtcVoice: null,     // Voice chat for jamming
          metronome: null,       // Shared timing reference
        };
        
      case 'produce':
        return {
          ...baseServices,
          realtimeSync: null,    // Real-time collaborative editing sync
          multitrack: null,      // Multitrack production
          timeline: null,        // Collaborative timeline
          mixer: null,           // Collaborative mixing
          // Future collaborative services (Phase 2+):
          // collaborativeTimeline: null,  // Multi-user timeline editing
          // presenceTracking: null,       // User presence awareness
          // conflictResolution: null,     // Edit conflict handling
        };
        
      default:
        return baseServices;
    }
  }
  
  static getRoomTypeConfig(type: RoomType): RoomTypeConfig {
    return ROOM_TYPES[type];
  }
  
  static getSupportedRoomTypes(): RoomType[] {
    return Object.keys(ROOM_TYPES) as RoomType[];
  }
  
  static isValidRoomType(type: string): type is RoomType {
    return type in ROOM_TYPES;
  }
}