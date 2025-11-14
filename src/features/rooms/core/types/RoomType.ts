// Room Type Architecture Foundation
export type RoomType = 'perform' | 'arrange';

// Room Type Configuration
export interface RoomTypeConfig {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  features: RoomFeature[];
  capabilities: RoomCapability[];
  defaultSettings: RoomSettings;
  collaborationModel: 'live-jamming' | 'collaborative-production';
}

export interface RoomFeature {
  id: string;
  name: string;
  required: boolean;
  description?: string;
}

export interface RoomCapability {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

export interface RoomSettings {
  maxUsers: number;
  allowVoiceChat: boolean;
  allowRealTimeSync: boolean;
  allowRecording: boolean;
  allowMultitrack: boolean;
  // Collaborative production specific settings
  allowConcurrentEditing?: boolean;
  conflictResolution?: 'operational-transform' | 'last-write-wins' | 'manual';
  presenceTracking?: boolean;
  versionHistory?: boolean;
}

export interface RoomFeature {
  id: string;
  name: string;
  required: boolean;
  component?: React.ComponentType;
}

export interface RoomCapability {
  id: string;
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface RoomSettings {
  maxUsers: number;
  allowVoiceChat: boolean;
  allowRealTimeSync: boolean;
  allowRecording: boolean;
  allowMultitrack: boolean;
}

export interface RoomInstance {
  type: RoomType;
  config: RoomTypeConfig;
  services: RoomServices;
  state: RoomState;
}

export interface RoomServices {
  instrumentEngine: any; // Will be properly typed
  audioInput: any;
  effects: any;
  userSession: any;
  socket: any;
  // Room-type specific services injected here
}

export interface RoomState {
  id: string;
  name: string;
  users: Map<string, any>;
  settings: RoomSettings;
  isActive: boolean;
}

// Room Type Registry
export const ROOM_TYPES: Record<RoomType, RoomTypeConfig> = {
  perform: {
    id: 'perform',
    name: 'perform',
    displayName: 'Perform Room',
    description: 'Real-time jamming session for live music collaboration',
    collaborationModel: 'live-jamming',
    features: [
      { id: 'real-time-sync', name: 'Real-time Sync', required: true, description: 'Synchronized audio across all participants' },
      { id: 'voice-chat', name: 'Voice Chat', required: false, description: 'Voice communication between musicians' },
      { id: 'sequencer', name: 'Step Sequencer', required: false, description: 'Collaborative beat making' },
      { id: 'metronome', name: 'Metronome', required: false, description: 'Shared timing reference' },
      { id: 'live-jamming', name: 'Live Jamming', required: true, description: 'Ephemeral live music sessions' },
    ],
    capabilities: [
      { id: 'collaborative-jamming', name: 'Collaborative Jamming', enabled: true, description: 'Play together in real-time' },
      { id: 'live-effects', name: 'Live Effects', enabled: true, description: 'Apply effects during performance' },
      { id: 'instrument-switching', name: 'Instrument Switching', enabled: true, description: 'Switch instruments on the fly' },
      { id: 'ephemeral-sessions', name: 'Ephemeral Sessions', enabled: true, description: 'Sessions are temporary and focus on the moment' },
    ],
    defaultSettings: {
      maxUsers: 8,
      allowVoiceChat: true,
      allowRealTimeSync: true,
      allowRecording: false,
      allowMultitrack: false,
      allowConcurrentEditing: false,
      presenceTracking: true,
    },
  },
  arrange: {
    id: 'arrange',
    name: 'arrange',
    displayName: 'Arrange Room',
    description: 'Collaborative DAW-like environment for music production with real-time multi-user editing',
    collaborationModel: 'collaborative-production',
    features: [
      { id: 'real-time-sync', name: 'Real-time Sync', required: true, description: 'Real-time synchronization of all editing actions' },
      { id: 'collaborative-timeline', name: 'Collaborative Timeline', required: true, description: 'Shared timeline with multi-user editing' },
      { id: 'multitrack-canvas', name: 'Multitrack Canvas', required: true, description: 'Canvas-style multitrack interface like Miro' },
      { id: 'voice-chat', name: 'Voice Chat', required: false, description: 'Voice communication during production' },
      { id: 'project-persistence', name: 'Project Persistence', required: true, description: 'Projects saved and can be resumed' },
      { id: 'version-history', name: 'Version History', required: false, description: 'Track changes and project versions' },
    ],
    capabilities: [
      { id: 'collaborative-editing', name: 'Real-time Collaborative Editing', enabled: true, description: 'Multiple users editing simultaneously like Google Docs' },
      { id: 'multi-user-timeline', name: 'Multi-user Timeline Editing', enabled: true, description: 'Multiple users can edit timeline simultaneously' },
      { id: 'presence-tracking', name: 'User Presence Tracking', enabled: true, description: 'See where other users are working' },
      { id: 'conflict-resolution', name: 'Edit Conflict Resolution', enabled: true, description: 'Handle simultaneous edits gracefully' },
      { id: 'region-recording', name: 'Audio/MIDI Region Recording', enabled: true, description: 'Record audio and MIDI regions collaboratively' },
      { id: 'collaborative-mixing', name: 'Collaborative Mixing', enabled: true, description: 'Multiple users can adjust mix parameters' },
      { id: 'project-sharing', name: 'Project Sharing & Export', enabled: true, description: 'Share and export completed projects' },
      { id: 'canvas-collaboration', name: 'Canvas-style Collaboration', enabled: true, description: 'Miro-like collaboration patterns for music production' },
    ],
    defaultSettings: {
      maxUsers: 10, // Higher capacity for collaborative editing
      allowVoiceChat: true,
      allowRealTimeSync: true,  // Essential for collaborative editing
      allowRecording: true,
      allowMultitrack: true,
      allowConcurrentEditing: true,
      conflictResolution: 'operational-transform',
      presenceTracking: true,
      versionHistory: true,
    },
  },
};