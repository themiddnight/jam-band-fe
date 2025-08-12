import {
  useAudioStream,
  useInputLevelMonitoring,
  useVoiceControls,
} from "./hooks";
import { useVoiceStateStore } from "./stores/voiceStateStore";
import { AnchoredPopup, Modal } from "@/features/ui";
import React, { useState, useRef, useEffect, useCallback } from "react";

interface VoiceInputProps {
  isVisible: boolean;
  onVoiceStateChange?: (state: VoiceState) => void;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamRemoved?: () => void;
}

export interface VoiceState {
  isMuted: boolean;
  gain: number;
  inputLevel: number;
  isSelfMonitoring: boolean;
  isConnected: boolean;
  hasSeenHeadphoneModal: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  isVisible,
  onVoiceStateChange,
  onStreamReady,
  onStreamRemoved,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHeadphoneModal, setShowHeadphoneModal] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  // Use custom hooks for state and logic
  const {
    voiceState,
    setMuted,
    setGain,
    setInputLevel,
    setSelfMonitoring,
    setConnected,
    setHasSeenHeadphoneModal,
  } = useVoiceStateStore();

  const {
    mediaStream,
    audioContext,
    gainNode,
    analyser,
    micPermission,
    initializeAudioStream,
    cleanup,
  } = useAudioStream({
    gain: voiceState.gain,
    onStreamReady,
    onStreamRemoved,
  });

  const { inputLevel, startInputLevelMonitoring, stopInputLevelMonitoring } =
    useInputLevelMonitoring({
      analyser,
      isConnected: voiceState.isConnected,
      isMuted: voiceState.isMuted, // Pass muted state
    });

  const { handleMuteToggle, handleGainChange, handleSelfMonitorToggle } =
    useVoiceControls({
      audioContext,
      gainNode,
      mediaStream,
      micPermission,
      isMuted: voiceState.isMuted,
      isSelfMonitoring: voiceState.isSelfMonitoring,
      initializeAudioStream,
      startInputLevelMonitoring,
      stopInputLevelMonitoring,
    });

  // Auto-connect mic on mount (when visible)
  useEffect(() => {
    if (!isVisible) return;

    // Auto-connect for better UX - users expect voice to work when joining
    (async () => {
      if (!voiceState.isConnected) {
        console.log(
          "🎤 VoiceInput: Auto-connecting voice for room participant",
        );
        await initializeAudioStream();
        setConnected(true);
        // The stream initializes with track disabled; keep state as muted without extra toggles
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  // Manual connect/disconnect actions
  const handleConnect = useCallback(async () => {
    if (!voiceState.isConnected) {
      await initializeAudioStream();
      setConnected(true);
      // Respect current mute state; do not auto-unmute
      if (!voiceState.isMuted) {
        startInputLevelMonitoring();
      }
    }
  }, [
    voiceState.isConnected,
    voiceState.isMuted,
    initializeAudioStream,
    setConnected,
    startInputLevelMonitoring,
  ]);

  const handleDisconnect = useCallback(() => {
    if (voiceState.isConnected) {
      cleanup();
      setConnected(false);
      // Don't force mute on disconnect - preserve user's preference
      // setMuted(true);
      stopInputLevelMonitoring();
      // Notify parent that stream was removed
      onStreamRemoved?.();
    }
  }, [
    voiceState.isConnected,
    cleanup,
    setConnected,
    stopInputLevelMonitoring,
    onStreamRemoved,
  ]);

  // Update parent component when voice state changes
  useEffect(() => {
    onVoiceStateChange?.(voiceState);
  }, [voiceState, onVoiceStateChange]);

  // Update local state when input level changes
  useEffect(() => {
    // Update input level in local state
    if (inputLevel !== voiceState.inputLevel) {
      setInputLevel(inputLevel);
    }
  }, [inputLevel, voiceState.inputLevel, setInputLevel]);

  // Update local state when connection status changes
  useEffect(() => {
    setConnected(!!mediaStream);
  }, [mediaStream, setConnected]);

  // Handle mute/unmute toggle with state updates and modal logic
  const handleMuteToggleWithState = useCallback(async () => {
    // If trying to unmute and haven't seen the headphone modal yet
    if (voiceState.isMuted && !voiceState.hasSeenHeadphoneModal) {
      setShowHeadphoneModal(true);
      return;
    }

    // Normal mute/unmute flow
    await handleMuteToggle();
    setMuted(!voiceState.isMuted);
  }, [
    handleMuteToggle,
    setMuted,
    voiceState.isMuted,
    voiceState.hasSeenHeadphoneModal,
  ]);

  // Handle new stream after unmuting (for reconnection cases)
  useEffect(() => {
    if (mediaStream && !voiceState.isMuted && voiceState.isConnected) {
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack && !audioTrack.enabled) {
        // Stream was just created and user wants it unmuted
        audioTrack.enabled = true;
        startInputLevelMonitoring();
      }
    }
  }, [
    mediaStream,
    voiceState.isMuted,
    voiceState.isConnected,
    startInputLevelMonitoring,
  ]);

  // Handle proceed button from headphone modal
  const handleProceedUnmute = useCallback(async () => {
    setShowHeadphoneModal(false);

    // Mark that user has seen the modal
    setHasSeenHeadphoneModal(true);

    // Actually unmute
    await handleMuteToggle();
    setMuted(false);
  }, [handleMuteToggle, setMuted, setHasSeenHeadphoneModal]);

  // Handle cancel button from headphone modal
  const handleCancelUnmute = useCallback(() => {
    setShowHeadphoneModal(false);
  }, []);

  // Handle gain adjustment with state updates
  const handleGainChangeWithState = useCallback(
    (newGain: number) => {
      handleGainChange(newGain);
      setGain(newGain);
    },
    [handleGainChange, setGain],
  );

  // Handle self-monitoring toggle with state updates
  const handleSelfMonitorToggleWithState = useCallback(() => {
    handleSelfMonitorToggle();
    setSelfMonitoring(!voiceState.isSelfMonitoring);
  }, [handleSelfMonitorToggle, setSelfMonitoring, voiceState.isSelfMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Don't render if not visible (for audience members)
  if (!isVisible) {
    return null;
  }

  // Get input level bar color based on level
  const getInputLevelColor = (level: number) => {
    if (level < 0.3) return "bg-green-500";
    if (level < 0.7) return "bg-yellow-500";
    if (level < 0.9) return "bg-red-500";
    return "bg-red-500";
  };

  return (
    <>
      <div className="card bg-base-100 shadow-lg grow">
        <div className="card-body p-3">
          <div className="flex flex-wrap justify-center items-center gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm">Input</p>
              {/* Connection Status */}
              <div
                className={`w-2 h-2 rounded-full ${voiceState.isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Mute/Unmute Toggle */}
              <button
                onClick={handleMuteToggleWithState}
                className={`btn btn-sm ${voiceState.isMuted ? "btn-error" : "btn-success"}`}
                title={
                  voiceState.isMuted ? "Unmute microphone" : "Mute microphone"
                }
              >
                {voiceState.isMuted ? "🔇" : "🎤"}
              </button>
            </div>

            <div className="flex items-center max-w-36 grow">
              {/* Input Level Indicator */}
              <div className="flex-1">
                <div className="text-xs mb-1">Input Level</div>
                <div className="w-full bg-base-300 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getInputLevelColor(inputLevel)}`}
                    style={{
                      // Use a logarithmic curve for the width
                      width: `${Math.min(
                        inputLevel > 0
                          ? (Math.log10(1 + 9 * inputLevel) / Math.log10(10)) *
                              100
                          : 0,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Settings Button */}
            <button
              ref={settingsButtonRef}
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="btn btn-sm btn-ghost"
              title="Voice settings"
            >
              ⚙️
            </button>
          </div>

          {/* Settings Popup */}
          <AnchoredPopup
            open={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            anchorRef={settingsButtonRef}
            placement="bottom"
            className="w-64"
          >
            <div className="p-4">
              <h4 className="font-semibold mb-5">Voice Settings</h4>

              {/* Input Gain Control */}
              <div className="flex items-center gap-2 mb-3">
                <div className="text-sm shrink-0">Gain</div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={voiceState.gain}
                  onChange={(e) =>
                    handleGainChangeWithState(Number(e.target.value))
                  }
                  className="range range-xs w-full"
                />
                <div className="text-xs mt-1 text-center">
                  {voiceState.gain.toFixed(2)}
                </div>
              </div>

              {/* Self-Monitor Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm">Self-Monitoring</span>
                <button
                  onClick={handleSelfMonitorToggleWithState}
                  className={`btn btn-sm ${voiceState.isSelfMonitoring ? "btn-info" : "btn-outline"}`}
                  title={
                    voiceState.isSelfMonitoring
                      ? "Disable self-monitoring"
                      : "Enable self-monitoring"
                  }
                >
                  {voiceState.isSelfMonitoring ? "🔊" : "🔈"}
                </button>
              </div>

              <div className="divider" />

              {/* Connect/Disconnect Controls */}
              <div className="flex items-center justify-between">
                <span className="text-sm">Voice Chat</span>
                <div className="form-control">
                  <label className="label cursor-pointer gap-2">
                    <span className="label-text text-xs">Enable</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-success toggle-sm"
                      checked={voiceState.isConnected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleConnect();
                        } else {
                          handleDisconnect();
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </AnchoredPopup>
        </div>
      </div>

      {/* Headphone Recommendation Modal */}
      <Modal
        open={showHeadphoneModal}
        setOpen={setShowHeadphoneModal}
        title="🎧 Headphone Recommendation"
        showCancelButton={true}
        showOkButton={true}
        okText="Proceed"
        cancelText="Cancel"
        onOk={handleProceedUnmute}
        onCancel={handleCancelUnmute}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-base">
            For the best sound, we recommend using headphones when you turn on
            your mic. 🎧
          </p>

          <div className="bg-info/10 p-4 rounded-lg">
            <ul className="text-sm space-y-1">
              <li>• Less chance of echo or feedback</li>
              <li>• Clearer sound for everyone</li>
            </ul>
          </div>

          <p className="text-sm text-base-content/70">
            No headphones? No worries — you can still continue, but sound might
            not be as good.
          </p>
        </div>
      </Modal>
    </>
  );
};

export default VoiceInput;
