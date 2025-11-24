import { useProjectStore } from '../stores/projectStore';
import { useTrackStore } from '../stores/trackStore';
import { useRegionStore } from '../stores/regionStore';
import { useArrangeRoomScaleStore } from '../stores/arrangeRoomStore';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import { useSynthStore } from '../stores/synthStore';
import { useMarkerStore } from '../stores/markerStore';
import type { AudioRegion, MidiRegion, Region } from '../types/daw';
import type { EffectChain } from '@/features/effects/types';
import type { SynthState } from '@/features/instruments';
import type { TimeMarker } from '../types/marker';

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
  synthStates: Record<string, SynthState>;
  markers?: TimeMarker[]; // Optional for backward compatibility
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
  const synthState = useSynthStore.getState();
  const markerState = useMarkerStore.getState();

  // Collect all effect chains (including track-specific ones)
  // Sanitize effect chains to ensure they're serializable
  const effectChains: Record<string, EffectChain> = {};
  console.log(`🎛️ Processing ${Object.keys(effectsState.chains).length} effect chains...`);
  
  Object.entries(effectsState.chains).forEach(([chainType, chain]) => {
    // Only save chains that have effects
    if (chain && chain.effects && chain.effects.length > 0) {
      console.log(`  Sanitizing chain ${chainType} with ${chain.effects.length} effects...`);
      try {
        // Create a clean copy to avoid circular references
        effectChains[chainType] = {
          type: chain.type,
          effects: chain.effects.map(effect => ({
            id: effect.id,
            type: effect.type,
            name: effect.name,
            bypassed: effect.bypassed,
            order: effect.order,
            parameters: effect.parameters.map(param => ({
              id: param.id,
              name: param.name,
              value: param.value,
              min: param.min,
              max: param.max,
              step: param.step,
              type: param.type,
              unit: param.unit,
              curve: param.curve,
            })),
          })),
        };
        console.log(`  ✅ Chain ${chainType} sanitized`);
      } catch (error) {
        console.error(`  ❌ Error sanitizing chain ${chainType}:`, error);
      }
    }
  });
  
  console.log(`✅ Effect chains processed: ${Object.keys(effectChains).length}`);

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
    synthStates: synthState.synthStates,
    markers: markerState.markers,
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
      audioFileRef: audioRegion.audioUrl ? `audio/${region.id}.webm` : undefined,
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
  console.log(`🎵 Extracting audio from ${regions.length} regions...`);

  for (const region of regions) {
    if (region.type === 'audio') {
      const audioRegion = region as AudioRegion;
      console.log(`  Processing audio region ${region.id}...`);
      
      // Prioritize audioUrl (much faster - no conversion needed)
      if (audioRegion.audioUrl) {
        console.log(`    Fetching from URL: ${audioRegion.audioUrl.substring(0, 50)}...`);
        try {
          const response = await fetch(audioRegion.audioUrl);
          if (response.ok) {
            const blob = await response.blob();
            console.log(`    ✅ Fetched: ${(blob.size / 1024).toFixed(2)} KB`);
            audioFiles.push({
              regionId: region.id,
              fileName: `${region.id}.webm`,
              blob,
            });
          } else {
            console.warn(`Failed to fetch audio for region ${region.id}: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error fetching audio for region ${region.id}:`, error);
        }
      } else if (audioRegion.audioBuffer) {
        console.log(`    Converting AudioBuffer to WAV (fast)...`);
        // Use fast WAV conversion instead of slow WebM encoding
        const blob = audioBufferToWav(audioRegion.audioBuffer);
        console.log(`    ✅ Converted: ${(blob.size / 1024).toFixed(2)} KB`);
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
 * Convert AudioBuffer to WAV Blob (fast, uncompressed)
 * This is much faster than WebM encoding as it doesn't require real-time recording
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2; // 16-bit samples
  const sampleRate = audioBuffer.sampleRate;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true); // byte rate
  view.setUint16(32, numberOfChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Write audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// Removed audioBufferToWebM - it was too slow (required real-time recording)
// Now using fast WAV conversion instead

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

  // Restore synth states
  if (data.synthStates) {
    useSynthStore.getState().setAllSynthStates(data.synthStates);
  }

  // Restore markers
  if (data.markers) {
    useMarkerStore.setState({
      markers: data.markers,
      selectedMarkerId: null,
    });
  } else {
    // Backward compatibility: clear markers if not present
    useMarkerStore.setState({
      markers: [],
      selectedMarkerId: null,
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
      // Preserve audioUrl from serialized data (server path) if no buffer is provided
      const audioRegion = region as any;
      return {
        ...region,
        audioBuffer,
        audioUrl: audioRegion.audioUrl || (audioBuffer ? URL.createObjectURL(new Blob()) : undefined),
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
