import { useState, useCallback } from "react";

export interface VoiceState {
  isMuted: boolean;
  gain: number;
  inputLevel: number;
  isSelfMonitoring: boolean;
  isConnected: boolean;
  hasSeenHeadphoneModal: boolean; // Track if user has seen the headphone recommendation modal
  cleanMode: boolean; // When enabled, disables all audio processing for lowest latency
  autoGain: boolean; // When enabled, uses browser's automatic gain control
}

export const useVoiceStateStore = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isMuted: false, // Start muted by default
    gain: 1,
    inputLevel: 0,
    isSelfMonitoring: false,
    isConnected: false,
    hasSeenHeadphoneModal: false, // Start as false for new sessions
    cleanMode: false, // Start with clean mode disabled (normal processing)
    autoGain: false, // Start with auto gain disabled
  });

  const updateVoiceState = useCallback((updates: Partial<VoiceState>) => {
    setVoiceState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setMuted = useCallback(
    (isMuted: boolean) => {
      updateVoiceState({ isMuted });
    },
    [updateVoiceState],
  );

  const setGain = useCallback(
    (gain: number) => {
      updateVoiceState({ gain });
    },
    [updateVoiceState],
  );

  const setInputLevel = useCallback(
    (inputLevel: number) => {
      updateVoiceState({ inputLevel });
    },
    [updateVoiceState],
  );

  const setSelfMonitoring = useCallback(
    (isSelfMonitoring: boolean) => {
      updateVoiceState({ isSelfMonitoring });
    },
    [updateVoiceState],
  );

  const setConnected = useCallback(
    (isConnected: boolean) => {
      updateVoiceState({ isConnected });
    },
    [updateVoiceState],
  );

  const setHasSeenHeadphoneModal = useCallback(
    (hasSeen: boolean) => {
      updateVoiceState({ hasSeenHeadphoneModal: hasSeen });
    },
    [updateVoiceState],
  );

  const setCleanMode = useCallback(
    (cleanMode: boolean) => {
      updateVoiceState({ cleanMode });
    },
    [updateVoiceState],
  );

  const setAutoGain = useCallback(
    (autoGain: boolean) => {
      updateVoiceState({ autoGain });
    },
    [updateVoiceState],
  );

  return {
    voiceState,
    updateVoiceState,
    setMuted,
    setGain,
    setInputLevel,
    setSelfMonitoring,
    setConnected,
    setHasSeenHeadphoneModal,
    setCleanMode,
    setAutoGain,
  };
};
