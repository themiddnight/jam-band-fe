import { useState, useCallback, useEffect, useRef } from 'react';
import { usePerformRoomRecording } from "@/features/rooms/hooks/usePerformRoomRecording";
import { useSessionToCollab } from "@/features/rooms";
import type { SessionRecordingSnapshot } from "@/features/rooms";
import { useProjectSave } from "@/features/projects/hooks/useProjectSave";
import { convertSessionToProjectData } from "@/features/projects/utils/projectDataHelpers";
import { InstrumentCategory } from "@/shared/constants/instruments";

interface UseRoomRecordingManagerProps {
  currentRoom: any;
  currentUser: any;
  isAuthenticated: boolean;
  localStream: MediaStream | null;
  socket: any;
  voiceUsers: any[];
  bpm: number;
  currentCategory: InstrumentCategory;
  currentInstrument: string;
  synthState: any;
  isInstrumentMuted: boolean;
}

export const useRoomRecordingManager = ({
  currentRoom,
  currentUser,
  isAuthenticated,
  localStream,
  socket,
  voiceUsers,
  bpm,
  currentCategory,
  currentInstrument,
  synthState,
  isInstrumentMuted,
}: UseRoomRecordingManagerProps) => {
  
  // Audio recording functionality (existing - records mixed audio to WAV)
  const {
    isRecording: isAudioRecording,
    recordingDuration: audioRecordingDuration,
    toggleRecording: toggleAudioRecording
  } = usePerformRoomRecording({
    localVoiceStream: localStream,
    onRecordingComplete: () => {
      // Handle recording completion if needed
    },
    onError: (error) => {
      console.error('Audio recording error:', error);
    },
  });

  // Store snapshot for saving
  const [pendingSnapshot, setPendingSnapshot] = useState<SessionRecordingSnapshot | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Project save hook
  const {
    isSaving,
    savedProjectId,
    checkAndSave,
    clearSavedProject,
    showLimitModal,
    limitProjects,
    handleLimitModalClose,
    handleProjectDeleted,
    checkProjectLimit,
    setLimitProjectsAndShow,
  } = useProjectSave({
    roomId: currentRoom?.id,
    roomType: "perform",
    getProjectData: async () => {
      if (!pendingSnapshot) {
        throw new Error("No snapshot available");
      }
      return convertSessionToProjectData(pendingSnapshot);
    },
    onSaved: () => {
      setPendingSnapshot(null);
    },
  });

  // Wrapper for handleProjectDeleted that checks if we can proceed to save
  const handleProjectDeletedWrapper = useCallback(async () => {
    await handleProjectDeleted();
    // Check if we can now proceed to save
    const { isLimitReached } = await checkProjectLimit();
    if (!isLimitReached) {
      // Project limit not reached, show save modal
      handleLimitModalClose();
      setShowSaveModal(true);
    }
  }, [handleProjectDeleted, checkProjectLimit, handleLimitModalClose]);

  // Session to Collab recording (new - records MIDI + separate audio tracks)
  const handleSessionRecordingComplete = useCallback(async (snapshot: SessionRecordingSnapshot) => {
    if (!isAuthenticated) {
      // For guests, use the old download behavior
      const { saveSessionAsCollab } = await import("@/features/rooms");
      try {
        await saveSessionAsCollab(snapshot);
      } catch (error) {
        console.error('❌ Failed to save session:', error);
      }
      return;
    }

    // Store snapshot for saving
    setPendingSnapshot(snapshot);

    // Check project limit before showing save modal
    const { isLimitReached, projects } = await checkProjectLimit();
    if (isLimitReached) {
      // Show limit modal
      setLimitProjectsAndShow(projects);
      return;
    }

    // Project limit not reached, show save modal
    setShowSaveModal(true);
  }, [isAuthenticated, checkProjectLimit, setLimitProjectsAndShow]);

  // Clear saved project when leaving room
  useEffect(() => {
    return () => {
      clearSavedProject();
    };
  }, [clearSavedProject]);

  const {
    isRecording: isSessionRecording,
    recordingDuration: sessionRecordingDuration,
    toggleRecording: toggleSessionRecording,
    recordMidiEvent,
  } = useSessionToCollab({
    socket,
    currentRoom,
    currentUser,
    localVoiceStream: localStream,
    voiceUsers,
    bpm,
    ownerScale: currentRoom?.ownerScale,
    getCurrentUserSynthParams: () => {
      // Only return synth params if current category is Synthesizer
      if (currentCategory === InstrumentCategory.Synthesizer && synthState) {
        return synthState;
      }
      return null;
    },
    onRecordingComplete: handleSessionRecordingComplete,
    onError: (error) => {
      console.error('Session recording error:', error);
    },
  });

  // Combined recording state for UI
  const isRecording = isAudioRecording || isSessionRecording;
  const recordingDuration = isAudioRecording ? audioRecordingDuration : sessionRecordingDuration;

  // Ref to access recordMidiEvent in callbacks without re-renders
  const recordMidiEventRef = useRef(recordMidiEvent);
  useEffect(() => {
    recordMidiEventRef.current = recordMidiEvent;
  }, [recordMidiEvent]);

  const recordNoteEvent = useCallback(
    (
      notes: string[],
      velocity: number,
      type: "note_on" | "note_off" | "sustain_on" | "sustain_off"
    ) => {
      if (!isInstrumentMuted && currentUser && currentInstrument && currentCategory) {
        recordMidiEventRef.current(
          currentUser.id,
          currentUser.username,
          currentInstrument,
          currentCategory,
          notes,
          velocity,
          type
        );
      }
    },
    [isInstrumentMuted, currentUser, currentInstrument, currentCategory]
  );

  return {
    // Recording State
    isRecording,
    isAudioRecording,
    isSessionRecording,
    recordingDuration,
    
    // Actions
    toggleAudioRecording,
    toggleSessionRecording,
    recordNoteEvent,

    // Project Save State
    isSaving,
    savedProjectId,
    showSaveModal,
    setShowSaveModal,
    setPendingSnapshot,
    checkAndSave,
    
    // Project Limit Modal State
    showLimitModal,
    limitProjects,
    handleLimitModalClose,
    handleProjectDeletedWrapper,
  };
};
