import { useMidiController } from "@/features/audio";
import { useRoomSocket } from "@/features/audio/hooks/useRoomSocket";
import { useInstrument } from "@/features/instruments/hooks/useInstrument";
import { useRoomStore } from "@/features/rooms";
import { useScaleState } from "@/features/ui";
import { useUserStore } from "@/shared/stores/userStore";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { InstrumentCategory } from "@/shared/constants/instruments";

import { useRoomAnalytics } from "./modules/useRoomAnalytics";
import { useRoomScaleSync } from "./modules/useRoomScaleSync";
import { useRoomActions } from "./modules/useRoomActions";
import { useRoomInstrumentSync } from "./modules/useRoomInstrumentSync";
import { useRoomNoteHandler } from "./modules/useRoomNoteHandler";
import { useRoomSocketHandlers } from "./modules/useRoomSocketHandlers";

export const useRoom = (options?: { isInstrumentMuted?: boolean }) => {
  const { isInstrumentMuted = false } = options || {};
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();

  // Prevent loops
  const hasInitialInstrumentSent = useRef(false);

  // Stores
  const { username, userId } = useUserStore();
  const scaleState = useScaleState();
  const { getSelectedSlot, setSlot } = useScaleSlotsStore();
  const {
    currentRoom,
    currentUser,
    pendingApproval,
    error,
  } = useRoomStore();

  // Instrument Hook
  const instrument = useInstrument();
  const {
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
    handleInstrumentChange,
    handleCategoryChange,
    getCurrentInstrumentControlType,
    updateSynthParams: instrumentUpdateSynthParams,
    stopSustainedNotes,
    initializeAudioContext,
    playNote: playLocalNote,
    stopNotes: stopLocalNotes,
    setSustainState,
    setRemoteUserSustain,
    updateRemoteUserSynthParams,
    updateRemoteUserInstrument,
    playRemoteUserNote,
    stopRemoteUserNote,
    instrumentManager,
  } = instrument;

  // Room Socket Hook
  const roomSocket = useRoomSocket();
  const {
    connectionState,
    isConnected,
    isConnecting,
    connectToRoom,
    cancelApprovalRequest,
    leaveRoom,
    playNote,
    changeInstrument,
    updateSynthParams,
    stopAllNotes,
    sendChatMessage,
    approveMember,
    rejectMember,
    requestInstrumentSwap,
    approveInstrumentSwap,
    rejectInstrumentSwap,
    cancelInstrumentSwap,
    kickUser,
    onNoteReceived,
    onInstrumentChanged,
    onSynthParamsChanged,
    onRequestSynthParamsResponse,
    onAutoSendSynthParamsToNewUser,
    onSendCurrentSynthParamsToNewUser,
    onRequestCurrentSynthParamsForNewUser,
    onSendSynthParamsToNewUserNow,
    onUserLeft,
    onGuestCancelled,
    onMemberRejected,
    onStopAllNotes,
    onSwapRequestReceived,
    onSwapRequestSent,
    onSwapApproved,
    onSwapRejected,
    onSwapCancelled,
    onSwapCompleted,
    onUserKicked,
    requestSequencerState,
    sendSequencerState,
    onSequencerStateRequested,
    onSequencerStateReceived,
    onRoomOwnerScaleChanged,
    onFollowRoomOwnerToggled,
    changeRoomOwnerScale,
    toggleFollowRoomOwner,
    getActiveSocket,
    cleanup: socketCleanup,
  } = roomSocket;

  // UI State
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [playingIndicators, setPlayingIndicators] = useState<
    Map<string, { velocity: number; timestamp: number }>
  >(new Map());
  const [fallbackNotification, setFallbackNotification] = useState<{
    message: string;
  } | null>(null);

  // --- MODULES ---

  // 1. Analytics
  const { analyticsRoomContextRef } = useRoomAnalytics(
    currentRoom,
    connectionState,
  );

  // 2. Scale Sync
  useRoomScaleSync({
    connectionState,
    onRoomOwnerScaleChanged,
    onFollowRoomOwnerToggled,
  });

  // 3. Room Actions
  const actions = useRoomActions({
    connectionState,
    userId,
    cancelApprovalRequest,
    leaveRoom,
    approveMember,
    rejectMember,
    sendChatMessage,
    setShowLeaveConfirmModal,
  });

  // 4. Instrument Sync Wrappers
  const instrumentSync = useRoomInstrumentSync({
    isConnected,
    currentInstrument,
    currentCategory,
    synthState,
    stopAllNotes,
    handleInstrumentChange,
    changeInstrument,
    updateSynthParams,
    handleCategoryChange,
    instrumentUpdateSynthParams,
    analyticsRoomContextRef,
  });

  // 5. Note Handling
  const noteHandler = useRoomNoteHandler({
    isConnected,
    userId,
    currentInstrument,
    currentCategory,
    playLocalNote,
    stopLocalNotes,
    playNote,
    setPlayingIndicators,
    setSustainState,
  });

  // 6. Socket Handlers (Auto-instruments, Synth Params, Listeners)
  useRoomSocketHandlers({
    state: {
      connectionState,
      currentInstrument,
      currentCategory,
      userId,
      currentUser,
      synthState,
      isSynthesizerLoaded,
      hasInitialInstrumentSent,
    },
    actions: {
      changeInstrument,
      updateSynthParams,
      updateRemoteUserSynthParams,
      updateRemoteUserInstrument,
      stopRemoteUserNote,
    },
    events: {
      onSynthParamsChanged,
      onRequestSynthParamsResponse,
      onAutoSendSynthParamsToNewUser,
      onSendCurrentSynthParamsToNewUser,
      onRequestCurrentSynthParamsForNewUser,
      onSendSynthParamsToNewUserNow,
      onInstrumentChanged,
      onStopAllNotes,
    },
  });

  // --- SOCKET REF & INIT ---

  const socketRef = useRef<Socket | null>(getActiveSocket());
  useEffect(() => {
    const newSocket = getActiveSocket();
    if (socketRef.current !== newSocket) {
      socketRef.current = newSocket;
    }
  }, [getActiveSocket, connectionState]);

  // Initialize Connection
  useEffect(() => {
    if (!roomId || !username || !userId) {
      window.location.href = "/";
      return;
    }
    const role = (location.state as any)?.role || "audience";
    if (
      connectionState !== ConnectionState.IN_ROOM &&
      connectionState !== ConnectionState.REQUESTING
    ) {
      connectToRoom(roomId, role);
    }
  }, [
    roomId,
    username,
    userId,
    location.state,
    connectionState,
    connectToRoom,
  ]);

  // Handle redirects
  useEffect(() => {
    if (connectionState === ConnectionState.LOBBY) {
      window.location.href = "/";
    }
  }, [connectionState]);

  // Reset flag on disconnect
  useEffect(() => {
    if (connectionState !== ConnectionState.IN_ROOM) {
      hasInitialInstrumentSent.current = false;
    }
  }, [connectionState]);

  // Cleanup
  useEffect(() => {
    return () => {
      socketCleanup();
    };
  }, [socketCleanup]);

  // --- Note Receiver Listener ---
  useEffect(() => {
    if (connectionState !== ConnectionState.IN_ROOM) return;

    const unsubscribe = onNoteReceived(async (data) => {
      if (data.eventType === "note_on") {
        setPlayingIndicators((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.userId, {
            velocity: data.velocity,
            timestamp: Date.now(),
          });
          return newMap;
        });
        setTimeout(() => {
          setPlayingIndicators((prev) => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        }, 200);

        try {
          if (data.notes && data.notes.length > 0) {
            await playRemoteUserNote(
              data.userId,
              data.username || "Unknown",
              data.notes,
              data.velocity,
              data.instrument,
              data.category as InstrumentCategory,
              data.isKeyHeld || false,
              data.sampleNotes,
            );
          }
        } catch (error) {
          console.error("❌ Failed to play remote notes:", error);
        }
      } else if (data.eventType === "note_off") {
        try {
          if (data.notes && data.notes.length > 0) {
            await stopRemoteUserNote(
              data.userId,
              data.notes,
              data.instrument,
              data.category as InstrumentCategory,
            );
          }
        } catch (error) {
          console.error("❌ Failed to stop remote notes:", error);
        }
      } else if (data.eventType === "sustain_on") {
        try {
          setRemoteUserSustain(
            data.userId,
            true,
            data.instrument,
            data.category as InstrumentCategory,
          );
        } catch (error) {
          console.error("❌ Failed to set remote sustain on:", error);
        }
      } else if (data.eventType === "sustain_off") {
        try {
          setRemoteUserSustain(
            data.userId,
            false,
            data.instrument,
            data.category as InstrumentCategory,
          );
        } catch (error) {
          console.error("❌ Failed to set remote sustain off:", error);
        }
      }
    });
    return unsubscribe;
  }, [onNoteReceived, connectionState, playRemoteUserNote, stopRemoteUserNote, setRemoteUserSustain]);

  // User Left / Rejected Listeners
  useEffect(() => {
    const unsubscribe = onUserLeft((user) => {
      setPlayingIndicators((prev) => {
        const newMap = new Map(prev);
        newMap.delete(user.id);
        return newMap;
      });
    });
    return unsubscribe;
  }, [onUserLeft]);

  useEffect(() => {
    const unsubscribe = onGuestCancelled(() => {});
    return unsubscribe;
  }, [onGuestCancelled]);

  useEffect(() => {
    const unsubscribe = onMemberRejected(() => {});
    return unsubscribe;
  }, [onMemberRejected]);

  // MIDI Controller
  const midiController = useMidiController({
    onNoteOn: useCallback(
      (note: number, velocity: number) => {
        const noteNames = [
          "C",
          "C#",
          "D",
          "D#",
          "E",
          "F",
          "F#",
          "G",
          "G#",
          "A",
          "A#",
          "B",
        ];
        const octave = Math.floor(note / 12) - 1;
        const noteName = noteNames[note % 12] + octave;
        const playNoteHandler = noteHandler.createPlayNoteHandler(
          isInstrumentMuted,
        );
        playNoteHandler([noteName], velocity, "note_on", true);
      },
      [noteHandler, isInstrumentMuted],
    ),
    onNoteOff: useCallback(
      (note: number) => {
        const noteNames = [
          "C",
          "C#",
          "D",
          "D#",
          "E",
          "F",
          "F#",
          "G",
          "G#",
          "A",
          "A#",
          "B",
        ];
        const octave = Math.floor(note / 12) - 1;
        const noteName = noteNames[note % 12] + octave;
        noteHandler.handleStopNote([noteName]);
      },
      [noteHandler],
    ),
    onControlChange: () => {},
    onPitchBend: () => {},
    onSustainChange: noteHandler.handleSustainChange,
  });

  // Room Owner Actions Wrappers
  const handleRoomOwnerScaleChange = useCallback(
    (rootNote: string, scale: import("../../../shared/types").Scale) => {
      if (currentUser?.role === "room_owner") {
        changeRoomOwnerScale(rootNote, scale);
      }
    },
    [currentUser?.role, changeRoomOwnerScale],
  );

  const handleToggleFollowRoomOwner = useCallback(
    (follow: boolean) => {
      if (currentUser?.role === "band_member") {
        toggleFollowRoomOwner(follow);

        if (follow && currentRoom?.ownerScale) {
          console.log(
            "🎵 Immediately syncing to room owner scale:",
            currentRoom.ownerScale,
          );
          scaleState.setRootNote(currentRoom.ownerScale.rootNote);
          scaleState.setScale(currentRoom.ownerScale.scale);

          const selectedSlot = getSelectedSlot();
          if (selectedSlot) {
            setSlot(
              selectedSlot.id,
              currentRoom.ownerScale.rootNote,
              currentRoom.ownerScale.scale,
            );
          }
        }
      }
    },
    [
      currentUser?.role,
      toggleFollowRoomOwner,
      currentRoom?.ownerScale,
      scaleState,
      getSelectedSlot,
      setSlot,
    ],
  );

  const clearFallbackNotification = useCallback(() => {
    setFallbackNotification(null);
  }, []);

  return {
    // Room state
    currentRoom,
    currentUser,
    pendingApproval,
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
    handlePlayNote: noteHandler.handlePlayNote,
    handlePlayNoteMuted: noteHandler.handlePlayNoteMuted,
    createPlayNoteHandler: noteHandler.createPlayNoteHandler,
    handleStopNote: noteHandler.handleStopNote,
    handleReleaseKeyHeldNote: noteHandler.handleReleaseKeyHeldNote,
    handleSustainChange: noteHandler.handleSustainChange,
    handleSustainToggleChange: noteHandler.handleSustainToggleChange,
    handleApproveMember: actions.handleApproveMember,
    handleRejectMember: actions.handleRejectMember,
    handleLeaveRoom: actions.handleLeaveRoom,
    handleLeaveRoomClick: actions.handleLeaveRoomClick,
    handleLeaveRoomConfirm: actions.handleLeaveRoomConfirm,
    clearFallbackNotification,
    sendChatMessage: actions.handleSendChatMessage,

    // Instrument management
    handleInstrumentChange: instrumentSync.handleInstrumentChangeWrapper,
    handleCategoryChange: instrumentSync.handleCategoryChangeWrapper,
    getCurrentInstrumentControlType,
    updateSynthParams: instrumentSync.updateSynthParamsWrapper,
    loadPresetParams: instrumentSync.loadPresetParamsWrapper,

    // Audio management
    stopSustainedNotes,
    initializeAudioContext,

    // Instrument manager
    instrumentManager,

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

    // Sequencer snapshot exchange
    requestSequencerState,
    sendSequencerState,
    onSequencerStateRequested,
    onSequencerStateReceived,

    // Scale follow handlers
    handleRoomOwnerScaleChange,
    handleToggleFollowRoomOwner,

    // Room settings
    handleUpdateRoomSettings: actions.handleUpdateRoomSettings,

    // Socket connection
    socketRef,
    getActiveSocket,
  };
};
