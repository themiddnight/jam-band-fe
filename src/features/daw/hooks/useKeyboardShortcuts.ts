import { useCallback, useEffect } from 'react';

import { useHistoryStore } from '../stores/historyStore';
import { usePianoRollStore } from '../stores/pianoRollStore';
import { useProjectStore } from '../stores/projectStore';
import { useRegionStore } from '../stores/regionStore';
import { useDAWCollaborationContext } from '../contexts/useDAWCollaborationContext';

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
  const { handleRegionDelete, handleNoteDelete } = useDAWCollaborationContext();
  const selectedRegionIds = useRegionStore((state) => state.selectedRegionIds);

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

      if (hasCtrl && !event.shiftKey && event.key.toLowerCase() === 'w') {
        event.preventDefault();
        if (transportState === 'playing' || transportState === 'recording') {
          setTransportState('paused');
        } else {
          setTransportState(isRecording ? 'recording' : 'playing');
        }
      } else if (hasCtrl && !event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        toggleRecording();
      } else if (hasCtrl && !event.shiftKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        setPlayhead(0);
        setTransportState('stopped');
        if (isRecording) {
          toggleRecording(false);
        }
      } else if (hasCtrl && !event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setTransportState('stopped');
        setPlayhead(0);
        if (isRecording) {
          toggleRecording(false);
        }
      } else if (event.key === 'Escape') {
        setTransportState('stopped');
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNoteIds.length) {
          selectedNoteIds.forEach((noteId) => handleNoteDelete(noteId));
          event.preventDefault();
        } else if (selectedRegionIds.length) {
          selectedRegionIds.forEach((regionId) => handleRegionDelete(regionId));
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
      isRecording,
      isRedoAvailable,
      isUndoAvailable,
      redo,
      handleNoteDelete,
      handleRegionDelete,
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

