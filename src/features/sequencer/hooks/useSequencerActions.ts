import { useCallback } from "react";
import { useSequencerStore } from "../stores/sequencerStore";
import type { SequencerStep, SequencerSpeed, BankMode, DisplayMode } from "../types";
import type { MutableRefObject } from "react";

interface UseSequencerActionsProps {
  debouncedServiceUpdate: MutableRefObject<any>;
  currentBPMRef: MutableRefObject<number>;
  currentCategory: string;
}

export const useSequencerActions = ({
  debouncedServiceUpdate,
  currentBPMRef,
  currentCategory
}: UseSequencerActionsProps) => {
  
  // Step management functions
  const handleStepToggle = useCallback(
    (beat: number, note: string) => {
      const state = useSequencerStore.getState();
      state.toggleStep(state.currentBank, beat, note);
    },
    []
  );

  const handleStepAdd = useCallback(
    (beat: number, note: string, velocity?: number, gate?: number) => {
      const state = useSequencerStore.getState();
      state.addStep(state.currentBank, beat, note, velocity, gate);
    },
    []
  );

  const handleStepRemove = useCallback(
    (stepId: string) => {
      const state = useSequencerStore.getState();
      state.removeStep(state.currentBank, stepId);
    },
    []
  );

  const handleClearBeat = useCallback(
    (beat: number) => {
      const state = useSequencerStore.getState();
      state.clearBeat(state.currentBank, beat);
    },
    []
  );

  const updateStep = useCallback(
    (beat: number, note: string, updates: Partial<SequencerStep>) => {
      const state = useSequencerStore.getState();
      state.updateStep(state.currentBank, beat, note, updates);
    },
    []
  );

  // Settings functions
  const handleSpeedChange = useCallback(
    (speed: SequencerSpeed) => {
      const state = useSequencerStore.getState();
      state.setSpeed(speed);
      debouncedServiceUpdate.current(
        currentBPMRef.current,
        speed,
        state.settings.length
      );
    },
    [debouncedServiceUpdate, currentBPMRef]
  );

  const handleLengthChange = useCallback(
    (length: number) => {
      const state = useSequencerStore.getState();
      state.setLength(length);
      debouncedServiceUpdate.current(
        currentBPMRef.current,
        state.settings.speed,
        length
      );
    },
    [debouncedServiceUpdate, currentBPMRef]
  );

  const handleBankModeChange = useCallback(
    (mode: BankMode) => {
      useSequencerStore.getState().setBankMode(mode);
    },
    []
  );

  const handleDisplayModeChange = useCallback(
    (mode: DisplayMode) => {
      useSequencerStore.getState().setDisplayMode(mode);
    },
    []
  );

  // Recording functions
  const handleToggleRecording = useCallback(() => {
    useSequencerStore.getState().toggleRecording();
  }, []);

  const handleRecordNote = useCallback(
    (note: string, velocity?: number, gate?: number, isRealtime?: boolean) => {
      const state = useSequencerStore.getState();
      if (state.isRecording) {
        state.recordStep(note, velocity, gate, isRealtime);
      }
    },
    []
  );

  // Preset management functions
  const handleSavePreset = useCallback(
    (name: string) => {
      useSequencerStore.getState().savePreset(name, currentCategory);
    },
    [currentCategory]
  );

  const handleLoadPreset = useCallback(
    (presetId: string) => {
      useSequencerStore.getState().loadPreset(presetId);
    },
    []
  );

  return {
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
  };
};
