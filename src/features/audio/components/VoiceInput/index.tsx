import { GainControl } from "./components";
import {
  useAudioStream,
  useInputLevelMonitoring,
  useVoiceControls,
} from "./hooks";
import { useVoiceStateStore } from "./stores/voiceStateStore";
import { RTCLatencyDisplay, AdaptiveAudioStatus } from "@/features/audio";
import { AnchoredPopup, Modal } from "@/features/ui";
import React, { useState, useRef, useEffect, useCallback, memo } from "react";

interface VoiceInputProps {
  isVisible: boolean;
  onVoiceStateChange?: (state: VoiceState) => void;
  onMuteStateChange?: (isMuted: boolean) => void;
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

const VoiceInputComponent: React.FC<VoiceInputProps> = ({
  isVisible,
  onVoiceStateChange,
  onMuteStateChange,
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
  const lastStoredInputLevelRef = useRef<number>(0);

  // Use Zustand store for state management
  const isMuted = useVoiceStateStore((state) => state.isMuted);
  const gain = useVoiceStateStore((state) => state.gain);
  const storedInputLevel = useVoiceStateStore((state) => state.inputLevel);
  const isSelfMonitoring = useVoiceStateStore((state) => state.isSelfMonitoring);
  const isConnected = useVoiceStateStore((state) => state.isConnected);
  const hasSeenHeadphoneModal = useVoiceStateStore((state) => state.hasSeenHeadphoneModal);
  const cleanMode = useVoiceStateStore((state) => state.cleanMode);
  const autoGain = useVoiceStateStore((state) => state.autoGain);

  const setMuted = useVoiceStateStore((state) => state.setMuted);
  const setGain = useVoiceStateStore((state) => state.setGain);
  const setInputLevel = useVoiceStateStore((state) => state.setInputLevel);
  const setSelfMonitoring = useVoiceStateStore((state) => state.setSelfMonitoring);
  const setConnected = useVoiceStateStore((state) => state.setConnected);
  const setHasSeenHeadphoneModal = useVoiceStateStore((state) => state.setHasSeenHeadphoneModal);
  const setCleanMode = useVoiceStateStore((state) => state.setCleanMode);
  const setAutoGain = useVoiceStateStore((state) => state.setAutoGain);

  // Create a voiceState object for compatibility with existing code
  const voiceState: VoiceState = React.useMemo(() => ({
    isMuted,
    gain,
    inputLevel: storedInputLevel,
    isSelfMonitoring,
    isConnected,
    hasSeenHeadphoneModal,
    cleanMode,
    autoGain,
  }), [
    isMuted,
    gain,
    storedInputLevel,
    isSelfMonitoring,
    isConnected,
    hasSeenHeadphoneModal,
    cleanMode,
    autoGain,
  ]);

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

  // Notify parent specifically when mute state changes
  useEffect(() => {
    onMuteStateChange?.(voiceState.isMuted);
  }, [voiceState.isMuted, onMuteStateChange]);

  // Update local state when input level changes
  // Use a ref to track the last value to avoid unnecessary updates
  useEffect(() => {
    // Only update if the value actually changed
    if (inputLevel !== lastStoredInputLevelRef.current) {
      lastStoredInputLevelRef.current = inputLevel;
      setInputLevel(inputLevel);
    }
  }, [inputLevel, setInputLevel]);

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

  /**
   * Connection status indicator logic:
   * - Red: Disconnected (no mic) or connection error
   * - Orange/Yellow: Connecting - mic is on but mesh not ready
   * - Green: Fully connected to mesh and ready to communicate
   * 
   * WebKit compatibility: Safari may not report latency stats accurately,
   * so we use userCount as a fallback indicator for mesh connectivity.
   */
  const getConnectionStatus = () => {
    // Error state - red
    if (connectionError) {
      return {
        color: "bg-red-500",
        pulse: false,
        tooltip: "Connection error - click retry or check your network",
      };
    }

    // Not connected at all - red
    if (!voiceState.isConnected) {
      return {
        color: "bg-red-500",
        pulse: false,
        tooltip: "Microphone not connected",
      };
    }

    // Mic connected but mesh is connecting - orange with pulse
    if (isConnecting) {
      return {
        color: "bg-orange-500",
        pulse: true,
        tooltip: "Connecting to voice mesh...",
      };
    }

    // WebKit fallback: If we have other users in the room and mic is connected,
    // assume we're connected even if latency measurement isn't working
    // (Safari often can't measure RTT but connection works fine)
    const hasOtherUsers = userCount > 1;

    // If RTC is active with measured latency - fully connected (green)
    if (rtcLatencyActive && meshLatency !== null && meshLatency !== undefined) {
      return {
        color: "bg-green-500",
        pulse: false,
        tooltip: `Connected to mesh (${meshLatency}ms latency) - ready to communicate`,
      };
    }

    // WebKit fallback: If we have other users and mic is on, show green
    // because communication is likely working even without latency stats
    if (hasOtherUsers && voiceState.isConnected && !voiceState.isMuted) {
      return {
        color: "bg-green-500",
        pulse: false,
        tooltip: `Connected to ${userCount - 1} user${userCount > 2 ? 's' : ''} - ready to communicate`,
      };
    }

    // Mic connected but no other users yet - yellow (waiting)
    if (!hasOtherUsers) {
      return {
        color: "bg-yellow-500",
        pulse: true,
        tooltip: "Waiting for other users to join...",
      };
    }

    // Mic connected and muted with other users - green but muted
    if (hasOtherUsers && voiceState.isMuted) {
      return {
        color: "bg-green-500",
        pulse: false,
        tooltip: `Connected (muted) - ${userCount - 1} user${userCount > 2 ? 's' : ''} in room`,
      };
    }

    // Fallback: Still connecting/measuring
    return {
      color: "bg-orange-500",
      pulse: true,
      tooltip: "Establishing connection...",
    };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <>
      <div className="card bg-base-100 shadow-lg grow">
        <div className="card-body p-3">
          <div className="flex flex-wrap justify-center items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="label">
                <span className="text-xs">Input</span>
              </label>
              {/* Connection Status Indicator */}
              <div
                className={`w-2 h-2 rounded-full ${connectionStatus.color} ${connectionStatus.pulse ? "animate-pulse" : ""}`}
                title={connectionStatus.tooltip}
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
            className="w-72"
          >
            <div className="p-4">
              <h4 className="font-semibold mb-5">Voice Settings</h4>

              {/* Clean Mode Toggle */}
              <div className="flex items-center justify-between mb-4 gap-3">
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
              <div className="flex items-center justify-between mb-4 gap-3">
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

// Memoize VoiceInput to prevent unnecessary re-renders
export default memo(VoiceInputComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.rtcLatency === nextProps.rtcLatency &&
    prevProps.rtcLatencyActive === nextProps.rtcLatencyActive &&
    prevProps.userCount === nextProps.userCount &&
    prevProps.browserAudioLatency === nextProps.browserAudioLatency &&
    prevProps.meshLatency === nextProps.meshLatency &&
    prevProps.isConnecting === nextProps.isConnecting &&
    prevProps.connectionError === nextProps.connectionError
    // onVoiceStateChange, onStreamReady, onStreamRemoved, onConnectionRetry are callbacks
    // They should be stable, but we don't compare them to avoid false positives
  );
});
