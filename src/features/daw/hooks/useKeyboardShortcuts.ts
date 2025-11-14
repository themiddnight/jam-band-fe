import { useCallback, useEffect } from 'react';

import { useHistoryStore } from '../stores/historyStore';
import { usePianoRollStore } from '../stores/pianoRollStore';
import { useProjectStore } from '../stores/projectStore';
import { useRegionStore } from '../stores/regionStore';

const isEditableTarget = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') {
    return true;
  }
  if ((target as HTMLElement).isContentEditable) {
    return true;
  }
  return false;
};

export const useKeyboardShortcuts = () => {
  const transportState = useProjectStore((state) => state.transportState);
  const setTransportState = useProjectStore((state) => state.setTransportState);
  const isRecording = useProjectStore((state) => state.isRecording);
  const toggleRecording = useProjectStore((state) => state.toggleRecording);
  const setPlayhead = useProjectStore((state) => state.setPlayhead);

  const selectedNoteIds = usePianoRollStore((state) => state.selectedNoteIds);
  const deleteSelectedNotes = usePianoRollStore((state) => state.deleteSelectedNotes);

  const selectedRegionIds = useRegionStore((state) => state.selectedRegionIds);
  const removeRegion = useRegionStore((state) => state.removeRegion);
  const clearRegionSelection = useRegionStore((state) => state.clearSelection);

  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);
  const isUndoAvailable = useHistoryStore((state) => state.isUndoAvailable);
  const isRedoAvailable = useHistoryStore((state) => state.isRedoAvailable);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isEditableTarget(event)) {
        return;
      }

      const hasCtrl = event.ctrlKey || event.metaKey;

      if (hasCtrl && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        if (transportState === 'playing' || transportState === 'recording') {
          setTransportState('paused');
        } else {
          setTransportState(isRecording ? 'recording' : 'playing');
        }
      } else if (hasCtrl && !event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        toggleRecording();
      } else if (hasCtrl && !event.shiftKey && event.key === ',') {
        event.preventDefault();
        setPlayhead(0);
        setTransportState('stopped');
      } else if (event.key === 'Escape') {
        setTransportState('stopped');
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNoteIds.length) {
          deleteSelectedNotes();
          event.preventDefault();
        } else if (selectedRegionIds.length) {
          selectedRegionIds.forEach((regionId) => removeRegion(regionId));
          clearRegionSelection();
          event.preventDefault();
        }
      } else if (hasCtrl && !event.shiftKey && event.key.toLowerCase() === 'z') {
        if (isUndoAvailable) {
          undo();
          event.preventDefault();
        }
      } else if (hasCtrl && (event.shiftKey ? event.key.toLowerCase() === 'z' : event.key.toLowerCase() === 'y')) {
        if (isRedoAvailable) {
          redo();
          event.preventDefault();
        }
      }
    },
    [
      clearRegionSelection,
      deleteSelectedNotes,
      isRecording,
      isRedoAvailable,
      isUndoAvailable,
      redo,
      removeRegion,
      selectedNoteIds,
      selectedRegionIds,
      setPlayhead,
      setTransportState,
      toggleRecording,
      transportState,
      undo,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

