import { useRef, useCallback, useEffect } from "react";
import { audioInputEffectsManager } from "@/features/audio/services/audioInputEffectsManager";

interface UseAudioStreamProps {
  gain: number;
  cleanMode: boolean;
  autoGain: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamRemoved?: () => void;
}

interface UseAudioStreamReturn {
  mediaStream: MediaStream | null;
  audioContext: AudioContext | null;
  gainNode: GainNode | null;
  processedOutputNode: AudioNode | null;
  analyser: AnalyserNode | null;
  micPermission: boolean;
  initializeAudioStream: () => Promise<void>;
  cleanup: () => void;
}

export const useAudioStream = ({
  gain,
  cleanMode,
  autoGain,
  onStreamReady,
  onStreamRemoved,
}: UseAudioStreamProps): UseAudioStreamReturn => {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const originalStreamRef = useRef<MediaStream | null>(null); // Keep reference to original stream
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const processedOutputNodeRef = useRef<AudioNode | null>(null);
  const micPermissionRef = useRef<boolean>(false);
  const isReinitializingRef = useRef<boolean>(false);
  const previousTrackEnabledRef = useRef<boolean>(false); // Track the previous enabled state

  // Initialize audio context and stream
  const initializeAudioStream = useCallback(async () => {
    // Prevent concurrent reinitializations
    if (isReinitializingRef.current) {
      console.log('🎤 Already reinitializing, skipping...');
      return;
    }
    
    isReinitializingRef.current = true;
    
    try {
      // Save the previous track enabled state before cleanup
      const wasPreviouslyEnabled = mediaStreamRef.current
        ? mediaStreamRef.current.getAudioTracks()[0]?.enabled ?? false
        : false;
      previousTrackEnabledRef.current = wasPreviouslyEnabled;
      
      // Clean up any existing resources first
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach((track) => track.stop());
        originalStreamRef.current = null;
      }

      audioInputEffectsManager.detachSource();

      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.disconnect();
        } catch {
          /* noop */
        }
        gainNodeRef.current = null;
      }

      processedOutputNodeRef.current = null;

      // Request microphone with ultra-low latency constraints based on clean mode
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: !cleanMode, // Enable processing when clean mode is off
          noiseSuppression: !cleanMode, // Enable processing when clean mode is off
          autoGainControl: autoGain, // Use browser auto gain when enabled
          sampleRate: 48000, // Match WebRTC optimal sample rate
          channelCount: 1, // Mono for lower latency
          latency: cleanMode ? 0.005 : 0.01, // Ultra-low latency: 5ms clean, 10ms normal (reduced from 10/20ms)
          // Advanced constraints based on clean mode
          ...(navigator.userAgent.includes("Chrome") &&
            ({
              // Chrome-specific ultra-low latency optimizations
              googEchoCancellation: !cleanMode,
              googNoiseSuppression: !cleanMode,
              googHighpassFilter: !cleanMode,
              googTypingNoiseDetection: !cleanMode,
              googAutoGainControl: autoGain,
              googNoiseSuppression2: !cleanMode,
              googAudioMirroring: false, // Always disable audio mirroring
              googDAEchoCancellation: !cleanMode,
              googBeamforming: !cleanMode,
              googArrayGeometry: !cleanMode,
              googAudioProcessing: !cleanMode, // Disable all processing in clean mode
              googExperimentalEchoCancellation: !cleanMode,
              googExperimentalNoiseSuppression: !cleanMode,
              googExperimentalAutoGainControl: autoGain,
              googExperimentalEchoCancellation3: !cleanMode, // Latest echo cancellation algorithm
              googDucking: false, // Disable auto-ducking for consistent volume
            } as any)),
        } as MediaTrackConstraints,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Store the original stream for cleanup
      originalStreamRef.current = stream;
      micPermissionRef.current = true;

      // Get the shared instrument audio context with ultra-low latency configuration
      try {
        const { AudioContextManager } = await import(
          "../../../constants/audioConfig"
        );
        audioContextRef.current = await AudioContextManager.getInstrumentContext();
        console.log(
          `🎤 Using shared instrument AudioContext (${audioContextRef.current.sampleRate}Hz, baseLatency: ${audioContextRef.current.baseLatency?.toFixed(4)}s)`,
        );
      } catch (error) {
        console.warn(
          "Failed to get instrument AudioContext, creating ultra-low latency fallback:",
          error,
        );
        // Fallback: Create dedicated ultra-low latency context for voice
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: "interactive", // Lowest latency hint available
        });
        console.log(
          `🎤 Created fallback AudioContext (${audioContextRef.current.sampleRate}Hz, baseLatency: ${audioContextRef.current.baseLatency?.toFixed(4)}s)`,
        );
      }

      const audioContext = audioContextRef.current;
      if (!audioContext) {
        throw new Error("AudioContext unavailable for voice input");
      }

      await audioInputEffectsManager.initialize(audioContext);

      const source = audioContext.createMediaStreamSource(stream);

      // Create analyser with ultra-low latency settings
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256; // Reduced from 512 for lower latency (128 frequency bins)
      analyserRef.current.smoothingTimeConstant = 0.6; // Faster response (reduced from 0.8)

      // Create gain node for input gain control
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.gain.value = gain;

      // Create a destination node to capture the processed audio
      const destination = audioContext.createMediaStreamDestination();

      // Build the processing graph: source -> gain -> effects -> analyser -> destination
      source.connect(gainNodeRef.current);

      audioInputEffectsManager.attachSource(gainNodeRef.current);
      const effectsOutputNode = audioInputEffectsManager.getOutputNode();

      try {
        effectsOutputNode.disconnect();
      } catch {
        // ignore if no previous connections
      }

      effectsOutputNode.connect(analyserRef.current);
      analyserRef.current.connect(destination);

      processedOutputNodeRef.current = effectsOutputNode;

      // Use the processed stream for WebRTC (includes local effects)
      const processedStream = destination.stream;

      // Copy video tracks if any (shouldn't be any for audio-only, but just in case)
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach((track) => processedStream.addTrack(track));

      // Store the processed stream instead of the raw stream
      mediaStreamRef.current = processedStream;

      // Apply track constraints to the original stream's audio track for consistency
      const originalAudioTrack = stream.getAudioTracks()[0];
      if (originalAudioTrack) {
        // Apply constraints directly to the track based on current settings
        originalAudioTrack
          .applyConstraints({
            echoCancellation: !cleanMode,
            noiseSuppression: !cleanMode,
            autoGainControl: autoGain,
          })
          .catch(console.warn);
      }

      // Set track enabled state based on previous state or default to disabled
      // This preserves the mute state when reinitializing due to settings changes
      try {
        const processedTrack = processedStream.getAudioTracks()[0];
        if (processedTrack) {
          processedTrack.enabled = previousTrackEnabledRef.current;
          console.log(`🎤 Set new track enabled state to: ${previousTrackEnabledRef.current}`);
        }
      } catch {
        // ignore if no track available
      }

      // Notify parent about the processed stream (this is what gets sent to other users)
      onStreamReady?.(processedStream);

      // Log latency metrics for monitoring
      console.log(
        `🎤 Voice input initialized - Clean Mode: ${cleanMode}, Latency: ${cleanMode ? "5ms" : "10ms"} target, Context Base Latency: ${audioContext.baseLatency?.toFixed(4)}s, Output Latency: ${audioContext.outputLatency?.toFixed(4)}s`,
      );
    } catch (error) {
      console.error("Failed to initialize voice input:", error);
      // Reset states on error
      micPermissionRef.current = false;
      mediaStreamRef.current = null;
      audioContextRef.current = null;
      analyserRef.current = null;
      gainNodeRef.current = null;
      processedOutputNodeRef.current = null;
      audioInputEffectsManager.detachSource();
    } finally {
      // Always reset the reinitializing flag
      isReinitializingRef.current = false;
    }
  }, [gain, cleanMode, autoGain, onStreamReady]);

  // Cleanup function
  const cleanup = useCallback(() => {
    
    if (mediaStreamRef.current) {
      
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      onStreamRemoved?.();
    }

    if (originalStreamRef.current) {
      
      originalStreamRef.current.getTracks().forEach((track) => track.stop());
      originalStreamRef.current = null;
    }

    audioInputEffectsManager.detachSource();

    // DON'T close the audioContext because it's shared via AudioContextManager
    // The AudioContextManager will handle context lifecycle
    console.log(
      "🎤 Not closing shared instrument AudioContext (managed by AudioContextManager)",
    );

    // Reset all refs to null after cleanup
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        /* noop */
      }
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    gainNodeRef.current = null;
    processedOutputNodeRef.current = null;
    micPermissionRef.current = false; // Reset mic permission state
  }, [onStreamRemoved]);

  // Update audio constraints when settings change by reinitializing the stream
  // This ensures constraints take effect immediately, especially on Chrome
  useEffect(() => {
    // Skip if already reinitializing or no active stream
    if (isReinitializingRef.current || !originalStreamRef.current || !micPermissionRef.current) {
      return;
    }
    
    // When cleanMode or autoGain changes, reinitialize the stream with new constraints
    // This is necessary because:
    // 1. Chrome doesn't always apply constraints immediately via applyConstraints()
    // 2. We need to recreate the entire audio processing graph with new settings
    // 3. The new stream will automatically replace tracks in peer connections
    console.log('🎤 Audio settings changed (cleanMode or autoGain), reinitializing stream...');
    initializeAudioStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanMode, autoGain]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    mediaStream: mediaStreamRef.current,
    audioContext: audioContextRef.current,
    gainNode: gainNodeRef.current,
    processedOutputNode: processedOutputNodeRef.current,
    analyser: analyserRef.current,
    micPermission: micPermissionRef.current,
    initializeAudioStream,
    cleanup,
  };
};
