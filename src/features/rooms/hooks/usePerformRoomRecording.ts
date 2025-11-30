import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

interface UsePerformRoomRecordingOptions {
  localVoiceStream?: MediaStream | null;
  onRecordingComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export function usePerformRoomRecording(options: UsePerformRoomRecordingOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const localVoiceSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const remoteVoiceSourcesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);
  const isRecordingRef = useRef<boolean>(false); // Track recording state for stream change handler
  const currentLocalStreamRef = useRef<MediaStream | null>(null); // Track current stream for comparison

  const startRecording = useCallback(async () => {
    try {
      // Get the raw Web Audio API context from Tone.js
      const audioContext = Tone.getContext().rawContext as AudioContext;
      
      // Create a destination node to capture all audio
      const destination = audioContext.createMediaStreamDestination();
      destinationRef.current = destination;

      // Create a gain node to tap into the final output
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0; // Unity gain (no change to volume)
      gainNodeRef.current = gainNode;

      // Connect our gain node to the recording destination
      gainNode.connect(destination);

      // Strategy: Tap into the audio context destination
      // We'll use the Web Audio API's ability to insert a node before the final destination
      
      // Get the master bus which everything connects to
      const { AudioContextManager } = await import('@/features/audio/constants/audioConfig');
      const masterBus = AudioContextManager.getMasterBus();
      
      if (masterBus) {
        const masterGain = masterBus.getMasterGain();
        
        console.log('🎙️ Recording: Tapping into master bus');
        
        // Disconnect master from speakers temporarily
        masterGain.disconnect();
        
        // Connect master to both our recording gain node AND speakers
        masterGain.connect(gainNode);
        masterGain.connect(audioContext.destination);
        
        console.log('✅ Recording connected to master bus (instruments + remote voice)');
      } else {
        console.warn('⚠️ Could not access master bus');
      }

      // Connect local voice stream if available
      if (options.localVoiceStream) {
        try {
          const localVoiceSource = audioContext.createMediaStreamSource(options.localVoiceStream);
          localVoiceSourceRef.current = localVoiceSource;
          localVoiceSource.connect(gainNode);
          currentLocalStreamRef.current = options.localVoiceStream;
          console.log('✅ Recording connected to local voice stream');
        } catch (error) {
          console.warn('⚠️ Could not connect local voice stream:', error);
        }
      }
      
      // IMPORTANT: Also capture remote voice audio elements directly
      // These might not be routed through the master bus if mixer setup failed
      const remoteVoiceElements = document.querySelectorAll<HTMLAudioElement>(
        'audio[data-webrtc-role="remote-voice"]'
      );
      
      console.log(`🎤 Found ${remoteVoiceElements.length} remote voice audio elements`);
      
      if (remoteVoiceElements.length > 0) {
        // Wait a bit for audio elements to be ready
        setTimeout(() => {
          remoteVoiceElements.forEach((audioElement) => {
            const userId = audioElement.getAttribute('data-webrtc-user');
            
            // Check if audio element has a stream
            if (audioElement.srcObject) {
              try {
                // Capture the stream from the audio element
                const stream = audioElement.srcObject as MediaStream;
                const source = audioContext.createMediaStreamSource(stream);
                remoteVoiceSourcesRef.current.push(source);
                source.connect(gainNode);
                console.log(`✅ Connected remote voice ${userId} to recording`);
              } catch {
                // This will fail if the audio element already has a MediaElementSource
                // which means it's routed through the mixer (good!)
                console.log(`ℹ️ Remote voice ${userId} already routed (via mixer)`);
              }
            }
          });
        }, 500); // Small delay to ensure audio elements are ready
      }
      
      // Debug: Log what we're capturing
      console.log('🎙️ Recording setup complete. Capturing:');
      console.log('  - Instruments (via master bus)');
      console.log('  - Remote voice (via master bus + direct fallback)');
      console.log('  - Local voice (direct connection)');
      console.log('  - All effects applied to above');

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          // Convert WebM to WAV
          const wavBlob = await convertToWav(webmBlob);
          options.onRecordingComplete?.(wavBlob);
          
          // Auto-download
          downloadWavFile(wavBlob);
        } catch (error) {
          console.error('Failed to convert recording:', error);
          options.onError?.(error as Error);
        }

        // Cleanup
        if (gainNodeRef.current && destinationRef.current) {
          try {
            const audioContext = Tone.getContext().rawContext as AudioContext;
            
            // Restore master bus to normal routing (disconnect from recording, keep speakers)
            (async () => {
              try {
                const { AudioContextManager } = await import('@/features/audio/constants/audioConfig');
                const masterBus = AudioContextManager.getMasterBus();
                
                if (masterBus && gainNodeRef.current) {
                  const masterGain = masterBus.getMasterGain();
                  
                  // Disconnect everything
                  masterGain.disconnect();
                  
                  // Reconnect only to speakers (normal operation)
                  masterGain.connect(audioContext.destination);
                  
                  console.log('✅ Restored master bus to normal routing');
                }
              } catch (e) {
                console.warn('Failed to restore master bus routing:', e);
              }
            })();
            
            // Disconnect local voice source
            if (localVoiceSourceRef.current) {
              try {
                localVoiceSourceRef.current.disconnect();
                localVoiceSourceRef.current = null;
              } catch (e) {
                console.warn('Failed to disconnect local voice source:', e);
              }
            }
            
            // Disconnect remote voice sources
            remoteVoiceSourcesRef.current.forEach((source) => {
              try {
                source.disconnect();
              } catch (e) {
                console.warn('Failed to disconnect remote voice source:', e);
              }
            });
            remoteVoiceSourcesRef.current = [];
            
            // Disconnect gain node
            gainNodeRef.current.disconnect(destinationRef.current);
            gainNodeRef.current = null;
          } catch (e) {
            console.warn('Failed to disconnect recording nodes:', e);
          }
          destinationRef.current = null;
        }
        audioChunksRef.current = [];
      };

      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      
      startTimeRef.current = Date.now();
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingDuration(0);

      // Update duration every second
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      options.onError?.(error as Error);
    }
  }, [options]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setIsRecording(false);
    isRecordingRef.current = false;
    currentLocalStreamRef.current = null;
  }, []);

  // ============================================================================
  // Handle local voice stream changes during recording (e.g., clean mode toggle)
  // ============================================================================
  useEffect(() => {
    // Only handle stream changes while recording
    if (!isRecordingRef.current || !gainNodeRef.current) return;
    
    const newStream = options.localVoiceStream;
    const currentStream = currentLocalStreamRef.current;
    
    // Check if stream actually changed (different object reference)
    if (newStream === currentStream) return;
    
    console.log('🔄 Local voice stream changed during recording, reconnecting...');
    
    // Disconnect old source if exists
    if (localVoiceSourceRef.current) {
      try {
        localVoiceSourceRef.current.disconnect();
        console.log('✅ Disconnected old local voice source');
      } catch (e) {
        console.warn('⚠️ Failed to disconnect old local voice source:', e);
      }
      localVoiceSourceRef.current = null;
    }
    
    // Connect new stream if available
    if (newStream && gainNodeRef.current) {
      try {
        const audioContext = Tone.getContext().rawContext as AudioContext;
        const newSource = audioContext.createMediaStreamSource(newStream);
        newSource.connect(gainNodeRef.current);
        localVoiceSourceRef.current = newSource;
        currentLocalStreamRef.current = newStream;
        console.log('✅ Connected new local voice stream to recording');
      } catch (error) {
        console.warn('⚠️ Could not connect new local voice stream:', error);
      }
    } else {
      currentLocalStreamRef.current = null;
    }
  }, [options.localVoiceStream]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}

// Convert WebM blob to WAV format (16-bit, 44.1kHz)
async function convertToWav(webmBlob: Blob): Promise<Blob> {
  const arrayBuffer = await webmBlob.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 44100 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Convert to 16-bit PCM WAV
  const wavBuffer = audioBufferToWav(audioBuffer, 16);
  await audioContext.close();

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

// Convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 24 | 32): ArrayBuffer {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = bitDepth === 32 ? 3 : 1; // 3 = float, 1 = PCM
  const bytesPerSample = bitDepth / 8;

  const length = buffer.length * numberOfChannels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  // Write audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = channels[channel][i];
      
      if (bitDepth === 16) {
        const s = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      } else if (bitDepth === 24) {
        const s = Math.max(-1, Math.min(1, sample));
        const val = s < 0 ? s * 0x800000 : s * 0x7fffff;
        view.setUint8(offset, val & 0xff);
        view.setUint8(offset + 1, (val >> 8) & 0xff);
        view.setUint8(offset + 2, (val >> 16) & 0xff);
        offset += 3;
      } else if (bitDepth === 32) {
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function downloadWavFile(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jam-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
