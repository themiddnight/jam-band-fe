import { useCallback } from "react";

interface UseVoiceControlsProps {
  audioContext: AudioContext | null;
  gainNode: GainNode | null;
  mediaStream: MediaStream | null;
  micPermission: boolean;
  isMuted: boolean;
  isSelfMonitoring: boolean;
  initializeAudioStream: () => Promise<void>;
  startInputLevelMonitoring: () => void;
  stopInputLevelMonitoring: () => void;
}

interface UseVoiceControlsReturn {
  handleMuteToggle: () => Promise<void>;
  handleGainChange: (newGain: number) => void;
  handleSelfMonitorToggle: () => void;
}

export const useVoiceControls = ({
  audioContext,
  gainNode,
  mediaStream,
  micPermission,
  isMuted,
  isSelfMonitoring,
  initializeAudioStream,
  startInputLevelMonitoring,
  stopInputLevelMonitoring,
}: UseVoiceControlsProps): UseVoiceControlsReturn => {
  // Handle mute/unmute toggle
  const handleMuteToggle = useCallback(async () => {
    const newMutedState = !isMuted;

    if (!newMutedState && (!micPermission || !mediaStream)) {
      // Unmuting but no stream available - initialize audio stream
      console.log("🎤 Initializing audio stream for unmute");
      await initializeAudioStream();
      // The new stream will be created with track disabled, so we need to enable it
      // This will be handled by the effect in the parent component
    } else if (!newMutedState && micPermission && mediaStream) {
      // Already have permission and stream, just enable the track
      console.log("🔊 Enabling existing audio track");
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
      }
      startInputLevelMonitoring();
    } else if (newMutedState && mediaStream) {
      // Muting - disable track but don't destroy stream
      console.log("🔇 Disabling audio track (keeping stream alive)");
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
      }
      stopInputLevelMonitoring();
    }
  }, [
    isMuted,
    micPermission,
    mediaStream,
    initializeAudioStream,
    startInputLevelMonitoring,
    stopInputLevelMonitoring,
  ]);

  // Handle gain adjustment
  const handleGainChange = useCallback(
    (newGain: number) => {
      if (gainNode) {
        gainNode.gain.value = newGain;
      }
    },
    [gainNode],
  );

  // Handle self-monitoring toggle
  const handleSelfMonitorToggle = useCallback(() => {
    if (gainNode && audioContext) {
      if (!isSelfMonitoring) {
        // Connect to speakers for self-monitoring
        gainNode.connect(audioContext.destination);
      } else {
        // Disconnect from speakers
        try {
          gainNode.disconnect(audioContext.destination);
        } catch {
          // Already disconnected
        }
      }
    }
  }, [gainNode, audioContext, isSelfMonitoring]);

  return {
    handleMuteToggle,
    handleGainChange,
    handleSelfMonitorToggle,
  };
};
