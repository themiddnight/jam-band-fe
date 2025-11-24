import { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { getOrCreateUserMedia, isUserMediaAvailable } from '../utils/audioInput';
import { getOrCreateGlobalMixer } from '@/features/audio/utils/effectsArchitecture';

let meter: Tone.Meter | null = null;

// Threshold for updating state - only update if level changes by this amount
// This prevents unnecessary re-renders when the level is stable
const LEVEL_UPDATE_THRESHOLD = 0.02; // 2% change required to trigger update

export const useInputMonitoring = (
  trackId: string | null,
  showMeter: boolean,
  enableFeedback: boolean
) => {
  const [level, setLevel] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const lastLevelRef = useRef<number>(0);

  useEffect(() => {
    if (!trackId || !showMeter) {
      // Stop monitoring
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      lastLevelRef.current = 0;
      setLevel(0);
      return;
    }

    // Start monitoring
    const setupMonitoring = async () => {
      try {
        // Get shared UserMedia instance
        const userMedia = await getOrCreateUserMedia();

        // Initialize Meter if not already done
        if (!meter) {
          meter = new Tone.Meter({ normalRange: true, smoothing: 0.8 });
          userMedia.connect(meter);
        }

        // Update level at regular intervals
        // Reduced from 50ms (20 FPS) to 100ms (10 FPS) for better performance
        // 10 FPS is still smooth enough for VU meter visualization
        intervalRef.current = window.setInterval(() => {
          // Only update if mic is actually available and active
          if (meter && isUserMediaAvailable()) {
            const value = meter.getValue();
            const levelValue = typeof value === 'number' ? value : Math.max(...value);
            const newLevel = Math.max(0, Math.min(1, levelValue));
            
            // Only update state if the level has changed significantly
            // This prevents unnecessary re-renders when the level is stable
            const levelDiff = Math.abs(newLevel - lastLevelRef.current);
            if (levelDiff >= LEVEL_UPDATE_THRESHOLD || newLevel === 0) {
              lastLevelRef.current = newLevel;
              setLevel(newLevel);
            }
          } else {
            // Mic not available, set level to 0
            if (lastLevelRef.current !== 0) {
              lastLevelRef.current = 0;
              setLevel(0);
            }
          }
        }, 100); // Update every 100ms (10 FPS) - smooth enough for meter

      } catch (error) {
        console.error('Failed to setup input monitoring:', error);
      }
    };

    setupMonitoring();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [trackId, showMeter]);

  // Handle feedback monitoring (hearing yourself) through track's effect chain
  useEffect(() => {
    if (!trackId) {
      return;
    }

    let trackChannelRef: any = null;

    const setupFeedback = async () => {
      try {
        const userMedia = await getOrCreateUserMedia();
        const mixer = await getOrCreateGlobalMixer();

        if (enableFeedback) {
          // Get the track's channel which has the track-specific effect chain
          // For track effects, the channel ID is the track ID itself
          let trackChannel = mixer.getChannel(trackId);
          
          if (!trackChannel) {
            // Create the track channel if it doesn't exist
            mixer.createUserChannel(trackId, `Track ${trackId}`);
            trackChannel = mixer.getChannel(trackId);
          }
          
          if (trackChannel) {
            // Store reference for cleanup
            trackChannelRef = trackChannel.inputGain;
            
            // Connect to the track's channel input, which will route through effects
            try {
              userMedia.connect(trackChannel.inputGain);
              console.log(`🎤 Input monitoring connected through track ${trackId} effect chain`);
            } catch (error) {
              console.warn('Failed to connect to track channel, falling back to direct connection:', error);
              // Fallback: connect directly to destination
              userMedia.connect(Tone.getDestination());
              trackChannelRef = Tone.getDestination();
            }
          } else {
            // Fallback: connect directly to destination if channel creation failed
            userMedia.connect(Tone.getDestination());
            trackChannelRef = Tone.getDestination();
            console.log('🎤 Input monitoring connected directly (no effect chain)');
          }
        } else {
          // Disconnect only from output destinations, keep meter connected
          try {
            // Try to disconnect from destination
            userMedia.disconnect(Tone.getDestination());
          } catch {
            // Already disconnected, ignore
          }
        }
      } catch (error) {
        console.error('Failed to setup feedback monitoring:', error);
      }
    };

    setupFeedback();

    return () => {
      getOrCreateUserMedia().then((userMedia) => {
        try {
          // Disconnect only from the specific output, not from meter
          if (trackChannelRef) {
            userMedia.disconnect(trackChannelRef);
          } else {
            userMedia.disconnect(Tone.getDestination());
          }
        } catch {
          // Already disconnected, ignore
        }
      }).catch(() => {
        // Ignore errors on cleanup
      });
    };
  }, [trackId, enableFeedback]);

  return level;
};

