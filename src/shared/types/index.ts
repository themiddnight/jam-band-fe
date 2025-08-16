export enum ControlType {
  Keyboard = "keyboard",
  Guitar = "guitar",
  Bass = "bass",
  Drumpad = "drumpad",
  Drumset = "drumset",
}

export interface RoomUser {
  id: string;
  username: string;
  role: "room_owner" | "band_member" | "audience";
  currentInstrument?: string;
  currentCategory?: string;
  isReady: boolean;
}

export interface Room {
  id: string;
  name: string;
  owner: string;
  users: RoomUser[];
  pendingMembers: RoomUser[];
  isPrivate: boolean;
  isHidden: boolean;
  createdAt: Date;
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
