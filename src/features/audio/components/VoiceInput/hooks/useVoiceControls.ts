import { useCallback, useRef } from "react";

interface UseVoiceControlsProps {
  audioContext: AudioContext | null;
  gainNode: GainNode | null;
  monitorNode: AudioNode | null;
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
  monitorNode,
  mediaStream,
  micPermission,
  isMuted,
  isSelfMonitoring,
  initializeAudioStream,
  startInputLevelMonitoring,
  stopInputLevelMonitoring,
}: UseVoiceControlsProps): UseVoiceControlsReturn => {
  // Keep a reference to the monitoring connection
  const monitoringConnectionRef = useRef<{ node: AudioNode; gain: GainNode } | null>(null);

  // Handle mute/unmute toggle
  const handleMuteToggle = useCallback(async () => {
    const newMutedState = !isMuted;

    if (!newMutedState && (!micPermission || !mediaStream)) {
      // Unmuting but no stream available - initialize audio stream
      
      await initializeAudioStream();
      // The new stream will be created with track disabled, so we need to enable it
      // This will be handled by the effect in the parent component
    } else if (!newMutedState && micPermission && mediaStream) {
      // Already have permission and stream, just enable the track
      
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
      }
      startInputLevelMonitoring();
    } else if (newMutedState && mediaStream) {
      // Muting - disable track but don't destroy stream
      
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
    if (!audioContext || !monitorNode) {
      console.log(
        "🎤 Self-monitoring: No audio context or gain node available",
      );
      return;
    }

    try {
      if (!isSelfMonitoring) {
        // Enable self-monitoring: add monitoring connection to speakers
        // Create a monitoring gain node to control self-monitoring volume
        // This allows hearing yourself at the input gain level but with volume control
        if (monitoringConnectionRef.current) {
          try {
            monitoringConnectionRef.current.node.disconnect(
              monitoringConnectionRef.current.gain,
            );
          } catch {
            /* noop */
          }

          try {
            monitoringConnectionRef.current.gain.disconnect(
              audioContext.destination,
            );
          } catch {
            /* noop */
          }

          monitoringConnectionRef.current = null;
        }

        const monitoringGain = audioContext.createGain();
        monitoringGain.gain.value = 0.6; // Quieter to prevent feedback, but audible

        // Connect gain node to monitoring gain, then to speakers
        // This creates an additional path: gainNode -> monitoringGain -> destination (speakers)
        // The original path (gainNode -> analyser + WebRTC destination) remains intact
        monitorNode.connect(monitoringGain);
        monitoringGain.connect(audioContext.destination);

        // Store reference for cleanup
        monitoringConnectionRef.current = {
          node: monitorNode,
          gain: monitoringGain,
        };

        console.log(
          "✅ Self-monitoring enabled - you can now hear your own voice",
        );
      } else {
        // Disable self-monitoring: remove only the monitoring connection
        const monitoringConnection = monitoringConnectionRef.current;

        if (monitoringConnection) {
          try {
            monitoringConnection.node.disconnect(monitoringConnection.gain);
          } catch {
            /* noop */
          }

          try {
            monitoringConnection.gain.disconnect(audioContext.destination);
          } catch {
            /* noop */
          }

          monitoringConnectionRef.current = null;
        }
      }
    } catch (error) {
      console.error("❌ Error toggling self-monitoring:", error);
    }
  }, [audioContext, monitorNode, isSelfMonitoring]);

  return {
    handleMuteToggle,
    handleGainChange,
    handleSelfMonitorToggle,
  };
};
