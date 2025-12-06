import { useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { Socket } from "socket.io-client";
import { useSequencerStore } from "../stores/sequencerStore";
import { SequencerService } from "../services/SequencerService";
import { getSequencerWorker } from "../services/SequencerWorkerService";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { useRoomSocketContext } from "@/features/rooms/hooks/useRoomSocketContext";
import { useShallow } from "zustand/react/shallow";

// Sub-hooks
import { useSequencerBank } from "./useSequencerBank";
import { useSequencerLogic } from "./useSequencerLogic";
import { useSequencerSync } from "./useSequencerSync";
import { useSequencerPlayback } from "./useSequencerPlayback";
import { useSequencerActions } from "./useSequencerActions";

interface UseSequencerProps {
  socket?: Socket | null;
  currentCategory: string;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
}

/**
 * Normalizes the category for sequencer state management.
 * Melodic and Synthesizer share the same sequencer state.
 */
const normalizeSequencerCategory = (category: string): string => {
  // Both Melodic and Synthesizer use the same sequencer state
  if (category === InstrumentCategory.Synthesizer) {
    return InstrumentCategory.Melodic;
  }
  return category;
};

export const useSequencer = ({
  socket: propSocket,
  currentCategory,
  onPlayNotes,
  onStopNotes,
}: UseSequencerProps) => {
  const { socket: contextSocket } = useRoomSocketContext();
  const socket = propSocket ?? contextSocket;

  // Optimize store selection using useShallow
  const sequencerState = useSequencerStore(
    useShallow((state) => ({
      settings: state.settings,
      banks: state.banks,
      currentBank: state.currentBank,
      currentBeat: state.currentBeat,
      isPlaying: state.isPlaying,
      isRecording: state.isRecording,
      softStopRequested: state.softStopRequested,
      waitingForMetronome: state.waitingForMetronome,
      waitingBankChange: state.waitingBankChange,
      // Actions
      setActiveCategory: state.setActiveCategory,
      getTotalStepsCount: state.getTotalStepsCount,
      setCurrentBeat: state.setCurrentBeat,
      clearAllBanks: state.clearAllBanks,
    }))
  );
  
  // Shared refs
  const sequencerServiceRef = useRef<SequencerService | null>(null);
  const currentBPMRef = useRef(120);

  // Normalize category
  const normalizedCategory = normalizeSequencerCategory(currentCategory);
  const { setActiveCategory } = sequencerState;

  useLayoutEffect(() => {
    setActiveCategory(normalizedCategory);
  }, [normalizedCategory, setActiveCategory]);

  // 1. Bank Logic
  const {
    bankGenerationRef,
    handleBankSwitch,
    handleBankToggleEnabled,
    handleClearBank,
    copyBank,
    pasteBank
  } = useSequencerBank();

  // 2. Audio Logic (onPlayStep, onBeatChange)
  const {
    onBeatChange,
    onPlayStep,
    currentlyPlayingNotesRef,
    hasStartedPlayingRef
  } = useSequencerLogic({
    sequencerServiceRef,
    bankGenerationRef,
    currentBPMRef,
    onPlayNotes,
    onStopNotes
  });

  // 3. Sync & Service Initialization
  const {
    isInitialized,
    error,
    currentBPM,
    debouncedServiceUpdate
  } = useSequencerSync({
    socket,
    sequencerServiceRef,
    currentBPMRef,
    onBeatChange,
    onPlayStep,
    banks: sequencerState.banks,
    currentBank: sequencerState.currentBank,
    settings: sequencerState.settings
  });

  // 4. Playback Controls
  const {
    handlePlay,
    handleStop,
    handleSoftStop,
    handleCancelSoftStop,
    handleHardStop,
    handlePause,
    handleTogglePlayback
  } = useSequencerPlayback({
    sequencerServiceRef,
    isInitialized,
    currentlyPlayingNotesRef,
    hasStartedPlayingRef,
    onStopNotes
  });

  // 5. Actions (Steps, Settings, Recording, Presets)
  const {
    handleStepToggle,
    handleStepAdd,
    handleStepRemove,
    handleClearBeat,
    updateStep,
    handleSpeedChange,
    handleLengthChange,
    handleBankModeChange,
    handleDisplayModeChange,
    handleToggleRecording,
    handleRecordNote,
    handleSavePreset,
    handleLoadPreset
  } = useSequencerActions({
    debouncedServiceUpdate,
    currentBPMRef,
    currentCategory: normalizedCategory
  });

  // Utility functions wrapped in useCallback to maintain referential equality
  const getCurrentBankSteps = useCallback(() => {
    const state = useSequencerStore.getState();
    return state.banks[state.currentBank]?.steps || [];
  }, []);

  const getBeatSteps = useCallback((beat: number) => {
    const state = useSequencerStore.getState();
    return state.getStepsForBeat(state.currentBank, beat);
  }, []);

  const hasStepAt = useCallback((beat: number, note: string) => {
    const state = useSequencerStore.getState();
    return state.hasStepAtBeat(state.currentBank, beat, note);
  }, []);

  const getWorkerStats = useCallback(() => {
    return getSequencerWorker().getStats();
  }, []);

  return useMemo(() => ({
    // State
    isInitialized,
    error,
    currentBPM,
    settings: sequencerState.settings,
    banks: sequencerState.banks,
    currentBank: sequencerState.currentBank,
    currentBeat: sequencerState.currentBeat,
    isPlaying: sequencerState.isPlaying,
    isPaused: sequencerState.softStopRequested, // isPaused now means "soft stop requested"
    isRecording: sequencerState.isRecording,
    softStopRequested: sequencerState.softStopRequested,
    waitingForMetronome: sequencerState.waitingForMetronome,
    waitingBankChange: sequencerState.waitingBankChange,
    getTotalStepsCount: sequencerState.getTotalStepsCount,
    setCurrentBeat: sequencerState.setCurrentBeat,
    clearAllBanks: sequencerState.clearAllBanks,

    // Playback controls
    handlePlay,
    handleStop,
    handleSoftStop,
    handleCancelSoftStop,
    handleHardStop,
    handlePause,
    handleTogglePlayback,

    // Step management
    handleStepToggle,
    handleStepAdd,
    handleStepRemove,
    handleClearBeat,
    handleClearBank,
    updateStep,

    // Bank management
    handleBankSwitch,
    handleBankToggleEnabled,
    copyBank,
    pasteBank,

    // Settings
    handleSpeedChange,
    handleLengthChange,
    handleBankModeChange,
    handleDisplayModeChange,

    // Recording
    handleToggleRecording,
    handleRecordNote,

    // Presets
    handleSavePreset,
    handleLoadPreset,

    // Utility
    getCurrentBankSteps,
    getBeatSteps,
    hasStepAt,
    
    // Worker performance monitoring
    getWorkerStats,
  }), [
    // State dependencies
    isInitialized,
    error,
    currentBPM,
    sequencerState,
    
    // Handlers
    handlePlay,
    handleStop,
    handleSoftStop,
    handleCancelSoftStop,
    handleHardStop,
    handlePause,
    handleTogglePlayback,
    handleStepToggle,
    handleStepAdd,
    handleStepRemove,
    handleClearBeat,
    handleClearBank,
    updateStep,
    handleBankSwitch,
    handleBankToggleEnabled,
    copyBank,
    pasteBank,
    handleSpeedChange,
    handleLengthChange,
    handleBankModeChange,
    handleDisplayModeChange,
    handleToggleRecording,
    handleRecordNote,
    handleSavePreset,
    handleLoadPreset,
    
    // Utilities
    getCurrentBankSteps,
    getBeatSteps,
    hasStepAt,
    getWorkerStats
  ]);
};
