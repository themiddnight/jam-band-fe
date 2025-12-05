/* eslint-disable react-hooks/exhaustive-deps */
import { MidiStatus } from "@/features/audio";
import { VoiceInput } from "@/features/audio";
import { useWebRTCVoice } from "@/features/audio";
import {
  PingDisplay,
  usePingMeasurement,
  useCombinedLatency,
} from "@/features/audio";
import { ConnectionState } from "@/features/audio/types/connectionState";
import {
  InstrumentCategorySelector,
  InstrumentMute,
  useInstrumentMute,
} from "@/features/instruments";
import {
  LazyKeyboardWrapper as Keyboard,
  LazyGuitarWrapper as Guitar,
  LazyBassWrapper as Bass,
  LazyDrumpadWrapper as Drumpad,
  LazyDrumsetWrapper as Drumset,
  LazySynthControlsWrapper as SynthControls,
} from "@/features/instruments";
import { MetronomeControls } from "@/features/metronome";
import { StepSequencer } from "@/features/sequencer";
import { useSequencer } from "@/features/sequencer/hooks/useSequencer";
import { useSequencerStore } from "@/features/sequencer/stores/sequencerStore";

import { ChatBox, ApprovalWaiting } from "@/features/rooms";
import {
  RoomMembers,
  SwapInstrumentModal,
  KickUserModal,
  RoomSettingsModal,
} from "@/features/rooms";
import { useRoom, useBroadcastStream } from "@/features/rooms";
import { Footer } from "@/features/ui";
import { ScaleSlots } from "@/features/ui";
import { AnchoredPopup, Modal } from "@/features/ui";
import { useScaleSlotKeyboard } from "@/features/ui";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import { ControlType } from "@/shared/types";
import type { RoomUser } from "@/shared/types";
import { preloadCriticalComponents } from "@/shared/utils/componentPreloader";
import { getSafariUserMessage } from "@/shared/utils/webkitCompat";
import { useDeepLinkHandler } from "@/shared/hooks/useDeepLinkHandler";
import { getRoomContext } from "@/shared/analytics/context";
import { trackInviteSent } from "@/shared/analytics/events";
import { useNetworkAnalytics } from "@/shared/analytics/useNetworkAnalytics";
import { EffectsChainSection } from "@/features/effects";
import { useEffectsIntegration } from "@/features/effects/hooks/useEffectsIntegration";
import { usePerformRoomRecording } from "@/features/rooms/hooks/usePerformRoomRecording";
import { useSessionToCollab } from "@/features/rooms";
import type { SessionRecordingSnapshot } from "@/features/rooms";
import { SaveProjectModal } from "@/features/projects/components/SaveProjectModal";
import { ProjectLimitModal } from "@/features/projects/components/ProjectLimitModal";
import { useProjectSave } from "@/features/projects/hooks/useProjectSave";
import { convertSessionToProjectData } from "@/features/projects/utils/projectDataHelpers";
import { useMetronome } from "@/features/metronome/hooks/useMetronome";
import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as Tone from "tone";
import { useUserStore } from "@/shared/stores/userStore";

// Helper function to format recording duration
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Room page using the RoomSocketManager for namespace-based connections
 */
const PerformRoom = memo(() => {
  const navigate = useNavigate();
  const { isAuthenticated, userType } = useUserStore();
  const isRegisteredOrPremium = userType === "REGISTERED" || userType === "PREMIUM";
  // Instrument mute state (defined before useRoom)
  const { isMuted: isInstrumentMuted, setMuted: setInstrumentMuted } =
    useInstrumentMute(false);

  const {
    // Room state
    currentRoom,
    currentUser,

    error,

    // Connection state
    isConnected,
    isConnecting,
    connectionState,

    // UI state
    playingIndicators,
    fallbackNotification,
    showLeaveConfirmModal,
    setShowLeaveConfirmModal,

    // Instrument state
    currentInstrument,
    currentCategory,
    availableSamples,
    dynamicDrumMachines,
    isLoadingInstrument,
    isAudioContextReady,
    audioContextError,
    needsUserGesture,
    synthState,
    isSynthesizerLoaded,

    // Scale state
    scaleState,

    // MIDI controller
    midiController,

    // Handlers
    createPlayNoteHandler,
    handleStopNote,
    handleReleaseKeyHeldNote,
    handleSustainChange,
    // handleSustainToggleChange - using handleSustainChangeWithRecording instead
    handleApproveMember,
    handleRejectMember,
    handleLeaveRoom,
    handleLeaveRoomClick,
    handleLeaveRoomConfirm,
    clearFallbackNotification,
    sendChatMessage,

    // Instrument management
    handleInstrumentChange,
    handleCategoryChange,
    getCurrentInstrumentControlType,
    updateSynthParams,
    loadPresetParams,

    // Audio management
    stopSustainedNotes,
    initializeAudioContext,

    // Instrument swap and kick functions
    requestInstrumentSwap,
    approveInstrumentSwap,
    rejectInstrumentSwap,
    cancelInstrumentSwap,
    kickUser,
    onSwapRequestReceived,
    onSwapRequestSent,
    onSwapApproved,
    onSwapRejected,
    onSwapCancelled,
    onSwapCompleted,
    onUserKicked,

    // Sequencer snapshots
    requestSequencerState,
    sendSequencerState,
    onSequencerStateRequested,
    onSequencerStateReceived,

    // Scale follow handlers
    handleRoomOwnerScaleChange,
    handleToggleFollowRoomOwner,

    // Room settings
    handleUpdateRoomSettings,

    // Socket connection
    getActiveSocket,

    // Instrument manager
    instrumentManager,
  } = useRoom({ isInstrumentMuted });

  // All hooks must be called before any early returns
  // Get the current active socket directly instead of using a ref
  const activeSocket = getActiveSocket();
  const roomAnalyticsContext = useMemo(() => getRoomContext(currentRoom), [currentRoom]);

  const { currentPing } = usePingMeasurement({
    socket: activeSocket,
    enabled: isConnected,
  });

  // Deep link handler utilities
  const { generateInviteUrl } = useDeepLinkHandler();

  // Notification popup state
  const [isPendingPopupOpen, setIsPendingPopupOpen] = useState(false);
  const pendingBtnRef = useRef<HTMLButtonElement>(null);

  // WebRTC Voice Communication for room owner and band members
  const isVoiceEnabled = !!currentUser?.role;
  const canTransmitVoice =
    currentUser?.role === "room_owner" || currentUser?.role === "band_member";

  // WebRTC hook parameters
  const webRTCParams = {
    socket: activeSocket,
    currentUserId: currentUser?.id || "",
    currentUsername: currentUser?.username || "",
    roomId: currentRoom?.id || "",
    isEnabled: isVoiceEnabled,
    canTransmit: canTransmitVoice,
  };

  const {
    voiceUsers,
    localStream,
    addLocalStream,
    removeLocalStream,
    performIntentionalCleanup,
    peerConnections,
  } = useWebRTCVoice(webRTCParams);

  // Effects integration - connect effects UI to audio processing
  const { error: effectsError } = useEffectsIntegration({
    userId: currentUser?.id || "",
    enabled: !!(currentUser?.role === "room_owner" || currentUser?.role === "band_member") && isConnected,
  });

  // Handle effects initialization status
  useEffect(() => {
    if (effectsError) {
      console.error('🎛️ Effects integration error:', effectsError);
    }
  }, [effectsError]);

  // RTC latency measurement
  const {
    totalLatency: currentLatency,
    browserAudioLatency,
    meshLatency,
    isActive: rtcLatencyActive,
    addPeerConnection,
    removePeerConnection,
  } = useCombinedLatency({
    enabled: isVoiceEnabled,
  });

  useNetworkAnalytics({
    roomId: currentRoom?.id ?? null,
    roomType: currentRoom?.roomType ?? null,
    ping: currentPing ?? null,
    totalLatency: currentLatency ?? null,
    browserLatency: browserAudioLatency ?? null,
    meshLatency: meshLatency ?? null,
    isConnected,
  });

  // Track last seen peer ids to diff additions/removals
  const lastSeenPeerIdsRef = useRef<Set<string>>(new Set());


  // Copy room URL to clipboard with role selection
  const [isInvitePopupOpen, setIsInvitePopupOpen] = useState(false);
  const inviteBtnRef = useRef<HTMLButtonElement>(null);

  // Metronome for BPM
  const { bpm } = useMetronome({
    socket: activeSocket,
    canEdit: currentUser?.role === "room_owner" || currentUser?.role === "band_member",
  });

  // Sync BPM with Tone.js Transport and InstrumentEngine for LFO sync mode
  useEffect(() => {
    if (bpm > 0) {
      Tone.getTransport().bpm.value = bpm;
      // Update InstrumentEngine's LFO frequency when BPM changes
      instrumentManager.updateBPM(bpm);
    }
  }, [bpm, instrumentManager]);

  // Recording dropdown state
  const [isRecordingMenuOpen, setIsRecordingMenuOpen] = useState(false);
  const recordingBtnRef = useRef<HTMLButtonElement>(null);

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
    onSaved: (projectId) => {
      console.log("✅ Project saved:", projectId);
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
    socket: activeSocket,
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

  // Ref to access sequencer in callbacks without circular dependency
  const sequencerRef = useRef<ReturnType<typeof useSequencer> | null>(null);

  // Broadcast streaming for audience (room owner only)
  const {
    isBroadcasting,
    isStarting: isBroadcastStarting,
    toggleBroadcast,
  } = useBroadcastStream({
    socket: activeSocket,
    localVoiceStream: localStream,
    enabled: currentUser?.role === "room_owner",
  });

  // Instrument swap state
  const [pendingSwapTarget, setPendingSwapTarget] = useState<RoomUser | null>(
    null
  );
  const [swapRequestData, setSwapRequestData] = useState<{
    requester: RoomUser | null;
    isModalOpen: boolean;
  }>({
    requester: null,
    isModalOpen: false,
  });

  // Kick user state
  const [kickUserData, setKickUserData] = useState<{
    targetUser: RoomUser | null;
    isModalOpen: boolean;
  }>({
    targetUser: null,
    isModalOpen: false,
  });

  // Room settings state
  const [showRoomSettingsModal, setShowRoomSettingsModal] = useState(false);
  const [isUpdatingRoomSettings, setIsUpdatingRoomSettings] = useState(false);

  // Initialize scale slots store and apply selected slot
  const { initialize, getSelectedSlot } = useScaleSlotsStore();

  // Sync peer connections with RTC latency measurement
  useEffect(() => {
    const currentIds = new Set<string>();

    // Add or update current peer connections
    peerConnections.forEach((connection, userId) => {
      currentIds.add(userId);
      addPeerConnection(userId, connection);
    });

    // Remove peers that were present before but not anymore
    const lastSeen = lastSeenPeerIdsRef.current;
    lastSeen.forEach((id) => {
      if (!currentIds.has(id)) {
        removePeerConnection(id);
      }
    });

    lastSeenPeerIdsRef.current = currentIds;
  }, [peerConnections, addPeerConnection, removePeerConnection]);

  // Override the leave room handler to include WebRTC cleanup
  const handleLeaveRoomConfirmWithCleanup = useCallback(async () => {
    // Perform intentional WebRTC cleanup before leaving
    performIntentionalCleanup();
    // Call the original leave room handler
    await handleLeaveRoomConfirm();
  }, [performIntentionalCleanup, handleLeaveRoomConfirm]);

  // Memoize VoiceInput callbacks to prevent component recreation
  const handleStreamReady = useCallback(
    (stream: MediaStream) => {
      addLocalStream(stream);
    },
    [addLocalStream]
  );

  const handleStreamRemoved = useCallback(() => {
    removeLocalStream();
  }, [removeLocalStream]);

  // Wrapper function for note stop
  const handleStopNotesWrapper = useCallback(
    (notes: string[]) => {
      handleStopNote(notes);

      // Record note_off for session recording (for .collab export)
      if (!isInstrumentMuted && currentUser && currentInstrument && currentCategory) {
        recordMidiEventRef.current(
          currentUser.id,
          currentUser.username,
          currentInstrument,
          currentCategory,
          notes,
          0,
          "note_off"
        );
      }
    },
    [handleStopNote, isInstrumentMuted, currentUser, currentInstrument, currentCategory]
  );

  // Instrument swap handlers
  const handleSwapInstrument = useCallback(
    (targetUserId: string) => {
      const targetUser = currentRoom?.users.find(
        (user) => user.id === targetUserId
      );
      if (targetUser) {
        setPendingSwapTarget(targetUser);
        requestInstrumentSwap(targetUserId);
      }
    },
    [currentRoom?.users, requestInstrumentSwap]
  );

  const handleCancelSwap = useCallback(() => {
    setPendingSwapTarget(null);
    cancelInstrumentSwap();
  }, [cancelInstrumentSwap]);

  const handleApproveSwap = useCallback(() => {
    if (swapRequestData.requester) {
      approveInstrumentSwap(swapRequestData.requester.id);
    }
    setSwapRequestData({ requester: null, isModalOpen: false });
  }, [swapRequestData.requester, approveInstrumentSwap]);

  const handleRejectSwap = useCallback(() => {
    if (swapRequestData.requester) {
      rejectInstrumentSwap(swapRequestData.requester.id);
    }
    setSwapRequestData({ requester: null, isModalOpen: false });
  }, [swapRequestData.requester, rejectInstrumentSwap]);

  // Kick user handlers
  const handleKickUser = useCallback(
    (targetUserId: string) => {
      const targetUser = currentRoom?.users.find(
        (user) => user.id === targetUserId
      );
      if (targetUser) {
        setKickUserData({ targetUser, isModalOpen: true });
      }
    },
    [currentRoom?.users]
  );

  const handleConfirmKick = useCallback(() => {
    if (kickUserData.targetUser) {
      kickUser(kickUserData.targetUser.id);
    }
    setKickUserData({ targetUser: null, isModalOpen: false });
  }, [kickUserData.targetUser, kickUser]);

  const handleCancelKick = useCallback(() => {
    setKickUserData({ targetUser: null, isModalOpen: false });
  }, []);

  // Room settings handlers
  const handleOpenRoomSettings = useCallback(() => {
    setShowRoomSettingsModal(true);
  }, []);

  const handleCloseRoomSettings = useCallback(() => {
    setShowRoomSettingsModal(false);
  }, []);

  const handleSaveRoomSettings = useCallback(
    async (settings: {
      name: string;
      description: string;
      isPrivate: boolean;
      isHidden: boolean;
    }) => {
      setIsUpdatingRoomSettings(true);
      try {
        await handleUpdateRoomSettings(settings);
        // Modal will be closed by the component after successful save
      } catch (error) {
        console.error("Failed to update room settings:", error);
        // You could add a toast notification here
      } finally {
        setIsUpdatingRoomSettings(false);
      }
    },
    [handleUpdateRoomSettings]
  );

  // Enhanced note playing wrapper that also handles recording (respects mute state)
  // Defined before sequencer to avoid circular dependency
  const handlePlayNotesWithRecording = useCallback(
    (notes: string[], velocity: number, isKeyHeld: boolean) => {
      // Always play the note (respecting mute state)
      const playNoteHandler = createPlayNoteHandler(isInstrumentMuted);
      playNoteHandler(notes, velocity, "note_on", isKeyHeld);

      // Record to session recording if enabled (for .collab export)
      // Only record if NOT in practice mode (isInstrumentMuted)
      if (!isInstrumentMuted && currentUser && currentInstrument && currentCategory) {
        // Convert velocity from 0-1 range to MIDI 0-127 range
        const midiVelocity = Math.round(velocity * 127);
        recordMidiEventRef.current(
          currentUser.id,
          currentUser.username,
          currentInstrument,
          currentCategory,
          notes,
          midiVelocity,
          "note_on"
        );
      }

      // Also record to sequencer if recording is enabled
      const currentSequencer = sequencerRef.current;
      if (currentSequencer?.isRecording) {
        notes.forEach((note) => {
          // Determine if this is realtime recording (while sequencer is playing)
          const isRealtime = currentSequencer.isPlaying;
          currentSequencer.handleRecordNote(note, velocity, undefined, isRealtime);
        });
      }
    },
    [
      createPlayNoteHandler,
      isInstrumentMuted,
      currentUser,
      currentInstrument,
      currentCategory,
    ]
  );

  // Sequencer hook for recording integration
  // Use handlePlayNotesWithRecording to record sequencer notes
  const sequencer = useSequencer({
    socket: activeSocket,
    currentCategory,
    onPlayNotes: handlePlayNotesWithRecording,
    onStopNotes: handleStopNotesWrapper,
  });

  // Update sequencer ref when sequencer changes
  useEffect(() => {
    sequencerRef.current = sequencer;
  }, [sequencer]);

  // Get sequencer UI state from store
  const { settings, setSelectedBeat, setEditMode, resetUI } =
    useSequencerStore();

  // Wrapper for key release that also records note_off events
  const handleReleaseKeyHeldNoteWithRecording = useCallback(
    (note: string) => {
      // Call original handler
      handleReleaseKeyHeldNote(note);

      // Record note_off for session recording (for .collab export)
      if (!isInstrumentMuted && currentUser && currentInstrument && currentCategory) {
        recordMidiEventRef.current(
          currentUser.id,
          currentUser.username,
          currentInstrument,
          currentCategory,
          [note],
          0,
          "note_off"
        );
      }
    },
    [handleReleaseKeyHeldNote, isInstrumentMuted, currentUser, currentInstrument, currentCategory]
  );

  // Wrapper for sustain change that also records sustain events
  const handleSustainChangeWithRecording = useCallback(
    (sustained: boolean) => {
      // Call original handler
      handleSustainChange(sustained);

      // Record sustain event for session recording (for .collab export)
      if (!isInstrumentMuted && currentUser && currentInstrument && currentCategory) {
        recordMidiEventRef.current(
          currentUser.id,
          currentUser.username,
          currentInstrument,
          currentCategory,
          [],
          sustained ? 127 : 0,
          sustained ? "sustain_on" : "sustain_off"
        );
      }
    },
    [handleSustainChange, isInstrumentMuted, currentUser, currentInstrument, currentCategory]
  );

  // Memoize commonProps to prevent child component re-renders
  const commonProps = useMemo(
    () => ({
      scaleState: {
        rootNote: scaleState.rootNote,
        scale: scaleState.scale,
        getScaleNotes: scaleState.getScaleNotes,
      },
      onPlayNotes: handlePlayNotesWithRecording,
      onStopNotes: handleStopNotesWrapper,
      onStopSustainedNotes: stopSustainedNotes,
      onReleaseKeyHeldNote: handleReleaseKeyHeldNoteWithRecording,
      onSustainChange: handleSustainChangeWithRecording,
      onSustainToggleChange: handleSustainChangeWithRecording,
    }),
    [
      scaleState.rootNote,
      scaleState.scale,
      scaleState.getScaleNotes,
      handlePlayNotesWithRecording,
      handleStopNotesWrapper,
      stopSustainedNotes,
      handleReleaseKeyHeldNoteWithRecording,
      handleSustainChangeWithRecording,
    ]
  );

  // Preload critical components when component mounts
  useEffect(() => {
    preloadCriticalComponents();
  }, []);


  // Sequencer hook for recording integration
  useEffect(() => {
    const unsubscribeSwapRequestReceived = onSwapRequestReceived((data) => {
      // Find the requester user in current room
      const requesterUser = currentRoom?.users.find(
        (user) => user.id === data.requesterId
      );
      if (requesterUser) {
        setSwapRequestData({
          requester: requesterUser,
          isModalOpen: true,
        });
      }
    });

    const unsubscribeSwapRequestSent = onSwapRequestSent(() => {
      // Request was successfully sent - pending status is already set
    });

    const unsubscribeSwapApproved = onSwapApproved(() => {
      // Clear pending swap status - the swap will be executed
      setPendingSwapTarget(null);
    });

    const unsubscribeSwapRejected = onSwapRejected(() => {
      // Clear pending swap status
      setPendingSwapTarget(null);
    });

    const unsubscribeSwapCancelled = onSwapCancelled(() => {
      // Close swap modal if open
      setSwapRequestData({ requester: null, isModalOpen: false });
    });

    const unsubscribeSwapCompleted = onSwapCompleted(async (data) => {
      // Clear any pending states
      setPendingSwapTarget(null);
      setSwapRequestData({ requester: null, isModalOpen: false });

      const currentUserId = currentUser?.id;
      let myData = null;
      let otherData = null;

      if (data.userA.userId === currentUserId) {
        myData = data.userA;
        otherData = data.userB;
      } else if (data.userB.userId === currentUserId) {
        myData = data.userB;
        otherData = data.userA;
      }

      if (myData && otherData) {
        // Applying swap data for current user

        // Change instrument first
        await handleInstrumentChange(myData.instrumentName);

        // Apply synth parameters if provided
        if (myData.synthParams && Object.keys(myData.synthParams).length > 0) {
          setTimeout(async () => {
            try {
              await updateSynthParams(myData.synthParams);
            } catch (error) {
              console.error("❌ Failed to apply synth parameters:", error);
            }
          }, 100);
        }

        // Request sequencer snapshot from the other user
        if (otherData.userId) {
          requestSequencerState(otherData.userId);
        }
      }
    });

    // When someone requests our sequencer state, send them a snapshot
    const unsubscribeSequencerRequested = onSequencerStateRequested(
      ({ requesterId }: { requesterId: string }) => {
        try {
          const snapshot = {
            banks: useSequencerStore.getState().banks,
            settings: useSequencerStore.getState().settings,
            currentBank: useSequencerStore.getState().currentBank,
          };

          sendSequencerState(requesterId, snapshot);
        } catch (e) {
          console.error("❌ Failed to capture/send sequencer snapshot:", e);
        }
      }
    );

    // When we receive a snapshot, apply it
    const unsubscribeSequencerReceived = onSequencerStateReceived(
      ({
        snapshot,
      }: {
        snapshot: { banks: any; settings: any; currentBank: string };
      }) => {
        try {
          // Stop if playing, then load snapshot, and reset beat to 0
          if (sequencer.isPlaying) {
            useSequencerStore.getState().hardStop();
          }
          useSequencerStore.setState({
            banks: snapshot.banks,
            settings: snapshot.settings,
            currentBeat: 0,
            selectedBeat: 0,
            currentBank: snapshot.currentBank,
          });
        } catch (e) {
          console.error("❌ Failed to apply sequencer snapshot:", e);
        }
      }
    );

    const unsubscribeUserKicked = onUserKicked((data) => {
      // Redirect immediately to lobby and pass reason in state
      navigate("/", { state: { kicked: true, reason: data.reason } });
    });

    return () => {
      unsubscribeSwapRequestReceived();
      unsubscribeSwapRequestSent();
      unsubscribeSwapApproved();
      unsubscribeSwapRejected();
      unsubscribeSwapCancelled();
      unsubscribeSwapCompleted();
      unsubscribeSequencerRequested();
      unsubscribeSequencerReceived();
      unsubscribeUserKicked();
    };
  }, [
    onSwapRequestReceived,
    onSwapRequestSent,
    onSwapApproved,
    onSwapRejected,
    onSwapCancelled,
    onSwapCompleted,
    onUserKicked,
    currentRoom?.users,
    currentUser?.id,
    handleInstrumentChange,
    updateSynthParams,
    requestSequencerState,
    onSequencerStateRequested,
    sendSequencerState,
    onSequencerStateReceived,
    sequencer,
  ]);

  // Reset sequencer UI state when entering a new room
  useEffect(() => {
    if (currentRoom) {
      resetUI();
    }
  }, [currentRoom?.id, resetUI]);

  // Initialize scale slots on first load
  useEffect(() => {
    initialize();
    const selectedSlot = getSelectedSlot();
    if (selectedSlot) {
      // Only apply the selected slot if it's different from current state
      if (
        scaleState.rootNote !== selectedSlot.rootNote ||
        scaleState.scale !== selectedSlot.scale
      ) {
        scaleState.setRootNote(selectedSlot.rootNote);
        scaleState.setScale(selectedSlot.scale);
      }
    }
  }, [initialize, getSelectedSlot, scaleState]);

  // Initialize room owner's scale in backend when room owner joins
  useEffect(() => {
    // Only run for room owners and when connected to room
    if (
      currentUser?.role === "room_owner" &&
      isConnected &&
      scaleState.rootNote &&
      scaleState.scale &&
      connectionState === ConnectionState.IN_ROOM
    ) {
      // Check if room doesn't have owner scale set yet
      if (!currentRoom?.ownerScale) {
        // Initializing room owner scale in backend
        handleRoomOwnerScaleChange(scaleState.rootNote, scaleState.scale);
      }
    }
  }, [
    currentUser?.role,
    isConnected,
    connectionState,
    scaleState.rootNote,
    scaleState.scale,
    currentRoom?.ownerScale,
    handleRoomOwnerScaleChange,
  ]);

  // Setup scale slot keyboard shortcuts
  useScaleSlotKeyboard((rootNote, scale) => {
    scaleState.setRootNote(rootNote);
    scaleState.setScale(scale);

    // If user is room owner, broadcast the scale change
    if (currentUser?.role === "room_owner") {
      handleRoomOwnerScaleChange(rootNote, scale);
    }
  });

  // Computed values
  const pendingCount = currentRoom?.pendingMembers?.length ?? 0;

  // Show approval waiting screen if in requesting state
  if (connectionState === ConnectionState.REQUESTING) {
    return (
      <ApprovalWaiting
        connectionState={connectionState}
        onCancel={handleLeaveRoom}
        roomName={currentRoom?.name}
      />
    );
  }

  const handleCopyInviteUrl = async (role: "band_member" | "audience") => {
    if (!currentRoom?.id) return;

    const inviteUrl = generateInviteUrl(currentRoom.id, role, "perform");
    let didCopy = false;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      didCopy = true;
      showSuccessMessage(`copy-invite-${role}`, "Copied!");
    } catch (error: unknown) {
      console.error("Failed to copy invite URL:", error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement("textarea");
        textArea.value = inviteUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        didCopy = true;
        showSuccessMessage(`copy-invite-${role}`, "Copied!");
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
      }
    }

    if (didCopy) {
      trackInviteSent(roomAnalyticsContext, role, "copy");
    }
  };

  const handleShareInviteUrl = async (role: "band_member" | "audience") => {
    if (!currentRoom?.id) return;

    const inviteUrl = generateInviteUrl(currentRoom.id, role, "perform");
    const roleText = role === "band_member" ? "Band Member" : "Audience";

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${currentRoom?.name} on COLLAB`,
          text: `You're invited to join "${currentRoom?.name}" as ${roleText} on COLLAB!`,
          url: inviteUrl,
        });
        trackInviteSent(roomAnalyticsContext, role, "share");
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to share invite URL:", error);
        // Fallback to copy
        handleCopyInviteUrl(role);
      }
    } else {
      // Fallback to copy if share API not available
      handleCopyInviteUrl(role);
    }
  };

  const showSuccessMessage = (buttonId: string, message: string) => {
    const button = document.getElementById(buttonId);
    if (button) {
      const originalText = button.textContent;
      button.textContent = message;
      button.classList.add("btn-success");

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("btn-success");
      }, 2000);
    }
  };

  // Render connecting state
  if (isConnecting || (!isConnected && !currentRoom)) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-xl">
              Connecting to Room
            </h2>
            <p className="text-base-content/70 mb-4">
              {isConnecting
                ? "Establishing connection to server..."
                : "Joining room..."}
            </p>
            <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
            <div className="card-actions justify-center mt-4">
              <button onClick={handleLeaveRoom} className="btn btn-outline">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-xl text-error">
              Error
            </h2>
            <p className="text-base-content/70 mb-4">{error}</p>
            <div className="card-actions justify-center">
              <button onClick={handleLeaveRoom} className="btn btn-primary">
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render room interface
  return (
    <div className="min-h-dvh bg-base-200 flex flex-col">
      {/* Saving Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="card bg-base-200 shadow-xl p-8">
            <div className="card-body items-center text-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <h3 className="card-title mt-4">Saving Project</h3>
              <p className="text-base-content/70">
                Please wait while we save the project...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 pt-3 px-3">
        <div className="">
          {/* Fallback Notification */}
          {fallbackNotification && (
            <div className="alert alert-info mb-4 w-full">
              <div>
                <h4 className="font-bold">Safari Compatibility</h4>
                <p className="text-sm">{fallbackNotification.message}</p>
              </div>
              <button
                onClick={clearFallbackNotification}
                className="btn btn-sm btn-ghost"
              >
                ×
              </button>
            </div>
          )}

          {/* Room Header */}
          <div className="w-full mb-4">
            {/* Room Name and Copy URL Button */}
            <div className="flex justify-between items-center flex-wrap">
              <div className="flex items-center gap-2 flrx-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-primary">
                  Perform
                </h2>
                <span className="badge badge-xs sm:badge-sm badge-primary">
                  {currentRoom?.name}
                </span>

                <div className='divider divider-horizontal m-0!' />

                {/* User Name and Role */}
                <div className="flex items-center">
                  <span className="text-sm mr-2">
                    {currentUser?.username}
                  </span>
                  <span className="text-sm text-base-content/50">
                    {currentUser?.role === "room_owner"
                      ? "Room Owner"
                      : "Band Member"}
                  </span>
                </div>

                {/* Room Settings Button - Only for room owner */}
                {currentUser?.role === "room_owner" && (
                  <button
                    onClick={handleOpenRoomSettings}
                    className="btn btn-xs btn-ghost"
                    title="Room Settings"
                  >
                    ⚙️
                  </button>
                )}

                <div className="relative">
                  <button
                    ref={inviteBtnRef}
                    aria-label="Copy invite link"
                    className="btn btn-xs"
                    onClick={() => setIsInvitePopupOpen((v) => !v)}
                    title="Copy invite link with role selection"
                  >
                    📋
                  </button>
                  <AnchoredPopup
                    open={isInvitePopupOpen}
                    onClose={() => setIsInvitePopupOpen(false)}
                    anchorRef={inviteBtnRef}
                    placement="bottom"
                    className="w-64"
                  >
                    <div className="p-3">
                      <div className="mb-3">
                        <h4 className="font-semibold text-sm mb-2">
                          Copy Invite Link
                        </h4>
                        <p className="text-xs text-base-content/70">
                          Select the role for the invited user
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-base-content/60 mb-2">
                            Band Member
                          </p>
                          <div className="flex gap-2">
                            <button
                              id="copy-invite-band_member"
                              onClick={() => handleCopyInviteUrl("band_member")}
                              className="btn btn-sm btn-primary flex-1"
                              title="Copy link for band member invitation"
                            >
                              📋 Copy
                            </button>
                            <button
                              id="share-invite-band_member"
                              onClick={() =>
                                handleShareInviteUrl("band_member")
                              }
                              className="btn btn-sm btn-outline"
                              title="Share link for band member invitation"
                            >
                              📤
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-base-content/60 mb-2">
                            Audience
                          </p>
                          <div className="flex gap-2">
                            <button
                              id="copy-invite-audience"
                              onClick={() => handleCopyInviteUrl("audience")}
                              className="btn btn-sm btn-outline flex-1"
                              title="Copy link for audience invitation"
                            >
                              📋 Copy
                            </button>
                            <button
                              id="share-invite-audience"
                              onClick={() => handleShareInviteUrl("audience")}
                              className="btn btn-sm btn-outline"
                              title="Share link for audience invitation"
                            >
                              📤
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AnchoredPopup>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Recording Button with Dropdown */}
                <div className="relative">
                  <button
                    ref={recordingBtnRef}
                    onClick={() => {
                      if (isRecording) {
                        // If recording, stop whatever is recording
                        if (isAudioRecording) {
                          toggleAudioRecording();
                        } else if (isSessionRecording) {
                          toggleSessionRecording();
                        }
                      } else {
                        // If not recording, show dropdown
                        setIsRecordingMenuOpen((v) => !v);
                      }
                    }}
                    className={`btn btn-xs ${isRecording ? 'btn-error' : 'btn-soft btn-error'}`}
                    title={isRecording ? `Recording... ${formatDuration(recordingDuration)}` : (!isRegisteredOrPremium ? 'Registered and premium users can record. Please sign up to access this feature.' : 'Start recording')}
                    disabled={!isRegisteredOrPremium}
                  >
                    {isRecording ? 'Stop' : 'Record'}
                    {isRecording && (
                      <span className="ml-1 text-xs">{formatDuration(recordingDuration)}</span>
                    )}
                    {!isRecording && <span className="ml-1">▼</span>}
                  </button>
                  <AnchoredPopup
                    open={isRecordingMenuOpen}
                    onClose={() => setIsRecordingMenuOpen(false)}
                    anchorRef={recordingBtnRef}
                    placement="bottom"
                    className="w-56"
                  >
                    <div className="p-2">
                      <h4 className="font-semibold text-sm mb-2 px-2">Record Session</h4>
                      <ul className="menu bg-base-100 w-full p-0">
                        <li>
                          <button
                            onClick={() => {
                              setIsRecordingMenuOpen(false);
                              toggleAudioRecording();
                            }}
                            className="flex items-center gap-2"
                          >
                            <span>🎵</span>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Record Audio</span>
                              <span className="text-xs text-base-content/60">Mixed WAV file</span>
                            </div>
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={() => {
                              setIsRecordingMenuOpen(false);
                              toggleSessionRecording();
                            }}
                            className="flex items-center gap-2"
                          >
                            <span>🎹</span>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Record Project</span>
                              <span className="text-xs text-base-content/60">Multitrack .collab file</span>
                            </div>
                          </button>
                        </li>
                      </ul>
                    </div>
                  </AnchoredPopup>
                </div>
                {/* Broadcast Button - Room Owner Only */}
                {currentUser?.role === "room_owner" && (
                  <button
                    onClick={toggleBroadcast}
                    className={`btn btn-xs ${isBroadcasting ? 'btn-success' : 'btn-soft btn-success'}`}
                    title={isBroadcasting ? 'Stop broadcasting to audience' : (!isRegisteredOrPremium ? 'Registered and premium users can broadcast. Please sign up to access this feature.' : 'Start broadcasting to audience')}
                    disabled={isBroadcastStarting || !isRegisteredOrPremium}
                  >
                    {isBroadcastStarting ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : isBroadcasting ? (
                      <>
                        <span className="animate-pulse">📡</span>
                        <span className="ml-1 text-xs">LIVE</span>
                      </>
                    ) : (
                      '📡 Broadcast'
                    )}
                  </button>
                )}

                <div className='divider divider-horizontal m-0!' />

                {/* Pending notification button for room owner */}
                {currentUser?.role === "room_owner" && (
                  <div className="relative">
                    <button
                      ref={pendingBtnRef}
                      aria-label="Pending member requests"
                      className="btn btn-ghost btn-sm relative"
                      onClick={() => setIsPendingPopupOpen((v) => !v)}
                      title={
                        pendingCount > 0
                          ? `${pendingCount} pending requests`
                          : "No pending requests"
                      }
                    >
                      🔔
                      {pendingCount > 0 && (
                        <span className="badge badge-error text-white badge-xs absolute -top-1 -right-1">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                    <AnchoredPopup
                      open={isPendingPopupOpen}
                      onClose={() => setIsPendingPopupOpen(false)}
                      anchorRef={pendingBtnRef}
                      placement="bottom"
                      className="w-72"
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm">
                            Pending Members
                          </h4>
                          {pendingCount > 0 && (
                            <span className="badge badge-ghost badge-sm">
                              {pendingCount}
                            </span>
                          )}
                        </div>
                        {pendingCount === 0 ? (
                          <div className="text-sm text-base-content/70">
                            No pending requests
                          </div>
                        ) : (
                          <ul className="menu bg-base-100 w-full p-0">
                            {currentRoom!.pendingMembers.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center justify-between gap-2 px-0"
                              >
                                <div className="flex items-center gap-2 px-2 py-1">
                                  <span className="font-medium text-sm">
                                    {user.username}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => handleApproveMember(user.id)}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    className="btn btn-sm btn-error"
                                    onClick={() => handleRejectMember(user.id)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </ul>
                        )}
                      </div>
                    </AnchoredPopup>
                  </div>
                )}

                <div className="flex items-center gap-3 min-w-16">
                  <div
                    className={`w-3 h-3 rounded-full ${isConnected
                      ? "bg-success"
                      : isConnecting
                        ? "bg-warning"
                        : "bg-error"
                      }`}
                  ></div>
                  <PingDisplay
                    ping={currentPing}
                    isConnected={isConnected}
                    variant="compact"
                    showLabel={false}
                  />
                </div>
                <button
                  onClick={handleLeaveRoomClick}
                  className="btn btn-outline btn-xs"
                >
                  Leave Room
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-col xl:flex-row xl:h-[calc(100vh-8rem)]">
            {/* Main content area */}
            <main className="flex flex-1 flex-col gap-2 p-1 overflow-y-auto min-w-0">
              <div className="flex gap-2 flex-wrap w-full mb-3">
                {/* Instrument Controls */}
                {(currentUser?.role === "room_owner" ||
                  currentUser?.role === "band_member") && (
                    <MidiStatus
                      isConnected={midiController.isConnected}
                      getMidiInputs={midiController.getMidiInputs}
                      onRequestAccess={midiController.requestMidiAccess}
                      connectionError={midiController.connectionError}
                      isRequesting={midiController.isRequesting}
                      refreshMidiDevices={midiController.refreshMidiDevices}
                    />
                  )}

                {/* Voice Communication - Only for users who can transmit */}
                {isVoiceEnabled && canTransmitVoice && (
                  <VoiceInput
                    isVisible={isVoiceEnabled}
                    onStreamReady={handleStreamReady}
                    onStreamRemoved={handleStreamRemoved}
                    rtcLatency={currentLatency}
                    rtcLatencyActive={rtcLatencyActive}
                    userCount={currentRoom?.users?.length || 0}
                    browserAudioLatency={browserAudioLatency}
                    meshLatency={meshLatency}
                    isConnecting={isConnecting}
                    connectionError={!!error}
                    onConnectionRetry={() => window.location.reload()}
                  />
                )}

                {/* Instrument Controls */}
                {(currentUser?.role === "room_owner" ||
                  currentUser?.role === "band_member") && (
                    <>
                      {/* Virtual Instrument Mute Control */}
                      <InstrumentMute
                        isMuted={isInstrumentMuted}
                        onMuteChange={setInstrumentMuted}
                      />

                      {/* Metronome Controls */}
                      <MetronomeControls
                        socket={activeSocket}
                        canEdit={
                          currentUser?.role === "room_owner" ||
                          currentUser?.role === "band_member"
                        }
                      />

                      <ScaleSlots
                        onSlotSelect={(rootNote, scale) => {
                          scaleState.setRootNote(rootNote);
                          scaleState.setScale(scale);

                          // If user is room owner, broadcast the scale change
                          if (currentUser?.role === "room_owner") {
                            handleRoomOwnerScaleChange(rootNote, scale);
                          }
                        }}
                        currentUser={currentUser}
                        isRoomOwner={currentUser?.role === "room_owner"}
                        followRoomOwner={currentUser?.followRoomOwner || false}
                        onToggleFollowRoomOwner={handleToggleFollowRoomOwner}
                        disabled={currentUser?.followRoomOwner || false}
                        ownerScale={currentRoom?.ownerScale}
                      />

                      <InstrumentCategorySelector
                        currentCategory={currentCategory}
                        currentInstrument={currentInstrument}
                        onCategoryChange={handleCategoryChange}
                        onInstrumentChange={handleInstrumentChange}
                        isLoading={isLoadingInstrument}
                        dynamicDrumMachines={dynamicDrumMachines}
                      />

                      {/* Step Sequencer */}
                      <div className="w-full">
                        <StepSequencer
                          socket={activeSocket}
                          currentCategory={currentCategory}
                          availableSamples={availableSamples}
                          scaleNotes={[
                            ...scaleState.getScaleNotes(
                              scaleState.rootNote,
                              scaleState.scale,
                              2
                            ),
                            ...scaleState.getScaleNotes(
                              scaleState.rootNote,
                              scaleState.scale,
                              3
                            ),
                            ...scaleState.getScaleNotes(
                              scaleState.rootNote,
                              scaleState.scale,
                              4
                            ),
                            ...scaleState.getScaleNotes(
                              scaleState.rootNote,
                              scaleState.scale,
                              5
                            ),
                            ...scaleState.getScaleNotes(
                              scaleState.rootNote,
                              scaleState.scale,
                              6
                            ),
                          ]}
                          rootNote={scaleState.rootNote}
                          onPlayNotes={handlePlayNotesWithRecording}
                          onStopNotes={handleStopNotesWrapper}
                          editMode={settings.editMode}
                          onSelectedBeatChange={setSelectedBeat}
                          onEditModeChange={setEditMode}
                        />
                      </div>

                      {/* Synthesizer Controls */}
                      {currentCategory === InstrumentCategory.Synthesizer &&
                        synthState && (
                          <div className="w-full">
                            <SynthControls
                              currentInstrument={currentInstrument}
                              synthState={synthState}
                              onParamChange={updateSynthParams}
                              onLoadPreset={loadPresetParams}
                            />
                          </div>
                        )}

                      {/* Instrument Interface */}
                      {renderInstrumentControl()}

                      {/* Effects Chain Section */}
                      <div className="w-full">
                        <EffectsChainSection />
                      </div>
                    </>
                  )}
              </div>
            </main>

            {/* Sidebar: Right on desktop, bottom on mobile */}
            <aside className="w-full xl:w-96 xl:border-l border-t xl:border-t-0 border-base-300 bg-base-100 flex flex-col md:flex-row xl:flex-col xl:h-full overflow-hidden">
              <div className="flex-3 overflow-y-auto min-h-0 p-3">
                <RoomMembers
                  users={currentRoom?.users ?? []}
                  pendingMembers={currentRoom?.pendingMembers ?? []}
                  playingIndicators={playingIndicators}
                  voiceUsers={voiceUsers}
                  onApproveMember={handleApproveMember}
                  onRejectMember={handleRejectMember}
                  onSwapInstrument={handleSwapInstrument}
                  onKickUser={handleKickUser}
                  pendingSwapTarget={pendingSwapTarget}
                  onCancelSwap={handleCancelSwap}
                />
              </div>
              <div className="flex-4 border-t border-base-300 shrink-0">
                {/* Chat Box */}
                <ChatBox
                  currentUserId={currentUser?.id || ""}
                  onSendMessage={sendChatMessage}
                />
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Leave Room Confirmation Modal */}
      <Modal
        open={showLeaveConfirmModal}
        setOpen={setShowLeaveConfirmModal}
        title="Leave Room"
        okText="Leave Room"
        cancelText="Cancel"
        onOk={handleLeaveRoomConfirmWithCleanup}
      >
        <p className="text-base-content/70 mb-4">
          Are you sure you want to leave the room? This action cannot be undone.
        </p>
      </Modal>

      {/* Instrument Swap Modal */}
      <SwapInstrumentModal
        open={swapRequestData.isModalOpen}
        onClose={() =>
          setSwapRequestData({ requester: null, isModalOpen: false })
        }
        requesterUser={swapRequestData.requester}
        onApprove={handleApproveSwap}
        onReject={handleRejectSwap}
      />

      {/* Kick User Modal */}
      <KickUserModal
        open={kickUserData.isModalOpen}
        onClose={handleCancelKick}
        targetUser={kickUserData.targetUser}
        onConfirm={handleConfirmKick}
      />

      {/* Room Settings Modal */}
      <RoomSettingsModal
        open={showRoomSettingsModal}
        onClose={handleCloseRoomSettings}
        room={currentRoom}
        onSave={handleSaveRoomSettings}
        isLoading={isUpdatingRoomSettings}
      />

      {/* Save Project Modal */}
      <SaveProjectModal
        open={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setPendingSnapshot(null);
        }}
        onSave={async (name: string) => {
          await checkAndSave(name, savedProjectId || undefined);
          setShowSaveModal(false);
        }}
        existingProjectName={savedProjectId ? undefined : undefined}
        isSaving={isSaving}
      />

      {/* Project Limit Modal */}
      <ProjectLimitModal
        open={showLimitModal}
        onClose={handleLimitModalClose}
        projects={limitProjects}
        onProjectDeleted={handleProjectDeletedWrapper}
        onProceed={() => {
          handleLimitModalClose();
          setShowSaveModal(true);
        }}
      />

      <Footer />
    </div>
  );

  function renderInstrumentControl() {
    const controlType = getCurrentInstrumentControlType();

    // Show loading indicator while audio context is initializing
    if (!isAudioContextReady) {
      // If user gesture is needed, show initialization button
      if (needsUserGesture) {
        return (
          <div className="card bg-base-100 shadow-xl w-full">
            <div className="card-body text-center">
              <h3 className="card-title justify-center text-xl">
                Audio Setup Required
              </h3>
              <p className="text-base-content/70 mt-4">
                Click the button below to initialize the audio system for your
                jam session.
              </p>
              <div className="card-actions justify-center mt-6">
                <button
                  onClick={initializeAudioContext}
                  className="btn btn-primary btn-lg"
                >
                  Initialize Audio
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Otherwise show loading spinner
      return (
        <div className="card bg-base-100 shadow-xl w-full">
          <div className="card-body text-center">
            <h3 className="card-title justify-center text-xl">
              Initializing Audio...
            </h3>
            <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
            <p className="text-base-content/70 mt-4">
              Setting up audio system for the jam session...
            </p>
          </div>
        </div>
      );
    }

    // Show loading indicator
    if (
      isLoadingInstrument ||
      (currentCategory === InstrumentCategory.Synthesizer &&
        !isSynthesizerLoaded)
    ) {
      return (
        <div className="card bg-base-100 shadow-xl w-full">
          <div className="card-body text-center">
            <h3 className="card-title justify-center text-xl">
              Loading Instrument...
            </h3>
            <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
            <p className="text-base-content/70 mt-4">
              Loading {currentInstrument.replace(/_/g, " ")}...
            </p>
          </div>
        </div>
      );
    }

    // Show error state
    if (audioContextError && !isLoadingInstrument) {
      return (
        <div className="card bg-base-100 shadow-xl w-full">
          <div className="card-body text-center">
            <h3 className="card-title justify-center text-xl text-error">
              Audio Error
            </h3>
            <div className="alert alert-error">
              <div>
                <h4 className="font-bold">Instrument Loading Failed</h4>
                <p className="text-sm">
                  {getSafariUserMessage(audioContextError)}
                </p>
              </div>
            </div>
            <div className="card-actions justify-center mt-4">
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Render instrument control
    switch (controlType) {
      case ControlType.Guitar:
        return <Guitar {...commonProps} />;
      case ControlType.Bass:
        return <Bass {...commonProps} />;
      case ControlType.Drumpad:
        return (
          <Drumpad
            {...commonProps}
            availableSamples={availableSamples}
            currentInstrument={currentInstrument}
            onPlayNotesLocal={undefined}
          />
        );
      case ControlType.Drumset:
        return <Drumset {...commonProps} availableSamples={availableSamples} />;
      case ControlType.Keyboard:
      default:
        return <Keyboard {...commonProps} />;
    }
  }
});

PerformRoom.displayName = "Room";

export default PerformRoom;
