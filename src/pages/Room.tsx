import { MidiStatus } from "@/features/audio";
import { VoiceInput } from "@/features/audio";
import { useWebRTCVoice } from "@/features/audio";
import {
  PingDisplay,
  usePingMeasurement,
  useCombinedLatency,
} from "@/features/audio";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { InstrumentCategorySelector } from "@/features/instruments";
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
import { ChatBox, ApprovalWaiting } from "@/features/rooms";
import { RoomMembers } from "@/features/rooms";
import { useRoom } from "@/features/rooms";
import { Footer } from "@/features/ui";
import { ScaleSlots } from "@/features/ui";
import { AnchoredPopup, Modal } from "@/features/ui";
import { useScaleSlotKeyboard } from "@/features/ui";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import { ControlType } from "@/shared/types";
import { preloadCriticalComponents } from "@/shared/utils/componentPreloader";
import { getSafariUserMessage } from "@/shared/utils/webkitCompat";
import { useDeepLinkHandler } from "@/shared/hooks/useDeepLinkHandler";
import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";

/**
 * Room page using the RoomSocketManager for namespace-based connections
 */
const Room = memo(() => {
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
    handlePlayNote,
    handleStopNote,
    handleReleaseKeyHeldNote,
    handleSustainChange,
    handleSustainToggleChange,
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
    instrumentManager,

    // Audio management
    stopSustainedNotes,
    initializeAudioContext,

    // Socket connection
    getActiveSocket,
  } = useRoom();

  // All hooks must be called before any early returns
  // Get the current active socket directly instead of using a ref
  const activeSocket = getActiveSocket();
  
  const { currentPing } = usePingMeasurement({
    socket: activeSocket,
    enabled: isConnected,
  });

  // Deep link handler utilities
  const { generateInviteUrl } = useDeepLinkHandler();

  // Notification popup state
  const [isPendingPopupOpen, setIsPendingPopupOpen] = useState(false);
  const pendingBtnRef = useRef<HTMLButtonElement>(null);

  // WebRTC Voice Communication - allow all users (including audience) to participate
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
    addLocalStream,
    removeLocalStream,
    performIntentionalCleanup,
    enableAudioReception,
    canTransmit,
    isAudioEnabled,
    peerConnections,
  } = useWebRTCVoice(webRTCParams);

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

  // Track last seen peer ids to diff additions/removals
  const lastSeenPeerIdsRef = useRef<Set<string>>(new Set());

  // Copy room URL to clipboard with role selection
  const [isInvitePopupOpen, setIsInvitePopupOpen] = useState(false);
  const inviteBtnRef = useRef<HTMLButtonElement>(null);

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
    [addLocalStream],
  );

  const handleStreamRemoved = useCallback(() => {
    removeLocalStream();
  }, [removeLocalStream]);

  // Wrapper function to adapt onPlayNotes signature to handlePlayNote
  const handlePlayNotesWrapper = useCallback(
    (notes: string[], velocity: number, isKeyHeld: boolean) => {
      handlePlayNote(notes, velocity, "note_on", isKeyHeld);
    },
    [handlePlayNote],
  );

  // Wrapper function for note stop
  const handleStopNotesWrapper = useCallback(
    (notes: string[]) => {
      handleStopNote(notes);
    },
    [handleStopNote],
  );

  // Sequencer hook for recording integration
  const sequencer = useSequencer({
    socket: activeSocket,
    currentCategory,
    onPlayNotes: handlePlayNotesWrapper,
    onStopNotes: handleStopNotesWrapper,
  });

  // Enhanced note playing wrapper that also handles recording
  const handlePlayNotesWithRecording = useCallback(
    (notes: string[], velocity: number, isKeyHeld: boolean) => {
      // Always play the note
      handlePlayNote(notes, velocity, "note_on", isKeyHeld);
      
      // Also record to sequencer if recording is enabled
      if (sequencer.isRecording) {
        notes.forEach(note => {
          // Determine if this is realtime recording (while sequencer is playing)
          const isRealtime = sequencer.isPlaying;
          sequencer.handleRecordNote(note, velocity, undefined, isRealtime);
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handlePlayNote, sequencer.isRecording, sequencer.handleRecordNote],
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
      onReleaseKeyHeldNote: handleReleaseKeyHeldNote,
      onSustainChange: handleSustainChange,
      onSustainToggleChange: handleSustainToggleChange,
    }),
    [
      scaleState.rootNote,
      scaleState.scale,
      scaleState.getScaleNotes,
      handlePlayNotesWithRecording,
      handleStopNotesWrapper,
      stopSustainedNotes,
      handleReleaseKeyHeldNote,
      handleSustainChange,
      handleSustainToggleChange,
    ]
  );

  // Preload critical components when component mounts
  useEffect(() => {
    preloadCriticalComponents();
  }, []);

  // Auto-enable audio for audience members when they join (with user gesture fallback)
  useEffect(() => {
    if (
      currentUser?.role === "audience" &&
      isVoiceEnabled &&
      !isAudioEnabled &&
      currentRoom
    ) {
      // Try to auto-enable audio after a short delay to ensure room is fully loaded
      const timer = setTimeout(() => {
        console.log("🎧 Auto-attempting to enable audio for audience member");
        enableAudioReception().catch((error) => {
          console.log(
            "🎧 Auto audio enable failed (user gesture required):",
            error,
          );
          // This is expected on mobile - user will need to click the button
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [
    currentUser?.role,
    isVoiceEnabled,
    isAudioEnabled,
    currentRoom,
    enableAudioReception,
  ]);

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

  // Setup scale slot keyboard shortcuts
  useScaleSlotKeyboard((rootNote, scale) => {
    scaleState.setRootNote(rootNote);
    scaleState.setScale(scale);
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
    
    const inviteUrl = generateInviteUrl(currentRoom.id, role);
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showSuccessMessage(`copy-invite-${role}`, "Copied!");
    } catch (error: unknown) {
      console.error("Failed to copy invite URL:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showSuccessMessage(`copy-invite-${role}`, "Copied!");
    }
  };

  const handleShareInviteUrl = async (role: "band_member" | "audience") => {
    if (!currentRoom?.id) return;
    
    const inviteUrl = generateInviteUrl(currentRoom.id, role);
    const roleText = role === "band_member" ? "Band Member" : "Audience";
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${currentRoom?.name} on COLLAB`,
          text: `You're invited to join "${currentRoom?.name}" as ${roleText} on COLLAB!`,
          url: inviteUrl,
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error("Failed to share invite URL:", error);
          // Fallback to copy
          handleCopyInviteUrl(role);
        }
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
      <div className="flex-1 p-3">
        <div className="flex flex-col items-center">
          {/* Fallback Notification */}
          {fallbackNotification && (
            <div className="alert alert-info mb-4 w-full max-w-6xl">
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
          <div className="w-full max-w-6xl mb-4">
            {/* Room Name and Copy URL Button */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{currentRoom?.name}</h1>
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
                          <p className="text-xs text-base-content/60 mb-2">Band Member</p>
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
                              onClick={() => handleShareInviteUrl("band_member")}
                              className="btn btn-sm btn-outline"
                              title="Share link for band member invitation"
                            >
                              📤
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-base-content/60 mb-2">Audience</p>
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
              <div className="flex items-center gap-2">
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

                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isConnected
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
                  className="btn btn-outline btn-sm"
                >
                  Leave Room
                </button>
              </div>
            </div>

            {/* User Name and Role */}
            <div>
              <span className="mr-2">{currentUser?.username}</span>
              <span className="text-sm text-base-content/70">
                {currentUser?.role === "room_owner"
                  ? "Room Owner"
                  : currentUser?.role === "band_member"
                    ? "Band Member"
                    : "Audience"}
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap w-full max-w-6xl mb-3">
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
            {isVoiceEnabled && canTransmit && (
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
                  }}
                />

                <InstrumentCategorySelector
                  currentCategory={currentCategory}
                  currentInstrument={currentInstrument}
                  onCategoryChange={handleCategoryChange}
                  onInstrumentChange={handleInstrumentChange}
                  isLoading={isLoadingInstrument}
                  dynamicDrumMachines={dynamicDrumMachines}
                />

                {/* Synthesizer Controls */}
                {currentCategory === InstrumentCategory.Synthesizer &&
                  synthState && (
                    <div className="w-full max-w-6xl">
                      <SynthControls
                        currentInstrument={currentInstrument}
                        synthState={synthState}
                        onParamChange={updateSynthParams}
                        onLoadPreset={loadPresetParams}
                      />
                    </div>
                  )}

                {/* Step Sequencer */}
                <div className="w-full max-w-6xl">
                  <StepSequencer
                  instrumentManager={instrumentManager}
                    socket={activeSocket}
                    currentCategory={currentCategory}
                    availableSamples={availableSamples}
                    scaleNotes={[
                      ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 2),
                      ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 3),
                      ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 4),
                      ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 5),
                      ...scaleState.getScaleNotes(scaleState.rootNote, scaleState.scale, 6),
                    ]}
                    onPlayNotes={handlePlayNotesWrapper}
                    onStopNotes={handleStopNotesWrapper}
                  />
                </div>

                {/* Instrument Interface */}
                {renderInstrumentControl()}
              </>
            )}
          </div>

          {/* Audience View */}
          {currentUser?.role === "audience" && (
            <div className="w-full max-w-6xl mb-3">
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body text-center">
                  <h3 className="card-title justify-center">Audience Mode</h3>
                  <p className="text-base-content/70">
                    You are listening to the jam session. Band members can play
                    instruments while you enjoy the music.
                  </p>
                  {isVoiceEnabled && (
                    <div className="mt-4 space-y-3">
                      {/* WebRTC Connection Status Indicator */}
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <span className="font-medium">Voice Chat Status:</span>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              peerConnections.size > 0
                                ? "bg-success"
                                : isConnecting
                                  ? "bg-warning"
                                  : "bg-error"
                            }`}
                          ></div>
                          <span
                            className={
                              peerConnections.size > 0
                                ? "text-success"
                                : isConnecting
                                  ? "text-warning"
                                  : "text-error"
                            }
                          >
                            {peerConnections.size > 0
                              ? `Connected (${peerConnections.size} peer${
                                  peerConnections.size === 1 ? "" : "s"
                                })`
                              : isConnecting
                                ? "Connecting..."
                                : "Not Connected"}
                          </span>
                        </div>
                      </div>

                      {!isAudioEnabled ? (
                        <div className="space-y-2">
                          <p className="text-sm text-base-content/80">
                            Enable audio to hear voice chat from band members
                          </p>
                          <button
                            onClick={enableAudioReception}
                            className="btn btn-primary btn-sm"
                          >
                            🔊 Enable Audio
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-sm text-base-content/60">
                          <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                          Voice chat: Listen-only mode (Audio enabled)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Room Members and Chat */}
          <div className="flex flex-col-reverse md:flex-row gap-3 w-full max-w-6xl">
            <RoomMembers
              users={currentRoom?.users ?? []}
              pendingMembers={currentRoom?.pendingMembers ?? []}
              playingIndicators={playingIndicators}
              voiceUsers={voiceUsers}
              onApproveMember={handleApproveMember}
              onRejectMember={handleRejectMember}
            />

            {/* Chat Box */}
            <ChatBox
              currentUserId={currentUser?.id || ""}
              onSendMessage={sendChatMessage}
            />
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
          <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
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
        <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
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
        <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
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
        <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
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

Room.displayName = "Room";

export default Room;
