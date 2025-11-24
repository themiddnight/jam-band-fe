import { useEffect, useRef } from 'react';
import { useTrackStore } from '../stores/trackStore';
import { trackInstrumentRegistry } from '../utils/trackInstrumentRegistry';
import {
  getInstrumentCategoryById,
  getDefaultInstrumentForCategory,
} from '@/features/instruments/utils/instrumentLookup';
import { InstrumentCategory } from '@/shared/constants/instruments';
import { DEFAULT_INSTRUMENT_ID } from '../types/daw';

/**
 * Hook to sync track volume/pan/solo/mute changes to audio engine
 */
export const useTrackAudioParams = () => {
  const tracks = useTrackStore((state) => state.tracks);
  const lastInstrumentKeyRef = useRef<Record<string, string>>({});

  useEffect(() => {
    // Check if any track has solo enabled
    const hasSolo = tracks.some((t) => t.solo);
    const seenTrackIds = new Set<string>();
    
    // Update audio params for all tracks when volume/pan/solo/mute changes
    tracks.forEach((track) => {
      seenTrackIds.add(track.id);

      let effectiveVolume = track.volume;
      if ((hasSolo && !track.solo) || track.mute) {
        effectiveVolume = 0;
      }

      // Handle MIDI tracks
      if (track.type === 'midi') {
        void trackInstrumentRegistry
          .updateChannelMix(track, {
            volume: effectiveVolume,
            pan: track.pan,
          })
          .catch((error) => {
            console.warn('Failed to update track mixer settings', {
              trackId: track.id,
              error,
            });
          });

        const fallbackCategory = track.instrumentCategory ?? InstrumentCategory.Melodic;
        const resolvedInstrumentId =
          track.instrumentId ??
          getDefaultInstrumentForCategory(fallbackCategory ?? InstrumentCategory.Melodic) ??
          DEFAULT_INSTRUMENT_ID;
        const resolvedCategory =
          track.instrumentCategory ??
          getInstrumentCategoryById(resolvedInstrumentId) ??
          fallbackCategory;

        const instrumentKey = `${resolvedInstrumentId}:${resolvedCategory}`;
        const hydratedTrack = {
          ...track,
          instrumentId: resolvedInstrumentId,
          instrumentCategory: resolvedCategory,
        };

        const existingEngine = trackInstrumentRegistry.getEngine(track.id);
        if (!existingEngine) {
          void trackInstrumentRegistry
            .ensureEngine(hydratedTrack, {
              instrumentId: resolvedInstrumentId,
              instrumentCategory: resolvedCategory,
            })
            .catch((error) => {
              console.warn('Failed to prepare instrument engine', {
                trackId: track.id,
                error,
              });
            });
          lastInstrumentKeyRef.current[track.id] = instrumentKey;
          return;
        }

        if (lastInstrumentKeyRef.current[track.id] !== instrumentKey) {
          lastInstrumentKeyRef.current[track.id] = instrumentKey;
          void trackInstrumentRegistry
            .updateTrackConfig(hydratedTrack, {
              instrumentId: resolvedInstrumentId,
              instrumentCategory: resolvedCategory,
            })
            .catch((error) => {
              console.warn('Failed to update instrument configuration', {
                trackId: track.id,
                error,
              });
            });
        }
      } 
      // Handle audio tracks - update mixer channel volume/pan
      else if (track.type === 'audio') {
        void (async () => {
          try {
            const { getOrCreateGlobalMixer } = await import('@/features/audio/utils/effectsArchitecture');
            const mixer = await getOrCreateGlobalMixer();
            
            // Ensure channel exists
            if (!mixer.getChannel(track.id)) {
              mixer.createUserChannel(track.id, track.name ?? track.id);
            }
            
            // Update volume and pan
            mixer.setUserVolume(track.id, effectiveVolume);
            const channel = mixer.getChannel(track.id);
            if (channel?.toneChannel) {
              channel.toneChannel.pan.setValueAtTime(track.pan, mixer.getAudioContext().currentTime);
            }
          } catch (error) {
            console.warn('Failed to update audio track mixer settings', {
              trackId: track.id,
              error,
            });
          }
        })();
      }
    });

    // Clean up entries for removed tracks
    Object.keys(lastInstrumentKeyRef.current).forEach((trackId) => {
      if (!seenTrackIds.has(trackId)) {
        delete lastInstrumentKeyRef.current[trackId];
      }
    });
  }, [tracks]);
};

