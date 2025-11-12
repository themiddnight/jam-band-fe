import { useEffect } from 'react';
import { useTrackStore } from '../stores/trackStore';
import { updateTrackAudioParams } from '../utils/audioEngine';

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
      if (track.type === 'midi') {
        // Calculate effective volume based on solo/mute
        let effectiveVolume = track.volume;
        
        // If any track is soloed, mute all non-soloed tracks
        if (hasSolo && !track.solo) {
          effectiveVolume = 0;
        }
        
        // If track is muted, set volume to 0
        if (track.mute) {
          effectiveVolume = 0;
        }
        
        // Create a modified track object with effective volume
        updateTrackAudioParams({
          ...track,
          volume: effectiveVolume,
        });
      }
    });
  }, [tracks]);
};

