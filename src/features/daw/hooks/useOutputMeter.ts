import { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { getOrCreateGlobalMixer } from '@/features/audio/utils/effectsArchitecture';
import { getTrackOutputNode } from '../utils/audioEngine';

// Store analysers per track to avoid recreating them
const trackAnalysers = new Map<string, AnalyserNode>();

// Threshold for updating state - only update if level changes by this amount
const LEVEL_UPDATE_THRESHOLD = 0.02; // 2% change required to trigger update

/**
 * Hook for monitoring track output level (works for both MIDI and audio tracks)
 * @param trackId - The track ID to monitor
 * @param enabled - Whether to enable monitoring
 * @returns Current output level (0-1)
 */
export const useOutputMeter = (trackId: string | null, enabled: boolean) => {
  const [level, setLevel] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const lastLevelRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!trackId || !enabled) {
      // Stop monitoring
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      lastLevelRef.current = 0;
      setLevel(0);
      analyserRef.current = null;
      return;
    }

    // Start monitoring
    const setupMonitoring = async () => {
      try {
        const audioContext = Tone.getContext().rawContext as AudioContext;
        
        // Get or create analyser for this track
        let analyser = trackAnalysers.get(trackId);
        
        if (!analyser) {
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.8;
          trackAnalysers.set(trackId, analyser);
          
          // Try to connect to the track output
          let connected = false;
          
          // First, try to get MIDI track output node (from audioEngine)
          const midiOutputNode = getTrackOutputNode(trackId);
          if (midiOutputNode) {
            try {
              // For MIDI tracks, tap into the pan node output
              // We need to insert the analyser without breaking the existing connection
              const splitter = audioContext.createGain();
              splitter.gain.value = 1.0;
              
              // Disconnect and reconnect through splitter
              midiOutputNode.disconnect();
              midiOutputNode.connect(splitter);
              splitter.connect(analyser);
              splitter.connect(audioContext.destination);
              connected = true;
            } catch (error) {
              console.warn('Failed to connect to MIDI track output:', error);
            }
          }
          
          // If not connected yet, try mixer channel (for audio tracks or as fallback)
          if (!connected) {
            try {
              const mixer = await getOrCreateGlobalMixer();
              let channel = mixer.getChannel(trackId);
              
              if (!channel) {
                // Create channel if it doesn't exist
                mixer.createUserChannel(trackId, `Track ${trackId}`);
                channel = mixer.getChannel(trackId);
              }
              
              if (channel && channel.toneChannel) {
                // Connect analyser to the Tone channel
                // Tone.Channel already has an analyser, but we'll create our own for consistency
                channel.toneChannel.connect(analyser as any);
                connected = true;
              }
            } catch (error) {
              console.warn('Failed to connect analyser to mixer channel:', error);
            }
          }
          
          if (!connected) {
            console.warn(`Could not connect output meter for track ${trackId}`);
          }
        }
        
        analyserRef.current = analyser;
        
        // Create buffer for frequency data
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // Update level at regular intervals (10 FPS for smooth meter)
        intervalRef.current = window.setInterval(() => {
          if (analyser) {
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate RMS (root mean square) for more accurate level representation
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const normalized = dataArray[i] / 255;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            
            // Apply some scaling to make the meter more responsive
            const newLevel = Math.min(1, rms * 2);
            
            // Only update state if the level has changed significantly
            const levelDiff = Math.abs(newLevel - lastLevelRef.current);
            if (levelDiff >= LEVEL_UPDATE_THRESHOLD || newLevel === 0) {
              lastLevelRef.current = newLevel;
              setLevel(newLevel);
            }
          }
        }, 100); // Update every 100ms (10 FPS)

      } catch (error) {
        console.error('Failed to setup output monitoring:', error);
      }
    };

    setupMonitoring();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [trackId, enabled]);

  return level;
};

/**
 * Cleanup function to disconnect and remove all track analysers
 * Call this when disposing the DAW or when tracks are removed
 */
export const cleanupOutputMeters = (trackId?: string) => {
  if (trackId) {
    const analyser = trackAnalysers.get(trackId);
    if (analyser) {
      try {
        analyser.disconnect();
      } catch {
        // Already disconnected
      }
      trackAnalysers.delete(trackId);
    }
  } else {
    // Cleanup all analysers
    trackAnalysers.forEach((analyser) => {
      try {
        analyser.disconnect();
      } catch {
        // Already disconnected
      }
    });
    trackAnalysers.clear();
  }
};
