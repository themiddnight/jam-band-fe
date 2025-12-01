import { useState, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { useProjectStore } from '../stores/projectStore';
import { useRegionStore } from '../stores/regionStore';
import { AudioContextManager } from '@/features/audio/constants/audioConfig';
import { dawSyncService } from '../services/dawSyncService';
import { useUserStore } from '@/shared/stores/userStore';

export interface MixdownSettings {
  bitDepth: 16 | 24 | 32;
  sampleRate: 44100 | 48000 | 96000;
}

export interface MixdownProgress {
  currentTime: number;
  totalTime: number;
  percentage: number;
}

export const useMixdown = () => {
  const [isMixingDown, setIsMixingDown] = useState(false);
  const [progress, setProgress] = useState<MixdownProgress>({
    currentTime: 0,
    totalTime: 0,
    percentage: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const calculateProjectDuration = useCallback(() => {
    const regions = useRegionStore.getState().regions;
    const bpm = useProjectStore.getState().bpm;
    const secondsPerBeat = 60 / bpm;

    if (regions.length === 0) {
      return 0;
    }

    // Find the end of the last region
    let maxEndBeat = 0;
    regions.forEach((region) => {
      const regionEnd = region.start + region.length;
      if (regionEnd > maxEndBeat) {
        maxEndBeat = regionEnd;
      }
    });

    return maxEndBeat * secondsPerBeat;
  }, []);

  const startMixdown = useCallback(
    async (settings: MixdownSettings): Promise<Blob | null> => {
      // Guest users cannot mixdown
      const { isAuthenticated, userType } = useUserStore.getState();
      const isGuest = userType === "GUEST" || !isAuthenticated;
      if (isGuest) {
        const errorMessage = "Guest users cannot export mixdown. Please sign up to access this feature.";
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      setIsMixingDown(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      try {
        // Ensure Tone.js is ready
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }

        const audioContext = Tone.getContext().rawContext as AudioContext;
        const projectDuration = calculateProjectDuration();

        if (projectDuration === 0) {
          throw new Error('Project is empty - no regions to export');
        }

        // Add 1 second buffer at the end for reverb tails, etc.
        const totalDuration = projectDuration + 1;

        setProgress({
          currentTime: 0,
          totalTime: totalDuration,
          percentage: 0,
        });

        // Store original transport state
        const wasPlaying = Tone.Transport.state === 'started';
        const originalPlayhead = useProjectStore.getState().playhead;

        // Stop current playback
        if (wasPlaying) {
          Tone.Transport.stop();
          useProjectStore.getState().setTransportState('stopped');
        }

        // Pause incoming sync updates during mixdown
        // This prevents other users' changes from affecting the export
        dawSyncService.pauseSync();
        console.log('[Mixdown] Paused collaboration sync');

        // Create a destination node for capturing audio
        const destination = audioContext.createMediaStreamDestination();
        destinationRef.current = destination;

        // IMPORTANT: Disconnect from speakers and route ONLY to our capture destination
        // This prevents audio from playing during mixdown
        
        // Get the master bus which is the actual output point
        const masterBus = AudioContextManager.getMasterBus();
        
        if (masterBus) {
          // The master bus connects to context.destination
          // We need to disconnect it and connect to our capture destination instead
          const masterGain = masterBus.getMasterGain();
          
          // Disconnect from speakers
          masterGain.disconnect();
          
          // Connect ONLY to our capture destination
          masterGain.connect(destination);
          
          console.log('[Mixdown] Routed master bus to capture destination');
        } else {
          // Fallback: use Tone.js destination if no master bus
          const toneDestination = Tone.getDestination();
          toneDestination.disconnect();
          toneDestination.connect(destination);
          
          console.log('[Mixdown] Routed Tone destination to capture destination');
        }

        // Set up MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const mediaRecorder = new MediaRecorder(destination.stream, {
          mimeType,
          audioBitsPerSecond: settings.bitDepth === 16 ? 128000 : 256000,
        });
        mediaRecorderRef.current = mediaRecorder;

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        const recordingPromise = new Promise<Blob>((resolve, reject) => {
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            resolve(blob);
          };

          mediaRecorder.onerror = (event) => {
            reject(new Error('MediaRecorder error: ' + event));
          };
        });

        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms

        // Reset playhead to start
        useProjectStore.getState().setPlayhead(0);
        Tone.Transport.seconds = 0;

        // Start playback
        useProjectStore.getState().setTransportState('playing');
        Tone.Transport.start();

        // Monitor progress
        const startTime = Date.now();
        const progressInterval = setInterval(() => {
          if (abortControllerRef.current?.signal.aborted) {
            clearInterval(progressInterval);
            return;
          }

          const elapsed = (Date.now() - startTime) / 1000;
          const currentTime = Math.min(elapsed, totalDuration);
          const percentage = (currentTime / totalDuration) * 100;

          setProgress({
            currentTime,
            totalTime: totalDuration,
            percentage,
          });
        }, 100);

        // Wait for playback to complete
        await new Promise<void>((resolve) => {
          const checkComplete = () => {
            if (abortControllerRef.current?.signal.aborted) {
              resolve();
              return;
            }

            const currentTime = Tone.Transport.seconds;
            if (currentTime >= totalDuration) {
              resolve();
            } else {
              requestAnimationFrame(checkComplete);
            }
          };
          checkComplete();
        });

        clearInterval(progressInterval);

        // Stop recording
        Tone.Transport.stop();
        useProjectStore.getState().setTransportState('stopped');
        mediaRecorder.stop();

        // Wait for the recording to finalize
        const webmBlob = await recordingPromise;

        // Restore audio routing: disconnect from capture and reconnect to speakers
        const masterBusRestore = AudioContextManager.getMasterBus();
        
        if (masterBusRestore) {
          const masterGain = masterBusRestore.getMasterGain();
          masterGain.disconnect(destination);
          masterGain.connect(audioContext.destination); // Reconnect to speakers
          
          console.log('[Mixdown] Restored master bus to speakers');
        } else {
          // Fallback: restore Tone.js destination
          const toneDestination = Tone.getDestination();
          toneDestination.disconnect(destination);
          toneDestination.toDestination();
          
          console.log('[Mixdown] Restored Tone destination to speakers');
        }

        // Convert WebM to WAV
        const wavBlob = await convertToWav(
          webmBlob,
          settings.sampleRate,
          settings.bitDepth
        );

        // Resume sync and reload latest project state
        dawSyncService.resumeSync();
        console.log('[Mixdown] Resumed collaboration sync and requested latest state');

        // Restore original state
        useProjectStore.getState().setPlayhead(originalPlayhead);
        if (wasPlaying) {
          useProjectStore.getState().setTransportState('playing');
          Tone.Transport.start();
        }

        setIsMixingDown(false);
        return wavBlob;
      } catch (err) {
        console.error('Mixdown error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setIsMixingDown(false);

        // Clean up
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        if (destinationRef.current) {
          // Restore audio routing: disconnect from capture and reconnect to speakers
          const audioCtxCleanup = Tone.getContext().rawContext as AudioContext;
          const masterBusCleanup = AudioContextManager.getMasterBus();
          
          if (masterBusCleanup) {
            const masterGain = masterBusCleanup.getMasterGain();
            masterGain.disconnect(destinationRef.current);
            masterGain.connect(audioCtxCleanup.destination);
          } else {
            const toneDestination = Tone.getDestination();
            toneDestination.disconnect(destinationRef.current);
            toneDestination.toDestination();
          }
        }

        // Resume sync even on error
        dawSyncService.resumeSync();
        console.log('[Mixdown] Resumed collaboration sync after error');

        return null;
      }
    },
    [calculateProjectDuration]
  );

  const abortMixdown = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (destinationRef.current) {
      // Restore audio routing: disconnect from capture and reconnect to speakers
      const audioCtx = Tone.getContext().rawContext as AudioContext;
      const masterBusAbort = AudioContextManager.getMasterBus();
      
      if (masterBusAbort) {
        const masterGain = masterBusAbort.getMasterGain();
        masterGain.disconnect(destinationRef.current);
        masterGain.connect(audioCtx.destination);
      } else {
        const toneDestination = Tone.getDestination();
        toneDestination.disconnect(destinationRef.current);
        toneDestination.toDestination();
      }
    }

    Tone.Transport.stop();
    useProjectStore.getState().setTransportState('stopped');

    // Resume sync on abort
    dawSyncService.resumeSync();
    console.log('[Mixdown] Resumed collaboration sync after abort');

    setIsMixingDown(false);
    setError(null);
  }, []);

  return {
    isMixingDown,
    progress,
    error,
    startMixdown,
    abortMixdown,
  };
};

// Helper function to convert WebM to WAV
async function convertToWav(
  webmBlob: Blob,
  sampleRate: number,
  bitDepth: 16 | 24 | 32
): Promise<Blob> {
  const audioContext = new AudioContext({ sampleRate });
  const arrayBuffer = await webmBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create WAV file
  const wavBuffer = audioBufferToWav(audioBuffer, bitDepth);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

// Convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 24 | 32): ArrayBuffer {
  const numberOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numberOfChannels * (bitDepth / 8);
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // Write WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // format (1 = PCM, 3 = IEEE float)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numberOfChannels * (bitDepth / 8), true); // byte rate
  view.setUint16(32, numberOfChannels * (bitDepth / 8), true); // block align
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Write interleaved audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  const bytesPerSample = bitDepth / 8;

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = channels[channel][i];
      
      if (bitDepth === 16) {
        const s = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      } else if (bitDepth === 24) {
        const s = Math.max(-1, Math.min(1, sample));
        const val = Math.floor(s < 0 ? s * 0x800000 : s * 0x7fffff);
        view.setUint8(offset, val & 0xff);
        view.setUint8(offset + 1, (val >> 8) & 0xff);
        view.setUint8(offset + 2, (val >> 16) & 0xff);
      } else if (bitDepth === 32) {
        view.setFloat32(offset, sample, true);
      }
      
      offset += bytesPerSample;
    }
  }

  return arrayBuffer;
}
