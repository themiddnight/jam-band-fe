/**
 * Shared types for note events across local and remote playback
 */

export interface NoteEvent {
  notes: string[];
  velocity: number;
  eventType: "note_on" | "note_off" | "sustain_on" | "sustain_off";
  isKeyHeld?: boolean;
}

export interface RemoteNoteData extends NoteEvent {
  instrument: string;
  category: string;
}

export interface RemoteNoteReceivedData extends RemoteNoteData {
  userId: string;
  username: string;
  timestamp?: number;
}

// Re-export for backwards compatibility
export type NoteData = RemoteNoteData;
