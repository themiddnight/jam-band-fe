import { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { getOrCreateUserMedia, isUserMediaAvailable } from '../utils/audioInput';
import { getOrCreateGlobalMixer } from '@/features/audio/utils/effectsArchitecture';
import { useAudioDeviceStore } from '@/features/audio/stores/audioDeviceStore';

// Threshold for updating state - only update if level changes by this amount
const LEVEL_UPDATE_THRESHOLD = 0.02;

export const useInputMonitoring = (
  trackId: string | null,
  showMeter: boolean,
  enableFeedback: boolean
) => {
  const dawInputDeviceId = useAudioDeviceStore((state) => state.dawInputDeviceId);
  const [level, setLevel] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const lastLevelRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const meterSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    // Cleanup function helper
    const cleanupMonitoring = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (meterSourceRef.current && analyserRef.current) {
        try {
          meterSourceRef.current.disconnect(analyserRef.current);
        } catch { }
      }
      meterSourceRef.current = null;

      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch { }
        analyserRef.current = null;
      }
      lastLevelRef.current = 0;
      setLevel(0);
    };

    if (!trackId || !showMeter) {
      cleanupMonitoring();
      return;
    }

    const setupMonitoring = async () => {
      try {
        // Run cleanup first to ensure clean slate
        cleanupMonitoring();

        // Get MediaStreamAudioSourceNode with selected device
        const sourceNode = await getOrCreateUserMedia(dawInputDeviceId || undefined);
        meterSourceRef.current = sourceNode;

        // Create native AnalyserNode
        const context = Tone.getContext().rawContext as AudioContext;
        analyserRef.current = context.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;

        // Create data array for level detection
        dataArrayRef.current = new Uint8Array(analyserRef.current.fftSize);

        // Connect: source -> analyser
        sourceNode.connect(analyserRef.current);

        // Update level at regular intervals
        intervalRef.current = window.setInterval(() => {
          if (analyserRef.current && dataArrayRef.current && isUserMediaAvailable()) {
            // Get time domain data (byte values 0-255, 128 = silence)
            (analyserRef.current.getByteTimeDomainData as (array: Uint8Array) => void)(dataArrayRef.current);

            // Calculate RMS level from byte data
            let sum = 0;
            for (let i = 0; i < dataArrayRef.current.length; i++) {
              // Convert 0-255 to -1 to 1 range (128 = 0)
              const value = (dataArrayRef.current[i] - 128) / 128;
              sum += value * value;
            }
            const rms = Math.sqrt(sum / dataArrayRef.current.length);

            // Convert to 0-1 range
            const newLevel = Math.min(1, rms * 1.5);

            const levelDiff = Math.abs(newLevel - lastLevelRef.current);
            if (levelDiff >= LEVEL_UPDATE_THRESHOLD || newLevel === 0) {
              lastLevelRef.current = newLevel;
              setLevel(newLevel);
            }
          } else {
            if (lastLevelRef.current !== 0) {
              lastLevelRef.current = 0;
              setLevel(0);
            }
          }
        }, 100);

      } catch (error) {
        console.error('useInputMonitoring: Failed to setup input monitoring:', error);
      }
    };

    setupMonitoring();

    return cleanupMonitoring;
  }, [trackId, showMeter, dawInputDeviceId]);

  // Handle feedback monitoring (hearing yourself) through track's effect chain
  useEffect(() => {
    if (!trackId) {
      return;
    }

    let inputGainRef: GainNode | null = null;
    let sourceNodeRef: MediaStreamAudioSourceNode | null = null;

    const setupFeedback = async () => {
      try {
        const sourceNode = await getOrCreateUserMedia(dawInputDeviceId || undefined);
        sourceNodeRef = sourceNode;

        if (enableFeedback) {
          const mixer = await getOrCreateGlobalMixer();

          // Get the track's channel which has the track-specific effect chain
          let trackChannel = mixer.getChannel(trackId);

          if (!trackChannel) {
            // Create the track channel if it doesn't exist
            mixer.createUserChannel(trackId, `Track ${trackId}`);
            trackChannel = mixer.getChannel(trackId);
          }

          if (trackChannel) {
            // Connect to the track's channel input (GainNode), which will route through effects
            inputGainRef = trackChannel.inputGain;
            try {
              sourceNode.connect(trackChannel.inputGain);
            } catch (error) {
              console.warn('Failed to route monitoring to track channel:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to setup feedback monitoring:', error);
      }
    };

    setupFeedback();

    return () => {
      // Clean up connection
      if (sourceNodeRef && inputGainRef) {
        try {
          sourceNodeRef.disconnect(inputGainRef);
        } catch {
          // Already disconnected or invalid
        }
      }
      sourceNodeRef = null;
      inputGainRef = null;
    };
  }, [trackId, enableFeedback, dawInputDeviceId]);

  return level;
};
