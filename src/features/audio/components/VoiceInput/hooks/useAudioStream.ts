import { useRef, useCallback, useEffect } from "react";

interface UseAudioStreamProps {
  gain: number;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamRemoved?: () => void;
}

interface UseAudioStreamReturn {
  mediaStream: MediaStream | null;
  audioContext: AudioContext | null;
  gainNode: GainNode | null;
  analyser: AnalyserNode | null;
  micPermission: boolean;
  initializeAudioStream: () => Promise<void>;
  cleanup: () => void;
}

export const useAudioStream = ({
  gain,
  onStreamReady,
  onStreamRemoved,
}: UseAudioStreamProps): UseAudioStreamReturn => {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const micPermissionRef = useRef<boolean>(false);

  // Initialize audio context and stream
  const initializeAudioStream = useCallback(async () => {
    try {
      // Clean up any existing resources first
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Request microphone permission with optimized constraints for mixed instrument usage
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // We'll handle gain manually
          sampleRate: 48000,
          channelCount: 1,
          // Additional optimizations for Chrome/WebRTC (non-standard but widely supported)
          ...(navigator.userAgent.includes('Chrome') && {
            googEchoCancellation: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googTypingNoiseDetection: false, // Disable to reduce processing
            googAutoGainControl: false,
            googNoiseSuppression2: false, // Disable advanced processing to reduce CPU
          } as any),
        } as MediaTrackConstraints,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      mediaStreamRef.current = stream;
      micPermissionRef.current = true;

      // Use the separated WebRTC audio context instead of creating a new one
      try {
        const { AudioContextManager } = await import("../../../constants/audioConfig");
        audioContextRef.current = AudioContextManager.getWebRTCContext();
        console.log("🎤 VoiceInput: Using separated WebRTC AudioContext");
      } catch (error) {
        console.warn("Failed to get WebRTC AudioContext, creating fallback:", error);
        // Fallback: create own context
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: "interactive", // Prioritize low latency for real-time voice
        });
      }

      const audioContext = audioContextRef.current;
      
      const source = audioContext.createMediaStreamSource(stream);

      // Create analyser with optimized settings for mixed usage
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 512; // Reduced from 1024 to lower CPU usage
      analyserRef.current.smoothingTimeConstant = 0.8; // More stable, less reactive

      // Create gain node for input gain control
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.gain.value = gain;

      // Simplified audio graph to reduce processing overhead
      // Connect: source -> gain -> analyser (for monitoring only)
      source.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);

      // For WebRTC, we'll use a more efficient approach
      // Instead of creating a new stream, we'll apply gain directly to the original track
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        // Apply constraints directly to the track for better performance
        audioTrack.applyConstraints({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        }).catch(console.warn);
      }

      // Use the original stream for WebRTC (more efficient)
      mediaStreamRef.current = stream;

      // Default to muted: disable the audio track until user explicitly unmutes
      try {
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.enabled = false;
        }
      } catch {
        // ignore if no track available
      }

      // Notify parent about the stream
      onStreamReady?.(stream);

      console.log("🎤 Voice input initialized successfully with optimized processing");
    } catch (error) {
      console.error("Failed to initialize voice input:", error);
      // Reset states on error
      micPermissionRef.current = false;
      mediaStreamRef.current = null;
      audioContextRef.current = null;
      analyserRef.current = null;
      gainNodeRef.current = null;
    }
  }, [gain, onStreamReady]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 AudioStream hook cleaning up");
    if (mediaStreamRef.current) {
      console.log("🛑 Stopping media stream tracks");
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      onStreamRemoved?.();
    }
    
    // DON'T close the audioContext because it's shared via AudioContextManager
    // The AudioContextManager will handle context lifecycle
    console.log("🎤 Not closing shared WebRTC AudioContext (managed by AudioContextManager)");
    
    // Reset all refs to null after cleanup
    audioContextRef.current = null;
    analyserRef.current = null;
    gainNodeRef.current = null;
    micPermissionRef.current = false; // Reset mic permission state
  }, [onStreamRemoved]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    mediaStream: mediaStreamRef.current,
    audioContext: audioContextRef.current,
    gainNode: gainNodeRef.current,
    analyser: analyserRef.current,
    micPermission: micPermissionRef.current,
    initializeAudioStream,
    cleanup,
  };
};
