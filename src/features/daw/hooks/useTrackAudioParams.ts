import { useEffect } from 'react';
import { useTrackStore } from '../stores/trackStore';
import { trackInstrumentRegistry } from '../utils/trackInstrumentRegistry';

/**
 * Hook to sync track volume/pan/solo/mute changes to audio engine
 */
export const useTrackAudioParams = () => {
  const tracks = useTrackStore((state) => state.tracks);

  useEffect(() => {
    // Check if any track has solo enabled
    const hasSolo = tracks.some((t) => t.solo);
    
    // Update audio params for all MIDI tracks when volume/pan/solo/mute changes
    tracks.forEach((track) => {
      if (track.type !== 'midi') {
        return;
      }

      let effectiveVolume = track.volume;
      if ((hasSolo && !track.solo) || track.mute) {
        effectiveVolume = 0;
      }

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
    });
  }, [tracks]);
};

