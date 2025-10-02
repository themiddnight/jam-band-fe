import { GainControl } from "./components";
import {
  useAudioStream,
  useInputLevelMonitoring,
  useVoiceControls,
} from "./hooks";
import { useVoiceStateStore } from "./stores/voiceStateStore";
import { RTCLatencyDisplay, AdaptiveAudioStatus } from "@/features/audio";
import { AnchoredPopup, Modal } from "@/features/ui";
import React, { useState, useRef, useEffect, useCallback } from "react";

interface VoiceInputProps {
  isVisible: boolean;
  onVoiceStateChange?: (state: VoiceState) => void;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamRemoved?: () => void;
  rtcLatency?: number | null;
  rtcLatencyActive?: boolean;
  userCount?: number;
  // New props for combined latency display
  browserAudioLatency?: number;
  meshLatency?: number | null;
  // Connection state props
  isConnecting?: boolean;
  connectionError?: boolean;
  onConnectionRetry?: () => void;
}

export interface VoiceState {
  isMuted: boolean;
  gain: number;
  inputLevel: number;
  isSelfMonitoring: boolean;
  isConnected: boolean;
  hasSeenHeadphoneModal: boolean;
  cleanMode: boolean;
  autoGain: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  isVisible,
  onVoiceStateChange,
  onStreamReady,
  onStreamRemoved,
  rtcLatency = null,
  rtcLatencyActive = false,
  userCount = 1,
  // New props for combined latency display
  browserAudioLatency,
  meshLatency,
  // Connection state props
  isConnecting = false,
  connectionError = false,
  onConnectionRetry,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [showHeadphoneModal, setShowHeadphoneModal] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);

  // Use custom hooks for state and logic
  const {
    voiceState,
    setMuted,
    setGain,
    setInputLevel,
    setSelfMonitoring,
    setConnected,
    setHasSeenHeadphoneModal,
    setCleanMode,
    setAutoGain,
  } = useVoiceStateStore();

  const {
    mediaStream,
    audioContext,
    gainNode,
    processedOutputNode,
    analyser,
    micPermission,
    initializeAudioStream,
    cleanup,
  } = useAudioStream({
    gain: voiceState.gain,
    cleanMode: voiceState.cleanMode,
    autoGain: voiceState.autoGain,
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
      monitorNode: processedOutputNode,
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

  // Handle mute/unmute toggle with state updates
  const handleMuteToggleWithState = useCallback(async () => {
    // Normal mute/unmute flow
    await handleMuteToggle();
    setMuted(!voiceState.isMuted);
  }, [
    handleMuteToggle,
    setMuted,
    voiceState.isMuted,
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

  // Handle clean mode toggle with modal logic
  const handleCleanModeToggle = useCallback(() => {
    // If trying to enable clean mode and haven't seen the headphone modal yet
    if (!voiceState.cleanMode && !voiceState.hasSeenHeadphoneModal) {
      setShowHeadphoneModal(true);
      return;
    }

    // Normal clean mode toggle
    setCleanMode(!voiceState.cleanMode);
  }, [
    voiceState.cleanMode,
    voiceState.hasSeenHeadphoneModal,
    setCleanMode,
  ]);

  // Handle auto gain toggle
  const handleAutoGainToggle = useCallback(() => {
    setAutoGain(!voiceState.autoGain);
  }, [voiceState.autoGain, setAutoGain]);

  // Handle proceed button from headphone modal (now for clean mode)
  const handleProceedCleanMode = useCallback(() => {
    setShowHeadphoneModal(false);

    // Mark that user has seen the modal
    setHasSeenHeadphoneModal(true);

    // Actually enable clean mode
    setCleanMode(true);
  }, [setCleanMode, setHasSeenHeadphoneModal]);

  // Handle cancel button from headphone modal
  const handleCancelCleanMode = useCallback(() => {
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
              <label className="label">
                <span className="text-xs">Input</span>
              </label>
              {/* Connection Status */}
              <div
                className={`w-2 h-2 rounded-full ${voiceState.isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
              {/* Clean Mode Status Icon */}
              {voiceState.cleanMode && (
                <div 
                  className="text-sm"
                  title="Clean Mode enabled - Ultra-low latency, no audio processing"
                >
                  🔥
                </div>
              )}
            </div>

            {/* RTC Latency Display */}
            <RTCLatencyDisplay
              latency={rtcLatency}
              isActive={rtcLatencyActive}
              showLabel={false}
              browserAudioLatency={browserAudioLatency}
              meshLatency={meshLatency}
              isConnecting={isConnecting}
              connectionError={connectionError}
              onRetry={onConnectionRetry}
            />

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
                <div className="text-xs mb-1">Input Lv</div>
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

            <div className="flex items-center gap-1">
              {/* Info Button */}
              <button
                ref={infoButtonRef}
                onClick={() => setIsInfoOpen(!isInfoOpen)}
                className="btn btn-sm btn-ghost hover:btn-info"
                title="Audio performance info"
              >
                ℹ️
              </button>

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

              {/* Clean Mode Toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Clean Mode</span>
                  <span className="text-xs text-base-content/60">Ultra-low latency, no processing</span>
                </div>
                <button
                  onClick={handleCleanModeToggle}
                  className={`btn btn-sm ${voiceState.cleanMode ? "btn-warning" : "btn-outline"}`}
                  title={
                    voiceState.cleanMode
                      ? "Disable clean mode (enable audio processing)"
                      : "Enable clean mode (disable audio processing)"
                  }
                >
                  {voiceState.cleanMode ? "🔥" : "🧹"}
                </button>
              </div>

              {/* Auto Gain Toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Auto Gain</span>
                  <span className="text-xs text-base-content/60">Browser automatic gain control</span>
                </div>
                <button
                  onClick={handleAutoGainToggle}
                  className={`btn btn-sm ${voiceState.autoGain ? "btn-success" : "btn-outline"}`}
                  title={
                    voiceState.autoGain
                      ? "Disable automatic gain control"
                      : "Enable automatic gain control"
                  }
                >
                  {voiceState.autoGain ? "🤖" : "👤"}
                </button>
              </div>

              {/* Professional Input Gain Control */}
              <div className="mb-4">
                <GainControl
                  gain={voiceState.gain}
                  onGainChange={handleGainChangeWithState}
                  disabled={!voiceState.isConnected || voiceState.autoGain}
                />
                {voiceState.autoGain && (
                  <p className="text-xs text-base-content/60 mt-1">
                    Manual gain control disabled when Auto Gain is enabled
                  </p>
                )}
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

          {/* Info Popup */}
          <AnchoredPopup
            open={isInfoOpen}
            onClose={() => setIsInfoOpen(false)}
            anchorRef={infoButtonRef}
            placement="bottom"
            className="w-96"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">🎵 Audio Performance</h4>
                <span className="text-xs text-base-content/60">
                  Real-time monitoring
                </span>
              </div>

              {/* Latency Breakdown */}
              <div className="mb-4 p-3 bg-base-200 rounded-lg">
                <h5 className="font-semibold text-sm mb-3">
                  Latency Breakdown
                </h5>
                <div className="space-y-2 text-sm">
                  {browserAudioLatency !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/70">
                        Audio Processing:
                      </span>
                      <span className="font-mono text-sm">
                        {browserAudioLatency}ms
                      </span>
                    </div>
                  )}
                  {meshLatency !== null && meshLatency !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/70">RTC Latency:</span>
                      <span className="font-mono text-sm">{meshLatency}ms</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/70">
                      Destination Processing Latency:
                    </span>
                    <span className="font-mono text-sm">+</span>
                  </div>
                  {browserAudioLatency !== undefined &&
                    meshLatency !== null &&
                    meshLatency !== undefined && (
                      <>
                        <div className="divider my-2"></div>
                        <div className="flex justify-between items-center font-semibold">
                          <span>Total Latency:</span>
                          <span className="font-mono text-sm">
                            {browserAudioLatency + meshLatency}ms+
                          </span>
                        </div>
                      </>
                    )}
                  {(browserAudioLatency === undefined ||
                    meshLatency === null ||
                    meshLatency === undefined) && (
                    <div className="text-center text-base-content/50 py-2">
                      {isConnecting ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="loading loading-spinner loading-xs"></div>
                          <span>Measuring latency...</span>
                        </div>
                      ) : connectionError ? (
                        <span>Connection error - unable to measure</span>
                      ) : !rtcLatencyActive ? (
                        <span>No active voice connections</span>
                      ) : (
                        <span>Latency data not available</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <AdaptiveAudioStatus
                userCount={userCount}
                currentLatency={rtcLatency}
                variant="compact"
                showRecommendations={true}
              />
            </div>
          </AnchoredPopup>
        </div>
      </div>

      {/* Headphone Recommendation Modal */}
      <Modal
        open={showHeadphoneModal}
        setOpen={setShowHeadphoneModal}
        title="🎧 Clean Mode - Headphone Recommendation"
        showCancelButton={true}
        showOkButton={true}
        okText="Enable Clean Mode"
        cancelText="Cancel"
        onOk={handleProceedCleanMode}
        onCancel={handleCancelCleanMode}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-base">
            You're about to enable <strong>Clean Mode</strong> for ultra-low latency audio. 
            We strongly recommend using headphones to prevent audio feedback. 🎧
          </p>

          <div className="bg-warning/10 p-4 rounded-lg border border-warning/20">
            <h5 className="font-semibold text-sm mb-2">⚠️ Clean Mode Effects:</h5>
            <ul className="text-sm space-y-1">
              <li>• Disables echo cancellation</li>
              <li>• Disables noise suppression</li>
              <li>• Raw audio for minimal latency</li>
              <li>• <strong>Higher risk of feedback without headphones</strong></li>
            </ul>
          </div>

          <div className="bg-info/10 p-4 rounded-lg">
            <h5 className="font-semibold text-sm mb-2">🎧 Why headphones help:</h5>
            <ul className="text-sm space-y-1">
              <li>• Prevents audio feedback loops</li>
              <li>• Clearer sound for everyone</li>
              <li>• Essential for clean mode operation</li>
            </ul>
          </div>

          <p className="text-sm text-base-content/70">
            Without headphones, Clean Mode may cause echo or feedback issues for other participants.
          </p>
        </div>
      </Modal>
    </>
  );
};

export default VoiceInput;
