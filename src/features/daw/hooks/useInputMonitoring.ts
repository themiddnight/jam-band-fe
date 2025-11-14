import { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { getOrCreateUserMedia } from '../utils/audioInput';

let meter: Tone.Meter | null = null;

export const useInputMonitoring = (
  trackId: string | null,
  showMeter: boolean,
  enableFeedback: boolean
) => {
  const [level, setLevel] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trackId || !showMeter) {
      // Stop monitoring
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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
        intervalRef.current = window.setInterval(() => {
          if (meter) {
            const value = meter.getValue();
            const levelValue = typeof value === 'number' ? value : Math.max(...value);
            setLevel(Math.max(0, Math.min(1, levelValue)));
          }
        }, 50); // Update every 50ms for smooth meter

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

  // Handle feedback monitoring (hearing yourself)
  useEffect(() => {
    if (!trackId) {
      return;
    }

    const setupFeedback = async () => {
      try {
        const userMedia = await getOrCreateUserMedia();

        if (enableFeedback) {
          // Connect to destination to hear yourself
          userMedia.connect(Tone.getDestination());
        } else {
          // Disconnect from destination
          try {
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
          userMedia.disconnect(Tone.getDestination());
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

