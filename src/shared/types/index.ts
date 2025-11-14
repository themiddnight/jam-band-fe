export enum ControlType {
  Keyboard = "keyboard",
  Guitar = "guitar",
  Bass = "bass",
  Drumpad = "drumpad",
  Drumset = "drumset",
}

export type EffectChainType =
  | "virtual_instrument"
  | "audio_voice_input"
  | `track:${string}`;

export interface EffectParameterState {
  id?: string;
  name: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  curve?: "linear" | "logarithmic";
}

export interface EffectInstanceState {
  id: string;
  type: string;
  name?: string;
  bypassed: boolean;
  order: number;
  parameters: EffectParameterState[];
}

export interface EffectChainState {
  type: EffectChainType;
  effects: EffectInstanceState[];
}

export interface RoomUser {
  id: string;
  username: string;
  role: "room_owner" | "band_member" | "audience";
  currentInstrument?: string;
  currentCategory?: string;
  isReady: boolean;
  followRoomOwner?: boolean;
  effectChains?: Record<EffectChainType, EffectChainState>;
}

export type RoomType = "perform" | "arrange";

export interface Room {
  id: string;
  name: string;
  description?: string;
  roomType: RoomType;
  owner: string;
  users: RoomUser[];
  pendingMembers: RoomUser[];
  isPrivate: boolean;
  isHidden: boolean;
  createdAt: Date;
  ownerScale?: {
    rootNote: string;
    scale: Scale;
  };
}

// Music-related types
export type Scale = "major" | "minor";

export interface ScaleSlot {
  id: number;
  rootNote: string;
  scale: Scale;
  shortcut: string;
}

export interface Instrument {
  value: string;
  label: string;
  controlType: ControlType;
  type?: string;
  polyphony?: string;
  icon?: string;
}

// Scale follow event types
export interface RoomOwnerScaleChangeData {
  rootNote: string;
  scale: Scale;
}

export interface RoomOwnerScaleChangedEvent {
  rootNote: string;
  scale: Scale;
  ownerId: string;
}

export interface ToggleFollowRoomOwnerData {
  followRoomOwner: boolean;
}

export interface FollowRoomOwnerToggledEvent {
  followRoomOwner: boolean;
  ownerScale?: {
    rootNote: string;
    scale: Scale;
  };
}
