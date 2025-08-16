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
  const originalStreamRef = useRef<MediaStream | null>(null); // Keep reference to original stream
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
      
      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach((track) => track.stop());
        originalStreamRef.current = null;
      }

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Request microphone with ultra-low latency constraints optimized for music
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false, // We'll handle gain manually
          sampleRate: 48000,      // Match WebRTC optimal sample rate
          channelCount: 1,        // Mono for lower latency
          latency: 0.01,          // Request 10ms latency (hardware dependent)
          // Ultra-low latency advanced constraints
          ...(navigator.userAgent.includes('Chrome') && {
            // Chrome-specific optimizations for music production
            googEchoCancellation: false,
            googNoiseSuppression: false,
            googHighpassFilter: false,
            googTypingNoiseDetection: false,
            googAutoGainControl: false,
            googNoiseSuppression2: false,
            googAudioMirroring: false,          // Disable audio mirroring
            googDAEchoCancellation: false,      // Disable delay agnostic echo cancellation
            googBeamforming: false,             // Disable beamforming for single source
            googArrayGeometry: false,           // Disable array geometry processing
            googAudioProcessing: false,         // Disable all audio processing
            googExperimentalEchoCancellation: false, // Disable experimental features
            googExperimentalNoiseSuppression: false,
            googExperimentalAutoGainControl: false,
          } as any),
        } as MediaTrackConstraints,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Store the original stream for cleanup
      originalStreamRef.current = stream;
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

      // Create a destination node to capture the processed audio
      const destination = audioContext.createMediaStreamDestination();

      // Connect the audio graph: source -> gain -> analyser -> destination
      source.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);
      gainNodeRef.current.connect(destination); // Also route to destination for WebRTC

      // Use the processed stream for WebRTC (includes gain processing)
      const processedStream = destination.stream;
      
      // Copy video tracks if any (shouldn't be any for audio-only, but just in case)
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => processedStream.addTrack(track));

      // Store the processed stream instead of the raw stream
      mediaStreamRef.current = processedStream;

      // Apply track constraints to the original stream's audio track for consistency
      const originalAudioTrack = stream.getAudioTracks()[0];
      if (originalAudioTrack) {
        // Apply constraints directly to the track for better performance
        originalAudioTrack.applyConstraints({
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }).catch(console.warn);
      }

      // Default to muted: disable the processed audio track until user explicitly unmutes
      try {
        const processedTrack = processedStream.getAudioTracks()[0];
        if (processedTrack) {
          processedTrack.enabled = false;
        }
      } catch {
        // ignore if no track available
      }

      // Notify parent about the processed stream (this is what gets sent to other users)
      onStreamReady?.(processedStream);

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
      console.log("🛑 Stopping processed media stream tracks");
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      onStreamRemoved?.();
    }
    
    if (originalStreamRef.current) {
      console.log("🛑 Stopping original media stream tracks");
      originalStreamRef.current.getTracks().forEach((track) => track.stop());
      originalStreamRef.current = null;
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
