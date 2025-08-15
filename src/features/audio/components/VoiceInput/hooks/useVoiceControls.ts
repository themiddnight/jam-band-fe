import { useCallback } from "react";

interface UseVoiceControlsProps {
  audioContext: AudioContext | null; // Keep for future use
  gainNode: GainNode | null;
  mediaStream: MediaStream | null;
  micPermission: boolean;
  isMuted: boolean;
  isSelfMonitoring: boolean; // Keep for future use
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
  // audioContext, // Unused for now to maintain separation
  gainNode,
  mediaStream,
  micPermission,
  isMuted,
  // isSelfMonitoring, // Unused for now to maintain separation
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
    // IMPORTANT: For WebRTC voice, self-monitoring should NOT connect to audioContext.destination
    // because that would mix voice with instrument output and defeat the purpose of separated contexts.
    // 
    // Self-monitoring for WebRTC voice should be handled differently:
    // 1. Either through WebRTC's echo cancellation
    // 2. Or through a separate monitoring context
    // 3. Or by adjusting microphone monitoring at OS level
    
    console.log("🎤 Self-monitoring toggle requested, but disabled to maintain audio separation");
    console.log("💡 Use headphones or enable system microphone monitoring instead");
    
    // For now, we disable this feature to maintain clean audio separation
    // If you need self-monitoring, consider implementing it through a separate audio path
  }, []);

  // Original implementation (commented out to prevent audio mixing):
  /*
  const handleSelfMonitorToggle = useCallback(() => {
    if (gainNode && audioContext) {
      if (!isSelfMonitoring) {
        // This would mix voice with instruments - NOT ALLOWED in separated context mode
        gainNode.connect(audioContext.destination);
      } else {
        try {
          gainNode.disconnect(audioContext.destination);
        } catch {
          // Already disconnected
        }
      }
    }
  }, [gainNode, audioContext, isSelfMonitoring]);
  */

  return {
    handleMuteToggle,
    handleGainChange,
    handleSelfMonitorToggle,
  };
};
