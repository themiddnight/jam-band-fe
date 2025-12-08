/* eslint-disable react-hooks/exhaustive-deps */
import { useWebRTCVoice } from "@/features/audio";
import {
  usePingMeasurement,
  useCombinedLatency,
} from "@/features/audio";
import { ConnectionState } from "@/features/audio/types/connectionState";
import {
  useInstrumentMute,
} from "@/features/instruments";
import { useSequencer } from "@/features/sequencer/hooks/useSequencer";
import { useSequencerStore } from "@/features/sequencer/stores/sequencerStore";
import { useShallow } from "zustand/react/shallow";

import { ChatBox, ApprovalWaiting } from "@/features/rooms";
import {
  RoomMembers,
  SwapInstrumentModal,
  KickUserModal,
  RoomSettingsModal,
} from "@/features/rooms";
import { useRoom, useBroadcastStream } from "@/features/rooms";
import { PerformRoomHeader } from "@/features/rooms/components/perform/PerformRoomHeader";
import { InstrumentStage } from "@/features/rooms/components/perform/InstrumentStage";
import { Footer } from "@/features/ui";
import { Modal } from "@/features/ui";
import { useScaleSlotKeyboard } from "@/features/ui";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import type { RoomUser } from "@/shared/types";
import { preloadCriticalComponents } from "@/shared/utils/componentPreloader";
import { getRoomContext } from "@/shared/analytics/context";
import { useNetworkAnalytics } from "@/shared/analytics/useNetworkAnalytics";
import { useEffectsIntegration } from "@/features/effects/hooks/useEffectsIntegration";
import { SaveProjectModal } from "@/features/projects/components/SaveProjectModal";
import { ProjectLimitModal } from "@/features/projects/components/ProjectLimitModal";
import { useMetronome } from "@/features/metronome/hooks/useMetronome";
import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as Tone from "tone";
import { useUserStore } from "@/shared/stores/userStore";

import { useInstrumentSwapUI } from "@/features/rooms/hooks/modules/useInstrumentSwapUI";
import { useRoomRecordingManager } from "@/features/rooms/hooks/modules/useRoomRecordingManager";
import { RoomSocketProvider } from "@/features/rooms/contexts/RoomSocketProvider";

/**
 * Room page using the RoomSocketManager for namespace-based connections
 */
const PerformRoom = memo(() => {
  const navigate = useNavigate();
  const { isAuthenticated } = useUserStore();
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
  // const { generateInviteUrl } = useDeepLinkHandler(); // Removed as unused

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

  // Recording & Project Management
  const {
    isRecording,
    isAudioRecording,
    isSessionRecording,
    recordingDuration,
    toggleAudioRecording,
    toggleSessionRecording,
    recordNoteEvent,
    isSaving,
    savedProjectId,
    showSaveModal,
    setShowSaveModal,
    setPendingSnapshot,
    checkAndSave,
    showLimitModal,
    limitProjects,
    handleLimitModalClose,
    handleProjectDeletedWrapper,
  } = useRoomRecordingManager({
    currentRoom,
    currentUser,
    isAuthenticated,
    localStream,
    socket: activeSocket,
    voiceUsers,
    bpm,
    currentCategory,
    currentInstrument,
    synthState,
    isInstrumentMuted,
  });

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
        recordNoteEvent(notes, 0, "note_off");
      }
    },
    [handleStopNote, isInstrumentMuted, currentUser, currentInstrument, currentCategory]
  );

  // Instrument swap handlers
  // (Handled by useInstrumentSwapUI hook)

  // Kick user handlers
  const handleKickUser = useCallback(
    (targetUserId: string) => {
      const targetUser = currentRoom?.users.find(
        (user: RoomUser) => user.id === targetUserId
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
        recordNoteEvent(notes, midiVelocity, "note_on");
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

  // Instrument swap state & logic
  const {
    pendingSwapTarget,
    swapRequestData,
    handleSwapInstrument,
    handleCancelSwap,
    handleApproveSwap,
    handleRejectSwap,
    setSwapRequestData
  } = useInstrumentSwapUI({
    currentRoom,
    currentUser,
    currentCategory,
    synthState,
    requestInstrumentSwap,
    cancelInstrumentSwap,
    approveInstrumentSwap,
    rejectInstrumentSwap,
    handleInstrumentChange,
    updateSynthParams,
    requestSequencerState,
    sequencer,
    onSwapRequestReceived,
    onSwapRequestSent,
    onSwapApproved,
    onSwapRejected,
    onSwapCancelled,
    onSwapCompleted,
    navigate,
  });

  // Update sequencer ref when sequencer changes
  useEffect(() => {
    sequencerRef.current = sequencer;
  }, [sequencer]);

  // Get sequencer UI state from store
  const { settings, setSelectedBeat, setEditMode, resetUI } = useSequencerStore(
    useShallow((state) => ({
      settings: state.settings,
      setSelectedBeat: state.setSelectedBeat,
      setEditMode: state.setEditMode,
      resetUI: state.resetUI,
    }))
  );

  // Wrapper for key release that also records note_off events
  const handleReleaseKeyHeldNoteWithRecording = useCallback(
    (note: string) => {
      // Call original handler
      handleReleaseKeyHeldNote(note);

      // Record note_off for session recording (for .collab export)
      if (!isInstrumentMuted && currentUser && currentInstrument && currentCategory) {
        recordNoteEvent([note], 0, "note_off");
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
        recordNoteEvent(
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


  // Sequencer hook for recording integration & Listener for Sequencer State
  useEffect(() => {
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
      unsubscribeSequencerRequested();
      unsubscribeSequencerReceived();
      unsubscribeUserKicked();
    };
  }, [
    onSequencerStateRequested,
    sendSequencerState,
    onSequencerStateReceived,
    onUserKicked,
    sequencer,
    navigate,
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
    <RoomSocketProvider socket={activeSocket}>
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
          <PerformRoomHeader
            currentRoom={currentRoom}
            currentUser={currentUser}
            isConnected={isConnected}
            isConnecting={isConnecting}
            currentPing={currentPing}
            isRecording={isRecording}
            isAudioRecording={isAudioRecording}
            isSessionRecording={isSessionRecording}
            recordingDuration={recordingDuration}
            isBroadcasting={isBroadcasting}
            isBroadcastStarting={isBroadcastStarting}
            roomAnalyticsContext={roomAnalyticsContext}
            handleOpenRoomSettings={handleOpenRoomSettings}
            handleLeaveRoomClick={handleLeaveRoomClick}
            toggleAudioRecording={toggleAudioRecording}
            toggleSessionRecording={toggleSessionRecording}
            toggleBroadcast={toggleBroadcast}
            handleApproveMember={handleApproveMember}
            handleRejectMember={handleRejectMember}
          />

          {/* Main Content */}
          <div className="flex flex-col xl:flex-row xl:h-[calc(100vh-8rem)]">
            {/* Main content area */}
            <main className="flex flex-1 flex-col gap-2 p-1 overflow-y-auto min-w-0">
              <InstrumentStage
                currentUser={currentUser}
                currentRoom={currentRoom}
                isConnected={isConnected}
                localStream={localStream}
                midiController={midiController}
                isVoiceEnabled={isVoiceEnabled}
                canTransmitVoice={canTransmitVoice}
                handleStreamReady={handleStreamReady}
                handleStreamRemoved={handleStreamRemoved}
                currentLatency={currentLatency ?? undefined}
                rtcLatencyActive={rtcLatencyActive}
                browserAudioLatency={browserAudioLatency}
                meshLatency={meshLatency}
                isConnecting={isConnecting}
                error={error}
                isInstrumentMuted={isInstrumentMuted}
                setInstrumentMuted={setInstrumentMuted}
                scaleState={scaleState}
                handleRoomOwnerScaleChange={handleRoomOwnerScaleChange}
                handleToggleFollowRoomOwner={handleToggleFollowRoomOwner}
                currentCategory={currentCategory}
                currentInstrument={currentInstrument}
                handleCategoryChange={handleCategoryChange}
                handleInstrumentChange={handleInstrumentChange}
                isLoadingInstrument={isLoadingInstrument}
                dynamicDrumMachines={dynamicDrumMachines}
                availableSamples={availableSamples}
                handlePlayNotesWithRecording={handlePlayNotesWithRecording}
                handleStopNotesWrapper={handleStopNotesWrapper}
                settings={settings}
                setSelectedBeat={setSelectedBeat}
                setEditMode={setEditMode}
                synthState={synthState}
                updateSynthParams={updateSynthParams}
                loadPresetParams={loadPresetParams}
                isSynthesizerLoaded={isSynthesizerLoaded}
                isAudioContextReady={isAudioContextReady}
                needsUserGesture={needsUserGesture}
                initializeAudioContext={initializeAudioContext}
                getCurrentInstrumentControlType={getCurrentInstrumentControlType}
                commonProps={commonProps}
              />
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
    </RoomSocketProvider>
  );
});

PerformRoom.displayName = "Room";

export default PerformRoom;
