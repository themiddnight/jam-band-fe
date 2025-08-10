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

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // We'll handle gain manually
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      mediaStreamRef.current = stream;
      micPermissionRef.current = true;

      // Create audio context for monitoring and gain control
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: "interactive",
      });

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);

      // Create analyser for input level monitoring
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 1024;
      analyserRef.current.smoothingTimeConstant = 0.3; // More responsive

      // Create gain node for input gain control
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.gain.value = gain;

      // Connect audio graph: source -> gain -> analyser
      source.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);

      // Create a new stream with the gained audio for WebRTC
      const gainedStream = audioContext.createMediaStreamDestination();
      gainNodeRef.current.connect(gainedStream);

      // Replace the original stream with the gained stream
      const gainedMediaStream = gainedStream.stream;

      // Copy video tracks if any (shouldn't be any for audio-only)
      stream.getVideoTracks().forEach((track) => {
        gainedMediaStream.addTrack(track);
      });

      // Update the stream reference to use the gained stream
      mediaStreamRef.current = gainedMediaStream;

      // Default to muted: disable the audio track until user explicitly unmutes
      try {
        const track = gainedMediaStream.getAudioTracks()[0];
        if (track) {
          track.enabled = false;
        }
      } catch {
        // ignore if no track available
      }

      // Notify parent about the gained stream
      onStreamReady?.(gainedMediaStream);

      console.log("🎤 Voice input initialized successfully");
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
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      console.log("🔌 Closing audio context");
      audioContextRef.current.close().catch(console.error);
    }
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
