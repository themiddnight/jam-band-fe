import { useMidiController } from "@/features/audio";
import { useRoomSocket } from "@/features/audio/hooks/useRoomSocket";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { useInstrument } from "@/features/instruments/hooks/useInstrument";
import { gmNoteMapper } from "@/features/instruments";
import { useRoomStore } from "@/features/rooms";
import { updateRoomSettings } from "@/features/rooms/services/api";
import type { UpdateRoomSettingsRequest } from "@/features/rooms/services/api";
import { useScaleState } from "@/features/ui";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { useUserStore } from "@/shared/stores/userStore";
import { useScaleSlotsStore } from "@/shared/stores/scaleSlotsStore";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { useSequencerStore } from "@/features/sequencer";
import {
  trackRoomSessionStart,
  trackRoomSessionEnd,
  trackInstrumentSelected,
} from "@/shared/analytics/events";
import { getRoomContext } from "@/shared/analytics/context";
import type { RoomContext } from "@/shared/analytics/events";

/**
 * Room hook using the RoomSocketManager for namespace-based connections
 */
export const useRoom = (options?: { isInstrumentMuted?: boolean }) => {
  const { isInstrumentMuted = false } = options || {};
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  // const navigate = useNavigate();

  // Track whether we've already sent initial instrument data to prevent loops
  const hasInitialInstrumentSent = useRef(false);

  // User state
  const { username, userId } = useUserStore();

  // Instrument management
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
    updateSynthParams: instrumentUpdateSynthParams, // Local synth params update
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
  } = useInstrument();

  // Room socket
  const {
    connectionState,
    isConnected,
    isConnecting,
    error,
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

    // Instrument swap functions
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

    // Swap event handlers
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
    onRoomOwnerScaleChanged,
    onFollowRoomOwnerToggled,
    changeRoomOwnerScale,
    toggleFollowRoomOwner,

    getActiveSocket,
    cleanup: socketCleanup,
  } = useRoomSocket();

  // Room store
  const {
    currentRoom,
    currentUser,
    pendingApproval,
    clearRoom,
    updateOwnerScale,
    updateUserFollowMode,
  } = useRoomStore();

  const roomContext = useMemo(() => getRoomContext(currentRoom), [currentRoom]);
  const analyticsRoomContextRef = useRef<RoomContext>({});
  const roomSessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    analyticsRoomContextRef.current = roomContext;
  }, [roomContext]);

  useEffect(() => {
    const activeContext = roomContext.roomId
      ? roomContext
      : analyticsRoomContextRef.current;

    if (
      connectionState === ConnectionState.IN_ROOM &&
      roomContext.roomId &&
      !roomSessionStartRef.current
    ) {
      roomSessionStartRef.current = Date.now();
      trackRoomSessionStart(roomContext);
    }

    if (
      connectionState !== ConnectionState.IN_ROOM &&
      roomSessionStartRef.current &&
      activeContext.roomId
    ) {
      const duration = Date.now() - roomSessionStartRef.current;
      trackRoomSessionEnd(activeContext, duration);
      roomSessionStartRef.current = null;
    }
  }, [connectionState, roomContext]);

  useEffect(() => {
    return () => {
      if (roomSessionStartRef.current && analyticsRoomContextRef.current.roomId) {
        const duration = Date.now() - roomSessionStartRef.current;
        trackRoomSessionEnd(analyticsRoomContextRef.current, duration);
      }
      roomSessionStartRef.current = null;
    };
  }, []);

  // Sequencer store
  const sequencerStore = useSequencerStore();

  // UI state
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [playingIndicators, setPlayingIndicators] = useState<
    Map<string, { velocity: number; timestamp: number }>
  >(new Map());
  const [fallbackNotification, setFallbackNotification] = useState<{
    message: string;
  } | null>(null);

  // Scale state
  const scaleState = useScaleState();

  // Scale slots store
  const { setSlot, getSelectedSlot } = useScaleSlotsStore();

  // Socket ref for ping measurement - needs to be updated when active socket changes
  const socketRef = useRef<Socket | null>(getActiveSocket());

  // Update socket ref when active socket changes
  useEffect(() => {
    const newSocket = getActiveSocket();
    if (socketRef.current !== newSocket) {
      socketRef.current = newSocket;
    }
  }, [getActiveSocket, connectionState]);

  // Initialize room connection
  useEffect(() => {
    if (!roomId || !username || !userId) {
      window.location.href = "/";
      return;
    }

    // Get role from location state or default to audience
    const role = (location.state as any)?.role || "audience";

    // Only connect if not already connected to this room
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
    // navigate,
  ]);

  // Handle connection state changes
  useEffect(() => {
    if (connectionState === ConnectionState.LOBBY) {
      // If we're back in lobby state, navigate to lobby
      window.location.href = "/";
    }
  }, [connectionState]);

  // Reset the initial instrument sent flag when disconnecting from room
  useEffect(() => {
    if (connectionState !== ConnectionState.IN_ROOM) {
      hasInitialInstrumentSent.current = false;
    }
  }, [connectionState]);

  // Set up note received handler - only when socket is connected
  useEffect(() => {
    // Only set up the handler when we're connected to a room
    if (connectionState !== ConnectionState.IN_ROOM) {
      console.log(
        "🔧 Skipping onNoteReceived setup - not in room yet:",
        connectionState
      );
      return;
    }

    console.log(
      "🔧 Setting up onNoteReceived handler - connection state:",
      connectionState
    );
    const unsubscribe = onNoteReceived(async (data) => {
      // Handle received notes (this will be used by instrument components)
      if (data.eventType === "note_on") {
        setPlayingIndicators((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.userId, {
            velocity: data.velocity,
            timestamp: Date.now(),
          });
          return newMap;
        });

        // Clear playing indicator after a short delay
        setTimeout(() => {
          setPlayingIndicators((prev) => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        }, 200);

        // Play remote notes through remote user's instrument system
        try {
          console.log(
            "🎵 Playing remote notes:",
            data.notes,
            "from user:",
            data.userId,
            "instrument:",
            data.instrument,
            "category:",
            data.category,
            "isKeyHeld:",
            data.isKeyHeld
          );
          // Use the remote user note playing system for proper sustain handling
          if (data.notes && data.notes.length > 0) {
            console.log("🎵 Calling playRemoteUserNote with:", {
              userId: data.userId,
              username: data.username || "Unknown",
              notes: data.notes,
              velocity: data.velocity,
              instrument: data.instrument,
              category: data.category,
              isKeyHeld: data.isKeyHeld || false,
            });
            await playRemoteUserNote(
              data.userId,
              data.username || "Unknown",
              data.notes,
              data.velocity,
              data.instrument,
              data.category as InstrumentCategory,
              data.isKeyHeld || false,
              data.sampleNotes
            );
          }
        } catch (error) {
          console.error("❌ Failed to play remote notes:", error);
          console.error("❌ Remote note play error details:", error);
        }
      } else if (data.eventType === "note_off") {
        // Stop remote notes
        try {
          console.log(
            "🛑 Stopping remote notes:",
            data.notes,
            "from user:",
            data.userId
          );
          if (data.notes && data.notes.length > 0) {
            await stopRemoteUserNote(
              data.userId,
              data.notes,
              data.instrument,
              data.category as InstrumentCategory
            );
          }
        } catch (error) {
          console.error("❌ Failed to stop remote notes:", error);
        }
      } else if (data.eventType === "sustain_on") {
        // Apply remote sustain for the remote user only

        try {
          setRemoteUserSustain(
            data.userId,
            true,
            data.instrument,
            data.category as InstrumentCategory
          );
        } catch (error) {
          console.error("❌ Failed to set remote sustain on:", error);
        }
      } else if (data.eventType === "sustain_off") {
        // Release remote sustain for the remote user only

        try {
          setRemoteUserSustain(
            data.userId,
            false,
            data.instrument,
            data.category as InstrumentCategory
          );
        } catch (error) {
          console.error("❌ Failed to set remote sustain off:", error);
        }
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNoteReceived, connectionState]);

  // Handle instrument change
  const handleInstrumentChanged = useCallback(
    (data: {
      userId: string;
      username: string;
      instrument: string;
      category: string;
    }) => {
      // Stop all notes for this remote user before updating their instrument
      if (data.userId !== userId) {
        // Stop all notes for this remote user
        stopRemoteUserNote(
          data.userId,
          [],
          data.instrument,
          data.category as any
        );
      }

      // Update the remote user's instrument
      updateRemoteUserInstrument(
        data.userId,
        data.username,
        data.instrument,
        data.category as any
      );
    },
    [userId, updateRemoteUserInstrument, stopRemoteUserNote]
  );

  // Handle stop all notes
  const handleStopAllNotes = useCallback(
    (data: {
      userId: string;
      username: string;
      instrument: string;
      category: string;
    }) => {
      // Stop all notes for the remote user
      if (data.userId !== userId) {
        // Always stop all notes for this user, regardless of playing indicators
        stopRemoteUserNote(
          data.userId,
          [],
          data.instrument,
          data.category as any
        );
      }
    },
    [userId, stopRemoteUserNote]
  );

  useEffect(() => {
    // Only set up the handler when we're connected to a room
    if (connectionState !== ConnectionState.IN_ROOM) {
      console.log(
        "🔧 Skipping onInstrumentChanged setup - not in room yet:",
        connectionState
      );
      return;
    }

    const unsubscribe = onInstrumentChanged(handleInstrumentChanged);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onInstrumentChanged, connectionState]);

  // Set up stop all notes handler
  useEffect(() => {
    // Only set up the handler when we're connected to a room
    if (connectionState !== ConnectionState.IN_ROOM) {
      console.log(
        "🔧 Skipping onStopAllNotes setup - not in room yet:",
        connectionState
      );
      return;
    }

    const unsubscribe = onStopAllNotes(handleStopAllNotes);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStopAllNotes, connectionState]);

  // Automatically send user's current instrument preferences after joining room
  useEffect(() => {
    // Only send when we're connected to a room and have valid instrument data
    if (
      connectionState !== ConnectionState.IN_ROOM ||
      !currentInstrument ||
      !currentCategory ||
      currentUser?.role === "audience"
    ) {
      return;
    }

    // Prevent sending the same instrument repeatedly due to dependency changes
    if (hasInitialInstrumentSent.current) {
      return;
    }

    // Only send if we don't already have an instrument set on the server
    // (to avoid overwriting existing instrument data when user already has one)
    if (!currentUser?.currentInstrument || !currentUser?.currentCategory) {
      console.log(
        "🎵 Automatically sending current instrument preferences to server:",
        {
          instrument: currentInstrument,
          category: currentCategory,
          userRole: currentUser?.role,
        }
      );

      // Send the current instrument preferences to the backend
      // This ensures the user's stored preferences from localStorage are used
      changeInstrument(currentInstrument, currentCategory);
      hasInitialInstrumentSent.current = true;
    } else {
      console.log(
        "🎵 User already has instrument set on server, skipping auto-send:",
        {
          serverInstrument: currentUser.currentInstrument,
          serverCategory: currentUser.currentCategory,
          localInstrument: currentInstrument,
          localCategory: currentCategory,
        }
      );
      hasInitialInstrumentSent.current = true;
    }
  }, [
    connectionState,
    currentInstrument,
    currentCategory,
    currentUser,
    changeInstrument,
  ]);

  // Set up synth params changed handler
  useEffect(() => {
    const unsubscribe = onSynthParamsChanged((data) => {
      // Handle synth parameter changes from other users

      try {
        // Update synth parameters for the remote user
        updateRemoteUserSynthParams(
          data.userId,
          data.username,
          data.instrument,
          data.category as InstrumentCategory,
          data.params
        );
      } catch (error) {
        console.error("❌ Failed to update remote synth params:", error);
      }
    });

    return unsubscribe;
  }, [onSynthParamsChanged, updateRemoteUserSynthParams]);

  // Set up request synth params response handler
  useEffect(() => {
    const unsubscribe = onRequestSynthParamsResponse(() => {
      // Handle requests for synth parameters

      // Send current synth parameters if we're using a synthesizer
      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });

    return unsubscribe;
  }, [
    onRequestSynthParamsResponse,
    currentCategory,
    synthState,
    updateSynthParams,
  ]);

  // Set up auto send synth params to new user handler
  useEffect(() => {
    const unsubscribe = onAutoSendSynthParamsToNewUser(() => {
      // Send current synth parameters if we're using a synthesizer
      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });

    return unsubscribe;
  }, [
    onAutoSendSynthParamsToNewUser,
    currentCategory,
    synthState,
    updateSynthParams,
  ]);

  // Set up send current synth params to new user handler
  useEffect(() => {
    const unsubscribe = onSendCurrentSynthParamsToNewUser(() => {
      // Send current synth parameters if we're using a synthesizer
      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });

    return unsubscribe;
  }, [
    onSendCurrentSynthParamsToNewUser,
    currentCategory,
    synthState,
    updateSynthParams,
  ]);

  // Set up request current synth params for new user handler
  useEffect(() => {
    const unsubscribe = onRequestCurrentSynthParamsForNewUser((data) => {
      // Only respond if this request is for us and we're using a synthesizer
      if (
        data.synthUserId === userId &&
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });

    return unsubscribe;
  }, [
    onRequestCurrentSynthParamsForNewUser,
    currentCategory,
    synthState,
    updateSynthParams,
    userId,
  ]);

  // Set up send synth params to new user now handler
  useEffect(() => {
    const unsubscribe = onSendSynthParamsToNewUserNow((data) => {
      // Only respond if this request is for us and we're using a synthesizer
      if (
        data.synthUserId === userId &&
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });

    return unsubscribe;
  }, [
    onSendSynthParamsToNewUserNow,
    currentCategory,
    synthState,
    updateSynthParams,
    userId,
  ]);

  // Set up user left handler
  useEffect(() => {
    const unsubscribe = onUserLeft((user) => {
      // Clear playing indicator for user who left
      setPlayingIndicators((prev) => {
        const newMap = new Map(prev);
        newMap.delete(user.id);
        return newMap;
      });
    });

    return unsubscribe;
  }, [onUserLeft]);

  // Set up guest cancelled handler
  useEffect(() => {
    const unsubscribe = onGuestCancelled(() => {
      // Handle when a guest cancels their approval request
    });

    return unsubscribe;
  }, [onGuestCancelled]);

  // Set up member rejected handler
  useEffect(() => {
    const unsubscribe = onMemberRejected(() => {
      // Handle when a member is rejected
    });

    return unsubscribe;
  }, [onMemberRejected]);

  // Note playing handlers
  const handlePlayNote = useCallback(
    async (
      notes: string[],
      velocity: number,
      eventType: "note_on" | "note_off" | "sustain_on" | "sustain_off",
      isKeyHeld?: boolean
    ) => {
      // Always play locally first
      try {
        if (eventType === "note_on") {
          await playLocalNote(notes, velocity, isKeyHeld || false);

          // Set local playing indicator immediately for local user
          if (userId) {
            setPlayingIndicators((prev) => {
              const newMap = new Map(prev);
              newMap.set(userId, {
                velocity: velocity,
                timestamp: Date.now(),
              });
              return newMap;
            });

            // Clear local playing indicator after a short delay
            setTimeout(() => {
              setPlayingIndicators((prev) => {
                const newMap = new Map(prev);
                newMap.delete(userId);
                return newMap;
              });
            }, 200);
          }
        } else if (eventType === "note_off") {
          await stopLocalNotes(notes);
        }
      } catch (error) {
        console.error("❌ Failed to play locally:", error);
      }

      // Send to other users through socket if connected
      if (!isConnected) {
        console.warn("🚫 Not connected, skipping remote send");
        return;
      }

      let sampleNotes: string[] | undefined;
      if (
        eventType === "note_on" &&
        currentCategory === InstrumentCategory.DrumBeat &&
        notes.length > 0
      ) {
        sampleNotes = notes.map((note) => gmNoteMapper.gmNoteToSample(note) || note);
      }

      const noteData = {
        notes,
        velocity,
        instrument: currentInstrument,
        category: currentCategory,
        eventType,
        isKeyHeld,
        ...(sampleNotes ? { sampleNotes } : {}),
      };

      playNote(noteData);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isConnected,
      currentInstrument,
      currentCategory,
      playNote,
      playLocalNote,
      stopLocalNotes,
    ]
  );

  // Muted version of handlePlayNote - only plays locally, no socket messages
  const handlePlayNoteMuted = useCallback(
    async (
      notes: string[],
      velocity: number,
      eventType: "note_on" | "note_off" | "sustain_on" | "sustain_off",
      isKeyHeld?: boolean
    ) => {
      // Only play locally, no socket messages sent
      try {
        if (eventType === "note_on") {
          await playLocalNote(notes, velocity, isKeyHeld || false);

          // Set local playing indicator immediately for local user (visual feedback)
          if (userId) {
            setPlayingIndicators((prev) => {
              const newMap = new Map(prev);
              newMap.set(userId, {
                velocity: velocity,
                timestamp: Date.now(),
              });
              return newMap;
            });

            // Clear local playing indicator after a short delay
            setTimeout(() => {
              setPlayingIndicators((prev) => {
                const newMap = new Map(prev);
                newMap.delete(userId);
                return newMap;
              });
            }, 200);
          }
        } else if (eventType === "note_off") {
          await stopLocalNotes(notes);
        }
      } catch (error) {
        console.error("❌ Failed to play locally (muted mode):", error);
      }

      // No socket messages sent in muted mode
      console.log("🔇 Instrument muted - playing locally only");
    },
    [playLocalNote, stopLocalNotes, userId]
  );

  // Factory function to create the appropriate play note handler based on mute state
  const createPlayNoteHandler = useCallback(
    (isMuted: boolean) => {
      return isMuted ? handlePlayNoteMuted : handlePlayNote;
    },
    [handlePlayNoteMuted, handlePlayNote]
  );

  const handleStopNote = useCallback(
    (notes: string[] | string) => {
      const notesArray = Array.isArray(notes) ? notes : [notes];
      handlePlayNote(notesArray, 0, "note_off");
    },
    [handlePlayNote]
  );

  const handleReleaseKeyHeldNote = useCallback(
    (note: string) => {
      handlePlayNote([note], 0, "note_off", false);
    },
    [handlePlayNote]
  );

  const handleSustainChange = useCallback(
    (sustained: boolean) => {
      // Apply sustain locally first
      setSustainState(sustained);

      // Send to remote users if connected
      if (!isConnected) return;
      handlePlayNote([], 0, sustained ? "sustain_on" : "sustain_off");
    },
    [isConnected, handlePlayNote, setSustainState]
  );

  const handleSustainToggleChange = useCallback(
    (sustained: boolean) => {
      handleSustainChange(sustained);
    },
    [handleSustainChange]
  );

  // MIDI controller (defined after handlers)
  const midiController = useMidiController({
    onNoteOn: useCallback((note: number, velocity: number) => {
      // Convert MIDI note number to note name and call appropriate handler based on mute state
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
      // velocity is already normalized (0-1) from useMidiController, don't divide by 127 again
      const playNoteHandler = createPlayNoteHandler(isInstrumentMuted);
      playNoteHandler([noteName], velocity, "note_on", true);
    }, [createPlayNoteHandler, isInstrumentMuted]),
    onNoteOff: useCallback((note: number) => {
      // Convert MIDI note number to note name and call handleStopNote
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
      handleStopNote([noteName]);
    }, [handleStopNote]),
    onControlChange: () => { }, // Not used in this context
    onPitchBend: () => { }, // Not used in this context
    onSustainChange: handleSustainChange,
  });

  // Room management handlers
  const handleApproveMember = useCallback(
    (userId: string) => {
      approveMember(userId);
    },
    [approveMember]
  );

  const handleRejectMember = useCallback(
    (userId: string) => {
      rejectMember(userId);
    },
    [rejectMember]
  );

  // Leave room handlers
  const handleLeaveRoomClick = useCallback(() => {
    setShowLeaveConfirmModal(true);
  }, []);

  const handleLeaveRoomConfirm = useCallback(async () => {
    setShowLeaveConfirmModal(false);

    if (connectionState === ConnectionState.REQUESTING) {
      // If we're in approval state, cancel the request
      await cancelApprovalRequest();
    } else {
      // Otherwise, leave the room
      await leaveRoom();
    }

    // Clear room state and navigate to lobby
    clearRoom();
    window.location.href = "/";
  }, [connectionState, cancelApprovalRequest, leaveRoom, clearRoom]);

  const handleLeaveRoom = useCallback(async () => {
    if (connectionState === ConnectionState.REQUESTING) {
      await cancelApprovalRequest();
    } else {
      await leaveRoom();
    }
    clearRoom();
    window.location.href = "/";
  }, [connectionState, cancelApprovalRequest, leaveRoom, clearRoom]);

  // Instrument change handlers
  const handleInstrumentChangeWrapper = useCallback(
    async (instrument: string) => {
      console.log(
        "🎵 Instrument change wrapper called:",
        instrument,
        "category:",
        currentCategory,
        "currentInstrument:",
        currentInstrument
      );

      // Check if instrument actually changed - prevent redundant emissions
      if (instrument === currentInstrument) {
        console.log("🎵 Skipping instrument change - no actual change detected");
        return;
      }

      // Stop all notes before switching instruments
      if (isConnected) {
        stopAllNotes(currentInstrument, currentCategory);
      }

      // Stop sequencer playback if it's playing
      if (sequencerStore.isPlaying) {
        sequencerStore.hardStop();
      }

      await handleInstrumentChange(instrument);
      if (isConnected) {
        console.log(
          "🎵 Sending instrument change to remote users:",
          instrument,
          currentCategory
        );
        changeInstrument(instrument, currentCategory);

        // Send current synth parameters as preset for the new instrument
        console.log(
          "🎛️ Sending current synth preset for new instrument:",
          instrument
        );

        if (synthState && Object.keys(synthState).length > 0) {
          updateSynthParams(synthState);
        }
      }

      const ctx = analyticsRoomContextRef.current;
      if (ctx.roomId) {
        trackInstrumentSelected(ctx, instrument, currentCategory ?? "unknown");
      }
    },
    [
      handleInstrumentChange,
      isConnected,
      changeInstrument,
      currentCategory,
      synthState,
      updateSynthParams,
      sequencerStore,
      stopAllNotes,
      currentInstrument,
    ]
  );

  const handleCategoryChangeWrapper = useCallback(
    (category: string) => {
      // Stop all notes before changing category
      if (isConnected) {
        stopAllNotes(currentInstrument, currentCategory);
      }

      // Stop sequencer playback if it's playing
      if (sequencerStore.isPlaying) {
        sequencerStore.hardStop();
      }

      handleCategoryChange(category as any);
      // Don't send remote change here - let the subsequent instrument change handle it
      // The local category change will trigger an instrument change to the default instrument
      // of that category, and handleInstrumentChangeWrapper will send the correct instrument
      console.log(
        "🎵 Category changed locally, waiting for instrument change to sync to remote"
      );
    },
    [
      handleCategoryChange,
      isConnected,
      stopAllNotes,
      currentInstrument,
      currentCategory,
      sequencerStore,
    ]
  );

  // Synth parameter update
  const updateSynthParamsWrapper = useCallback(
    (params: any) => {
      instrumentUpdateSynthParams(params);
      if (isConnected) {
        console.log(
          "🎛️ Connected - sending synth params to remote users:",
          params
        );
        updateSynthParams(params);
      }
    },
    [instrumentUpdateSynthParams, isConnected, updateSynthParams]
  );

  // Broadcast full preset parameters as well
  const loadPresetParamsWrapper = useCallback(
    (params: any) => {
      instrumentUpdateSynthParams(params);
      if (isConnected) {
        console.log(
          "🎛️ Connected - broadcasting preset synth params to remote users"
        );
        updateSynthParams(params);
      }
    },
    [instrumentUpdateSynthParams, isConnected, updateSynthParams]
  );

  // Chat message handler
  const handleSendChatMessage = useCallback(
    (message: string) => {
      if (!currentRoom?.id) return;
      sendChatMessage(message, currentRoom.id);
    },
    [currentRoom?.id, sendChatMessage]
  );

  // Notification handlers
  const clearFallbackNotification = useCallback(() => {
    setFallbackNotification(null);
  }, []);

  // Scale event handlers
  useEffect(() => {
    if (connectionState !== ConnectionState.IN_ROOM) {
      return;
    }

    const unsubscribeOwnerScaleChanged = onRoomOwnerScaleChanged((data) => {
      updateOwnerScale(data.rootNote, data.scale);

      // If current user is following room owner, update their scale too
      if (currentUser?.followRoomOwner) {
        scaleState.setRootNote(data.rootNote);
        scaleState.setScale(data.scale);

        // Also update the current scale slot to match the new scale
        const selectedSlot = getSelectedSlot();
        if (selectedSlot) {
          setSlot(selectedSlot.id, data.rootNote, data.scale);
        }
      }
    });

    const unsubscribeFollowToggled = onFollowRoomOwnerToggled((data) => {
      if (currentUser) {
        updateUserFollowMode(currentUser.id, data.followRoomOwner);

        // If user just turned ON follow mode and there's an owner scale, sync immediately
        if (data.followRoomOwner && data.ownerScale) {
          scaleState.setRootNote(data.ownerScale.rootNote);
          scaleState.setScale(data.ownerScale.scale);

          // Also update the current scale slot to match
          const selectedSlot = getSelectedSlot();
          if (selectedSlot) {
            setSlot(selectedSlot.id, data.ownerScale.rootNote, data.ownerScale.scale);
          }
        }
      }
    });

    return () => {
      unsubscribeOwnerScaleChanged();
      unsubscribeFollowToggled();
    };
  }, [connectionState, onRoomOwnerScaleChanged, onFollowRoomOwnerToggled, updateOwnerScale, currentUser, scaleState, getSelectedSlot, setSlot, updateUserFollowMode]);

  // Scale handlers
  const handleRoomOwnerScaleChange = useCallback((rootNote: string, scale: import('../../../shared/types').Scale) => {
    if (currentUser?.role === 'room_owner') {
      changeRoomOwnerScale(rootNote, scale);
    }
  }, [currentUser?.role, changeRoomOwnerScale]);

  const handleToggleFollowRoomOwner = useCallback((follow: boolean) => {
    if (currentUser?.role === 'band_member') {
      toggleFollowRoomOwner(follow);

      // If turning ON follow mode and room owner has a scale, sync immediately
      if (follow && currentRoom?.ownerScale) {
        console.log("🎵 Immediately syncing to room owner scale:", currentRoom.ownerScale);
        scaleState.setRootNote(currentRoom.ownerScale.rootNote);
        scaleState.setScale(currentRoom.ownerScale.scale);

        // Also update the current scale slot to match
        const selectedSlot = getSelectedSlot();
        if (selectedSlot) {
          setSlot(selectedSlot.id, currentRoom.ownerScale.rootNote, currentRoom.ownerScale.scale);
        }
      }
    }
  }, [currentUser?.role, toggleFollowRoomOwner, currentRoom?.ownerScale, scaleState, getSelectedSlot, setSlot]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketCleanup();
    };
  }, [socketCleanup]);

  // Room settings handler
  const handleUpdateRoomSettings = useCallback(async (settings: {
    name?: string;
    description?: string;
    isPrivate?: boolean;
    isHidden?: boolean;
  }) => {
    if (!currentRoom?.id || !userId) {
      throw new Error("Room ID or user ID not available");
    }

    if (currentUser?.role !== "room_owner") {
      throw new Error("Only room owner can update settings");
    }

    const updateRequest: UpdateRoomSettingsRequest = {
      ...settings,
      updatedBy: userId,
    };

    try {
      const response = await updateRoomSettings(currentRoom.id, updateRequest);

      // The room state will be updated via socket events from the server
      // No need to manually update the store here

      return response;
    } catch (error) {
      console.error("Failed to update room settings:", error);
      throw error;
    }
  }, [currentRoom?.id, userId, currentUser?.role]);

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
    handlePlayNote,
    handlePlayNoteMuted,
    createPlayNoteHandler,
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
    sendChatMessage: handleSendChatMessage,

    // Instrument management
    handleInstrumentChange: handleInstrumentChangeWrapper,
    handleCategoryChange: handleCategoryChangeWrapper,
    getCurrentInstrumentControlType,
    updateSynthParams: updateSynthParamsWrapper,
    loadPresetParams: loadPresetParamsWrapper,

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
    handleUpdateRoomSettings,

    // Socket connection
    socketRef,
    getActiveSocket,
  };
};
