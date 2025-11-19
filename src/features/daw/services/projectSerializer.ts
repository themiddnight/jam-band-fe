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

  for (const region of regions) {
    if (region.type === 'audio') {
      const audioRegion = region as AudioRegion;
      
      if (audioRegion.audioBuffer) {
        // Convert AudioBuffer to WebM/Opus blob (compressed)
        const blob = await audioBufferToWebM(audioRegion.audioBuffer);
        audioFiles.push({
          regionId: region.id,
          fileName: `${region.id}.webm`,
          blob,
        });
      } else if (audioRegion.audioUrl) {
        // Fetch audio from URL if buffer is not available
        try {
          const response = await fetch(audioRegion.audioUrl);
          if (response.ok) {
            const blob = await response.blob();
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
      }
    }
  }

  return audioFiles;
}

/**
 * Convert AudioBuffer to WebM/Opus Blob (compressed)
 */
async function audioBufferToWebM(audioBuffer: AudioBuffer): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Create an offline audio context to render the buffer
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Create a buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    // Render the audio
    offlineContext.startRendering().then((renderedBuffer) => {
      // Create a MediaStreamDestination to capture the audio
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      // Create a buffer source with the rendered audio
      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = renderedBuffer;
      bufferSource.connect(destination);

      // Set up MediaRecorder with Opus codec
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128kbps - good quality, reasonable size
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        audioContext.close();
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        audioContext.close();
        reject(new Error('MediaRecorder error: ' + event));
      };

      // Start recording and play the buffer
      mediaRecorder.start();
      bufferSource.start(0);

      // Stop recording after the buffer duration
      const durationMs = (renderedBuffer.length / renderedBuffer.sampleRate) * 1000;
      setTimeout(() => {
        mediaRecorder.stop();
        bufferSource.stop();
      }, durationMs + 100); // Add 100ms buffer
    }).catch(reject);
  });
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
