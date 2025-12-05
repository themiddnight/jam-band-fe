import { useProjectStore } from '../stores/projectStore';
import { useTrackStore } from '../stores/trackStore';
import { useRegionStore } from '../stores/regionStore';
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
  audioFileId?: string; // ID of the original audio file (for deduplication)
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
  const effectsState = useEffectsStore.getState();
  const synthState = useSynthStore.getState();
  const markerState = useMarkerStore.getState();

  // Collect all effect chains (including track-specific ones)
  // Sanitize effect chains to ensure they're serializable
  const effectChains: Record<string, EffectChain> = {};
  
  Object.entries(effectsState.chains).forEach(([chainType, chain]) => {
    // Only save chains that have effects
    if (chain && chain.effects && chain.effects.length > 0) {
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

  // Sanitize synth states to remove any non-serializable data
  const sanitizedSynthStates: Record<string, SynthState> = {};
  console.log('🎹 Sanitizing synth states...');
  try {
    Object.entries(synthState.synthStates).forEach(([trackId, state]) => {
      if (state) {
        // Create a clean copy
        sanitizedSynthStates[trackId] = JSON.parse(JSON.stringify(state));
      }
    });
    console.log(`✅ Synth states sanitized: ${Object.keys(sanitizedSynthStates).length}`);
  } catch (error) {
    console.error('❌ Error sanitizing synth states:', error);
  }

  const serializedProject: SerializedProject = {
    version: '1.0.0',
    metadata: {
      name: projectName,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
    project: {
      bpm: project.bpm,
      timeSignature: {
        numerator: project.timeSignature.numerator,
        denominator: project.timeSignature.denominator,
      },
      gridDivision: project.gridDivision,
      loop: {
        enabled: project.loop.enabled,
        start: project.loop.start,
        end: project.loop.end,
      },
      snapToGrid: project.snapToGrid,
    },
    scale: {
      rootNote: project.projectScale.rootNote,
      scale: project.projectScale.scale,
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
      regionIds: track.regionIds || [],
    })),
    regions: regions.map((region: any) => serializeRegion(region)),
    effectChains,
    synthStates: sanitizedSynthStates,
    markers: markerState.markers.map(marker => ({
      id: marker.id,
      position: marker.position,
      description: marker.description,
      color: marker.color,
    })),
  };

  // Validate the serialized project can be stringified
  try {
    JSON.stringify(serializedProject);
  } catch (error) {
    console.error('❌ Serialization validation failed:', error);
    throw new Error(`Project data contains non-serializable values: ${error}`);
  }

  return serializedProject;
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
    // Use audioFileId for the file reference (falls back to region.id for backward compatibility)
    const audioFileId = audioRegion.audioFileId || region.id;
    return {
      ...base,
      audioFileRef: audioRegion.audioUrl ? `audio/${audioFileId}.webm` : undefined,
      audioFileId, // Store audioFileId for proper reference restoration
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
 * Uses audioFileId for deduplication - split/duplicated regions share the same audio file
 */
export async function extractAudioFiles(
  regions: Region[]
): Promise<AudioFileData[]> {
  const audioFiles: AudioFileData[] = [];
  const processedFileIds = new Set<string>(); // Track which audio files we've already processed
  console.log(`🎵 Extracting audio from ${regions.length} regions...`);

  for (const region of regions) {
    if (region.type === 'audio') {
      const audioRegion = region as AudioRegion;
      
      // Use audioFileId for deduplication (falls back to region.id for backward compatibility)
      const audioFileId = audioRegion.audioFileId || region.id;
      
      // Skip if we've already processed this audio file
      if (processedFileIds.has(audioFileId)) {
        console.log(`  Skipping region ${region.id} - audio file ${audioFileId} already processed`);
        continue;
      }
      
      console.log(`  Processing audio region ${region.id} (file: ${audioFileId})...`);
      
      // Priority order:
      // 1. audioBlob (original recorded format - opus/webm, best quality/size)
      // 2. audioUrl (for server-hosted files)
      // 3. audioBuffer (fallback - converts to WAV, larger files)
      
      if (audioRegion.audioBlob) {
        console.log(`    Using original blob (${audioRegion.audioBlob.type})...`);
        if (audioRegion.audioBlob.size > 0) {
          const extension = audioRegion.audioBlob.type.includes('webm') ? 'webm' : 
                           audioRegion.audioBlob.type.includes('ogg') ? 'ogg' : 'audio';
          console.log(`    ✅ Original blob: ${(audioRegion.audioBlob.size / 1024).toFixed(2)} KB`);
          audioFiles.push({
            regionId: audioFileId, // Use audioFileId instead of region.id
            fileName: `${audioFileId}.${extension}`,
            blob: audioRegion.audioBlob,
          });
          processedFileIds.add(audioFileId);
        } else {
          console.warn(`    ⚠️ Blob is empty for region ${region.id}, trying fallback...`);
        }
      } else if (audioRegion.audioUrl && !audioRegion.audioUrl.startsWith('blob:')) {
        // Only fetch non-blob URLs (server-hosted files)
        console.log(`    Fetching from server URL: ${audioRegion.audioUrl.substring(0, 50)}...`);
        try {
          const response = await fetch(audioRegion.audioUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              console.log(`    ✅ Fetched: ${(blob.size / 1024).toFixed(2)} KB`);
              audioFiles.push({
                regionId: audioFileId, // Use audioFileId instead of region.id
                fileName: `${audioFileId}.webm`,
                blob,
              });
              processedFileIds.add(audioFileId);
            } else {
              console.warn(`    ⚠️ Fetched blob is empty for region ${region.id}, trying fallback...`);
            }
          } else {
            console.warn(`    ⚠️ Failed to fetch audio for region ${region.id}: ${response.status}, trying fallback...`);
          }
        } catch (error) {
          console.error(`    ❌ Error fetching audio for region ${region.id}:`, error);
        }
      }
      
      // Fallback to AudioBuffer conversion if no blob was saved
      if (!processedFileIds.has(audioFileId)) {
        if (audioRegion.audioBuffer) {
          console.log(`    Fallback: Converting AudioBuffer to WAV...`);
          try {
            const blob = audioBufferToWav(audioRegion.audioBuffer);
            console.log(`    ✅ Converted: ${(blob.size / 1024).toFixed(2)} KB`);
            audioFiles.push({
              regionId: audioFileId, // Use audioFileId instead of region.id
              fileName: `${audioFileId}.wav`,
              blob,
            });
            processedFileIds.add(audioFileId);
          } catch (error) {
            console.error(`    ❌ Failed to convert AudioBuffer:`, error);
          }
        } else {
          console.warn(`    ⚠️ No audio data available for region ${region.id}`);
        }
      }
    }
  }

  console.log(`✅ Extracted ${audioFiles.length} unique audio files from ${regions.filter(r => r.type === 'audio').length} audio regions`);
  return audioFiles;
}

/**
 * Convert AudioBuffer to WAV Blob (fast, uncompressed)
 * This is much faster than WebM encoding as it doesn't require real-time recording
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  // Validate audioBuffer
  if (!audioBuffer || audioBuffer.length === 0 || audioBuffer.numberOfChannels === 0) {
    console.error('Invalid audioBuffer:', {
      length: audioBuffer?.length,
      channels: audioBuffer?.numberOfChannels,
      sampleRate: audioBuffer?.sampleRate,
    });
    throw new Error('Invalid AudioBuffer: empty or no channels');
  }

  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2; // 16-bit samples
  const sampleRate = audioBuffer.sampleRate;
  
  console.log(`    Converting AudioBuffer: ${numberOfChannels} channels, ${audioBuffer.length} samples, ${sampleRate} Hz`);
  
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

  const blob = new Blob([buffer], { type: 'audio/wav' });
  
  if (blob.size === 0) {
    console.error('Generated WAV blob is empty!');
    throw new Error('Failed to generate WAV blob');
  }

  return blob;
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
    snapToGrid: data.project.snapToGrid,
    transportState: 'stopped',
    playhead: 0,
    isRecording: false,
    projectScale: {
      rootNote: data.scale.rootNote,
      scale: data.scale.scale as 'major' | 'minor',
    },
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
      // Use audioFileId to look up the audio buffer (falls back to region.id for backward compatibility)
      const audioFileId = region.audioFileId || region.id;
      const audioBuffer = audioBuffers.get(audioFileId);
      
      // Preserve audioUrl from serialized data (server path) if no buffer is provided
      const audioRegion = region as any;
      return {
        ...region,
        audioBuffer,
        audioUrl: audioRegion.audioUrl || (audioBuffer ? URL.createObjectURL(new Blob()) : undefined),
        audioFileId, // Restore the audioFileId reference
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
