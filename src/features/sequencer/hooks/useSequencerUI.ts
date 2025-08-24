import { useState, useCallback } from "react";
import { useSequencerStore } from "../stores/sequencerStore";
import type { EditMode, SequencerStep } from "../types";

interface UseSequencerUIProps {
  sequenceLength: number;
  defaultEditMode: EditMode;
}

export const useSequencerUI = ({ sequenceLength, defaultEditMode }: UseSequencerUIProps) => {
  const [selectedBeat, setSelectedBeat] = useState(0);
  const [editMode, setEditMode] = useState<EditMode>(defaultEditMode);
  
  // Get clipboard state and methods from store
  const { clipboard, clearClipboard: storeClearClipboard } = useSequencerStore();

  // Update selected beat with bounds checking
  const updateSelectedBeat = useCallback((beat: number) => {
    const clampedBeat = Math.max(0, Math.min(sequenceLength - 1, beat));
    setSelectedBeat(clampedBeat);
  }, [sequenceLength]);

  // Copy bank data to clipboard - now handled by store
  const copyBank = useCallback((steps: SequencerStep[]) => {
    // The store will handle the copying, we just need to call it with the current bank
    // This method signature is kept for compatibility but the actual work is done in the store
    console.log(`🎵 Copy request for ${steps.length} steps - handled by store`);
  }, []);

  // Paste bank data from clipboard - now handled by store
  const pasteBank = useCallback(() => {
    // The store will handle the pasting, we just need to call it with the current bank
    // This method signature is kept for compatibility but the actual work is done in the store
    console.log(`🎵 Paste request - handled by store`);
    return null; // Return null since the store handles the actual pasting
  }, []);

  // Clear clipboard - now handled by store
  const clearClipboard = useCallback(() => {
    storeClearClipboard();
  }, [storeClearClipboard]);

  // Reset all UI state (useful when entering new room)
  const resetUI = useCallback(() => {
    setSelectedBeat(0);
    setEditMode(defaultEditMode);
    // Note: clipboard is now managed by the store, so we don't need to reset it here
  }, [defaultEditMode]);

  return {
    // State
    selectedBeat,
    editMode,
    clipboard,
    
    // Actions
    setSelectedBeat: updateSelectedBeat,
    setEditMode,
    copyBank,
    pasteBank,
    clearClipboard,
    resetUI,
  };
}; 