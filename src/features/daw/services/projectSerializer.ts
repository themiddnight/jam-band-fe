import { useProjectStore } from '../stores/projectStore';
import { useTrackStore } from '../stores/trackStore';
import { useRegionStore } from '../stores/regionStore';
import { useArrangeRoomScaleStore } from '../stores/arrangeRoomStore';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import type { AudioRegion, MidiRegion, Region } from '../types/daw';
import type { EffectChain } from '@/features/effects/types';

export interface SerializedProject {
  version: string;
  metadata: {
    name: string;
    createdAt: string;
    modifiedAt: string;
  };
  project: {
    bpm: number;
    timeSignature: {
      numerator: number;
      denominator: number;
    };
    gridDivision: number;
    loop: {
      enabled: boolean;
      start: number;
      end: number;
    };
    isMetronomeEnabled: boolean;
    snapToGrid: boolean;
  };
  scale: {
    rootNote: string;
    scale: string;
  };
  tracks: any[];
  regions: SerializedRegion[];
  effectChains: Record<string, EffectChain>;
}

export interface SerializedRegion {
  id: string;
  trackId: string;
  name: string;
  start: number;
  length: number;
  loopEnabled: boolean;
  loopIterations: number;
  color: string;
  type: 'midi' | 'audio';
  // MIDI specific
  notes?: any[];
  sustainEvents?: any[];
  // Audio specific
  audioFileRef?: string; // Reference to audio file in zip
  trimStart?: number;
  originalLength?: number;
  gain?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export interface AudioFileData {
  regionId: string;
  fileName: string;
  blob: Blob;
}

/**
 * Serialize the current project state to a JSON-compatible object
 */
export function serializeProject(projectName: string): SerializedProject {
  const project = useProjectStore.getState();
  const tracks = useTrackStore.getState().tracks;
  const regions = useRegionStore.getState().regions;
  const scale = useArrangeRoomScaleStore.getState();
  const effectsState = useEffectsStore.getState();

  // Collect all effect chains (including track-specific ones)
  const effectChains: Record<string, EffectChain> = {};
  Object.entries(effectsState.chains).forEach(([chainType, chain]) => {
    // Only save chains that have effects or are track-specific
    if (chain.effects.length > 0 || chainType.startsWith('track:')) {
      effectChains[chainType] = chain;
    }
  });

  return {
    version: '1.0.0',
    metadata: {
      name: projectName,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
    project: {
      bpm: project.bpm,
      timeSignature: project.timeSignature,
      gridDivision: project.gridDivision,
      loop: project.loop,
      isMetronomeEnabled: project.isMetronomeEnabled,
      snapToGrid: project.snapToGrid,
    },
    scale: {
      rootNote: scale.rootNote,
      scale: scale.scale,
    },
    tracks: tracks.map((track: any) => ({
      id: track.id,
      name: track.name,
      type: track.type,
      instrumentId: track.instrumentId,
      instrumentCategory: track.instrumentCategory,
      volume: track.volume,
      pan: track.pan,
      mute: track.mute,
      solo: track.solo,
      color: track.color,
      regionIds: track.regionIds,
    })),
    regions: regions.map((region: any) => serializeRegion(region)),
    effectChains,
  };
}

/**
 * Serialize a single region
 */
function serializeRegion(region: Region): SerializedRegion {
  const base = {
    id: region.id,
    trackId: region.trackId,
    name: region.name,
    start: region.start,
    length: region.length,
    loopEnabled: region.loopEnabled,
    loopIterations: region.loopIterations,
    color: region.color,
    type: region.type,
  };

  if (region.type === 'midi') {
    const midiRegion = region as MidiRegion;
    return {
      ...base,
      notes: midiRegion.notes,
      sustainEvents: midiRegion.sustainEvents,
    };
  } else {
    const audioRegion = region as AudioRegion;
    return {
      ...base,
      audioFileRef: audioRegion.audioUrl ? `audio/${region.id}.wav` : undefined,
      trimStart: audioRegion.trimStart,
      originalLength: audioRegion.originalLength,
      gain: audioRegion.gain,
      fadeInDuration: audioRegion.fadeInDuration,
      fadeOutDuration: audioRegion.fadeOutDuration,
    };
  }
}

/**
 * Extract audio files from audio regions
 */
export async function extractAudioFiles(
  regions: Region[]
): Promise<AudioFileData[]> {
  const audioFiles: AudioFileData[] = [];

  for (const region of regions) {
    if (region.type === 'audio') {
      const audioRegion = region as AudioRegion;
      
      if (audioRegion.audioBuffer) {
        // Convert AudioBuffer to WAV blob
        const blob = await audioBufferToWav(audioRegion.audioBuffer);
        audioFiles.push({
          regionId: region.id,
          fileName: `${region.id}.wav`,
          blob,
        });
      }
    }
  }

  return audioFiles;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
async function audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  const channels: Float32Array[] = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // "RIFF" chunk descriptor
  setUint32(0x46464952); // "RIFF"
  setUint32(36 + length); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // "fmt " sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // subchunk1size
  setUint16(1); // audio format (1 = PCM)
  setUint16(numberOfChannels);
  setUint32(audioBuffer.sampleRate);
  setUint32(audioBuffer.sampleRate * 2 * numberOfChannels); // byte rate
  setUint16(numberOfChannels * 2); // block align
  setUint16(16); // bits per sample

  // "data" sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length);

  // Write interleaved data
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  while (pos < buffer.byteLength) {
    for (let i = 0; i < numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Restore project state from serialized data
 */
export function deserializeProject(data: SerializedProject): void {
  // Restore project settings
  useProjectStore.setState({
    bpm: data.project.bpm,
    timeSignature: data.project.timeSignature,
    gridDivision: data.project.gridDivision,
    loop: data.project.loop,
    isMetronomeEnabled: data.project.isMetronomeEnabled,
    snapToGrid: data.project.snapToGrid,
    transportState: 'stopped',
    playhead: 0,
    isRecording: false,
  });

  // Restore scale settings
  useArrangeRoomScaleStore.setState({
    rootNote: data.scale.rootNote,
    scale: data.scale.scale as any, // Type assertion for scale restoration
  });

  // Clear existing tracks and regions
  useTrackStore.getState().clearTracks();
  
  // Restore tracks
  data.tracks.forEach((track) => {
    useTrackStore.setState((state: any) => ({
      tracks: [...state.tracks, track],
    }));
  });

  // Restore effect chains
  if (data.effectChains) {
    const effectsStore = useEffectsStore.getState();
    Object.entries(data.effectChains).forEach(([chainType, chain]) => {
      // Ensure the chain exists in the store
      effectsStore.ensureChain(chainType as any);
      // Set the chain state
      useEffectsStore.setState((state) => ({
        chains: {
          ...state.chains,
          [chainType]: chain,
        },
      }));
    });
  }

  // Note: Regions will be restored separately after audio files are loaded
}

/**
 * Restore regions with audio buffers
 */
export function deserializeRegions(
  regions: SerializedRegion[],
  audioBuffers: Map<string, AudioBuffer>
): void {
  const restoredRegions: Region[] = regions.map((region) => {
    if (region.type === 'midi') {
      return {
        ...region,
        notes: region.notes || [],
        sustainEvents: region.sustainEvents || [],
      } as MidiRegion;
    } else {
      const audioBuffer = audioBuffers.get(region.id);
      return {
        ...region,
        audioBuffer,
        audioUrl: audioBuffer ? URL.createObjectURL(new Blob()) : undefined,
        trimStart: region.trimStart,
        originalLength: region.originalLength,
        gain: region.gain,
        fadeInDuration: region.fadeInDuration,
        fadeOutDuration: region.fadeOutDuration,
      } as AudioRegion;
    }
  });

  useRegionStore.setState({
    regions: restoredRegions,
    selectedRegionIds: [],
    lastSelectedRegionId: null,
  });
}
