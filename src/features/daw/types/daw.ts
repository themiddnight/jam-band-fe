import { InstrumentCategory } from "@/shared/constants/instruments";

export type TransportState = 'stopped' | 'playing' | 'paused' | 'recording';

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export type TrackId = string;
export type RegionId = string;
export type NoteId = string;
export type SustainId = string;
export type InstrumentId = string;

export interface MidiNote {
  id: NoteId;
  pitch: number;
  velocity: number;
  start: number; // in beats
  duration: number; // in beats
}

export interface SustainEvent {
  id: SustainId;
  start: number; // in beats
  end: number; // in beats
}

export type RegionType = 'midi' | 'audio';

export interface BaseRegion {
  id: RegionId;
  trackId: TrackId;
  name: string;
  start: number; // in beats
  length: number; // base length in beats
  loopEnabled: boolean;
  loopIterations: number;
  color: string;
  type: RegionType;
}

export interface MidiRegion extends BaseRegion {
  type: 'midi';
  notes: MidiNote[];
  sustainEvents: SustainEvent[];
}

export interface AudioRegion extends BaseRegion {
  type: 'audio';
  audioBuffer?: AudioBuffer;
  audioUrl?: string; // Blob URL for the recorded audio
  audioBlob?: Blob; // Original recorded blob (preserves opus/webm format)
  audioFileId?: string; // Reference to the original audio file (used for deduplication when saving)
  trimStart?: number; // Trim offset from start in beats
  originalLength?: number; // Original recording length before any trim
  gain?: number; // Gain in dB (-24 to +24)
  fadeInDuration?: number; // Fade in duration in beats (default 0)
  fadeOutDuration?: number; // Fade out duration in beats (default 0)
}

export type Region = MidiRegion | AudioRegion;

export type TrackType = 'midi' | 'audio';

export interface Track {
  id: TrackId;
  name: string;
  type: TrackType;
  instrumentId?: InstrumentId; // Only for MIDI tracks
  instrumentCategory?: InstrumentCategory; // Only for MIDI tracks
  volume: number; // 0 - 1 range
  pan: number; // -1 (left) to 1 (right)
  mute: boolean;
  solo: boolean;
  color: string;
  regionIds: RegionId[];
}

export interface LoopSettings {
  enabled: boolean;
  start: number; // in beats
  end: number; // in beats
}

export const DEFAULT_BPM = 120;
export const DEFAULT_TIME_SIGNATURE: TimeSignature = { numerator: 4, denominator: 4 };
export const DEFAULT_GRID_DIVISION = 16; // 16th notes
export const DEFAULT_INSTRUMENT_ID: InstrumentId = 'acoustic_grand_piano';
export const DEFAULT_TRACK_COLOR = '#3b82f6';

