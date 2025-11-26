import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import type { Socket } from 'socket.io-client';

interface UseBroadcastStreamOptions {
  socket: Socket | null;
  localVoiceStream?: MediaStream | null;
  enabled?: boolean;
}

/**
 * Hook for room owner to capture and stream audio to the backend for HLS broadcasting
 */
export function useBroadcastStream({
  socket,
  localVoiceStream,
  enabled = true,
}: UseBroadcastStreamOptions) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const localVoiceSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sequenceNumberRef = useRef(0);
  const chunkIntervalRef = useRef<number | null>(null);

  // Start broadcasting
  const startBroadcast = useCallback(async () => {
    if (!socket || !enabled) {
      setError('Socket not connected');
      return;
    }

    try {
      setIsStarting(true);
      setError(null);

      // Get the raw Web Audio API context from Tone.js
      const audioContext = Tone.getContext().rawContext as AudioContext;

      // Create a destination node to capture all audio
      const destination = audioContext.createMediaStreamDestination();
      destinationRef.current = destination;

      // Create a gain node to tap into the final output
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      gainNodeRef.current = gainNode;

      // Connect our gain node to the recording destination
      gainNode.connect(destination);

      // Get the master bus and connect it
      const { AudioContextManager } = await import('@/features/audio/constants/audioConfig');
      const masterBus = AudioContextManager.getMasterBus();

      if (masterBus) {
        const masterGain = masterBus.getMasterGain();

        // Disconnect master from speakers temporarily
        masterGain.disconnect();

        // Connect master to both our broadcast gain node AND speakers
        masterGain.connect(gainNode);
        masterGain.connect(audioContext.destination);

        console.log('📡 Broadcast: Connected to master bus');
      }

      // Connect local voice stream if available
      if (localVoiceStream) {
        try {
          const localVoiceSource = audioContext.createMediaStreamSource(localVoiceStream);
          localVoiceSourceRef.current = localVoiceSource;
          localVoiceSource.connect(gainNode);
          console.log('📡 Broadcast: Connected local voice stream');
        } catch (err) {
          console.warn('⚠️ Could not connect local voice stream:', err);
        }
      }

      // Create MediaRecorder for chunked streaming
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      let isFirstChunk = true;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socket.connected) {
          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            
            socket.emit('perform:broadcast_audio_chunk', {
              chunk: base64,
              timestamp: Date.now(),
              sequenceNumber: sequenceNumberRef.current++,
              isInitSegment: isFirstChunk, // First chunk contains WebM header
            });
            
            isFirstChunk = false;
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Start recording with 1000ms chunks (longer chunks work better with MSE)
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;

      // Notify backend to start broadcast
      socket.emit('perform:toggle_broadcast', { isBroadcasting: true });

      setIsBroadcasting(true);
      setIsStarting(false);

      console.log('📡 Broadcast started');
    } catch (err) {
      console.error('Failed to start broadcast:', err);
      setError('Failed to start broadcast');
      setIsStarting(false);
    }
  }, [socket, enabled, localVoiceStream]);

  // Stop broadcasting
  const stopBroadcast = useCallback(async () => {
    try {
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }

      // Clear chunk interval
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
      }

      // Cleanup audio nodes
      if (gainNodeRef.current && destinationRef.current) {
        const audioContext = Tone.getContext().rawContext as AudioContext;

        // Restore master bus to normal routing
        try {
          const { AudioContextManager } = await import('@/features/audio/constants/audioConfig');
          const masterBus = AudioContextManager.getMasterBus();

          if (masterBus && gainNodeRef.current) {
            const masterGain = masterBus.getMasterGain();
            masterGain.disconnect();
            masterGain.connect(audioContext.destination);
          }
        } catch (e) {
          console.warn('Failed to restore master bus routing:', e);
        }

        // Disconnect local voice source
        if (localVoiceSourceRef.current) {
          try {
            localVoiceSourceRef.current.disconnect();
            localVoiceSourceRef.current = null;
          } catch (e) {
            console.warn('Failed to disconnect local voice source:', e);
          }
        }

        // Disconnect gain node
        try {
          gainNodeRef.current.disconnect();
          gainNodeRef.current = null;
        } catch (e) {
          console.warn('Failed to disconnect gain node:', e);
        }

        destinationRef.current = null;
      }

      // Notify backend to stop broadcast
      if (socket?.connected) {
        socket.emit('perform:toggle_broadcast', { isBroadcasting: false });
      }

      setIsBroadcasting(false);
      sequenceNumberRef.current = 0;

      console.log('📡 Broadcast stopped');
    } catch (err) {
      console.error('Failed to stop broadcast:', err);
      setError('Failed to stop broadcast');
    }
  }, [socket]);

  // Toggle broadcast
  const toggleBroadcast = useCallback(() => {
    if (isBroadcasting) {
      stopBroadcast();
    } else {
      startBroadcast();
    }
  }, [isBroadcasting, startBroadcast, stopBroadcast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isBroadcasting) {
        stopBroadcast();
      }
    };
  }, [isBroadcasting, stopBroadcast]);

  // Listen for broadcast state changes from server
  useEffect(() => {
    if (!socket) return;

    const handleBroadcastStateChanged = (data: { isBroadcasting: boolean }) => {
      setIsBroadcasting(data.isBroadcasting);
    };

    socket.on('broadcast_state_changed', handleBroadcastStateChanged);

    return () => {
      socket.off('broadcast_state_changed', handleBroadcastStateChanged);
    };
  }, [socket]);

  return {
    isBroadcasting,
    isStarting,
    error,
    startBroadcast,
    stopBroadcast,
    toggleBroadcast,
  };
}
