// Metronome Feature Types

export interface MetronomeState {
  bpm: number;
  isMuted: boolean;
  volume: number;
  lastTickTimestamp: number;
}

export interface MetronomeSettings {
  volume: number;
  isMuted: boolean;
}

export interface MetronomeTickData {
  timestamp: number;
  bpm: number;
}

export interface UpdateMetronomeData {
  bpm: number;
}

export interface MetronomeControlsProps {
  bpm: number;
  isMuted: boolean;
  volume: number;
  onBpmChange: (bpm: number) => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  canEdit: boolean;
}
