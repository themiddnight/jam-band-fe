import { MidiStatus } from "@/features/audio";
import { VoiceInput } from "@/features/audio";
import { useWebRTCVoice } from "@/features/audio";
import { InstrumentCategorySelector } from "@/features/instruments";
import {
  LazyKeyboardWrapper as Keyboard,
  LazyGuitarWrapper as Guitar,
  LazyBassWrapper as Bass,
  LazyDrumpadWrapper as Drumpad,
  LazyDrumsetWrapper as Drumset,
  LazySynthControlsWrapper as SynthControls,
} from "@/features/instruments";
import { ChatBox } from "@/features/rooms";
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
import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";

const Room = memo(() => {
  const {
    // Room state
    currentRoom,
    currentUser,
    pendingApproval,
    error,

    // Connection state
    isConnected,
    isConnecting,

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

    // Audio management
    stopSustainedNotes,
    playNotes,

    // Socket connection
    socketRef,
  } = useRoom();

  // Notification popup state
  const [isPendingPopupOpen, setIsPendingPopupOpen] = useState(false);
  const pendingBtnRef = useRef<HTMLButtonElement>(null);
  const pendingCount = currentRoom?.pendingMembers?.length ?? 0;

  // WebRTC Voice Communication - allow all users (including audience) to participate
  const isVoiceEnabled = !!currentUser?.role;
  const canTransmitVoice =
    currentUser?.role === "room_owner" || currentUser?.role === "band_member";

  // WebRTC hook parameters
  const webRTCParams = {
    socket: socketRef.current,
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
    // isConnecting: isVoiceConnecting,
    // connectionError: voiceConnectionError
  } = useWebRTCVoice(webRTCParams);

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

  // Memoize commonProps to prevent child component re-renders
  const commonProps = useMemo(
    () => ({
      scaleState: {
        rootNote: scaleState.rootNote,
        scale: scaleState.scale,
        getScaleNotes: scaleState.getScaleNotes,
      },
      onPlayNotes: handlePlayNote,
      onStopNotes: handleStopNote,
      onStopSustainedNotes: stopSustainedNotes,
      onReleaseKeyHeldNote: handleReleaseKeyHeldNote,
      onSustainChange: handleSustainChange,
      onSustainToggleChange: handleSustainToggleChange,
    }),
    [
      scaleState.rootNote,
      scaleState.scale,
      scaleState.getScaleNotes,
      handlePlayNote,
      handleStopNote,
      stopSustainedNotes,
      handleReleaseKeyHeldNote,
      handleSustainChange,
      handleSustainToggleChange,
    ],
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

  // Initialize scale slots store and apply selected slot
  const { initialize, getSelectedSlot } = useScaleSlotsStore();

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

  // Copy room URL to clipboard with role selection
  const [isInvitePopupOpen, setIsInvitePopupOpen] = useState(false);
  const inviteBtnRef = useRef<HTMLButtonElement>(null);

  const handleCopyInviteUrl = async (role: "band_member" | "audience") => {
    try {
      const inviteUrl = `${window.location.origin}/invite/${currentRoom?.id}?role=${role}`;
      await navigator.clipboard.writeText(inviteUrl);

      // Show a temporary success message
      const button = document.getElementById(`copy-invite-${role}`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = "Copied!";
        button.classList.add("btn-success");

        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("btn-success");
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to copy invite URL:", error);
      // Fallback for older browsers
      const inviteUrl = `${window.location.origin}/invite/${currentRoom?.id}?role=${role}`;
      const textArea = document.createElement("textarea");
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  // Render pending approval modal
  if (
    pendingApproval ||
    (currentRoom &&
      currentUser &&
      currentRoom.pendingMembers.some((member) => member.id === currentUser.id))
  ) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center flex flex-col items-center justify-center">
            <h2 className="card-title justify-center text-xl">
              Waiting for Approval
            </h2>
            <p className="text-base-content/70 mb-4">
              Your request to join as a band member is pending approval from the
              room owner.
            </p>
            <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
            <div className="card-actions justify-center mt-4">
              <button onClick={handleLeaveRoom} className="btn btn-outline">
                Cancel Request
              </button>
            </div>
          </div>
        </div>
      </div>
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
                      <div className="space-y-2">
                        <button
                          id="copy-invite-band_member"
                          onClick={() => handleCopyInviteUrl("band_member")}
                          className="btn btn-sm btn-primary w-full justify-start"
                          title="Copy link for band member invitation"
                        >
                          🎸 Band Member
                        </button>
                        <button
                          id="copy-invite-audience"
                          onClick={() => handleCopyInviteUrl("audience")}
                          className="btn btn-sm btn-outline w-full justify-start"
                          title="Copy link for audience invitation"
                        >
                          👥 Audience
                        </button>
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
                                <div className="flex gap-1 pr-1">
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

                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isConnected
                        ? "bg-success"
                        : isConnecting
                          ? "bg-warning"
                          : "bg-error"
                    }`}
                  ></div>
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
              />
            )}

            {/* Instrument Controls */}
            {(currentUser?.role === "room_owner" ||
              currentUser?.role === "band_member") && (
              <>
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
                    <div className="w-full max-w-6xl mb-3">
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
            onPlayNotesLocal={playNotes}
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
