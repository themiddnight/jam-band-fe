import { useMidiController } from "@/features/audio";
import { useRoomSocket } from "@/features/audio/hooks/useRoomSocket";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { useInstrument } from "@/features/instruments/hooks/useInstrument";
import { useRoomStore } from "@/features/rooms";
import { useScaleState } from "@/features/ui";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { useUserStore } from "@/shared/stores/userStore";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { useSequencerStore } from "@/features/sequencer";

/**
 * Room hook using the RoomSocketManager for namespace-based connections
 */
export const useRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  // const navigate = useNavigate();

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
    
    getActiveSocket,
    cleanup: socketCleanup,
  } = useRoomSocket();

  // Room store
  const { currentRoom, currentUser, pendingApproval, clearRoom } =
    useRoomStore();

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

  // Set up note received handler - only when socket is connected
  useEffect(() => {
    // Only set up the handler when we're connected to a room
    if (connectionState !== ConnectionState.IN_ROOM) {
      console.log(
        "🔧 Skipping onNoteReceived setup - not in room yet:",
        connectionState,
      );
      return;
    }

    console.log(
      "🔧 Setting up onNoteReceived handler - connection state:",
      connectionState,
    );
    const unsubscribe = onNoteReceived(async (data) => {
      console.log("🎵 Received remote note:", data);

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
            data.isKeyHeld,
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
            data.userId,
          );
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
        // Apply remote sustain for the remote user only
        console.log("🎵 Remote sustain ON from user:", data.userId);
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
        // Release remote sustain for the remote user only
        console.log("🎵 Remote sustain OFF from user:", data.userId);
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
      console.log("🎵 Instrument changed event received:", data);
      
      // Stop all notes for this remote user before updating their instrument
      if (data.userId !== userId) {
        console.log("🛑 Stopping all notes for remote user before instrument change:", data.username);
        // Stop all notes for this remote user
        stopRemoteUserNote(data.userId, [], data.instrument, data.category as any);
      }
      
      // Update the remote user's instrument
      updateRemoteUserInstrument(
        data.userId,
        data.username,
        data.instrument,
        data.category as any,
      );
    },
    [userId, updateRemoteUserInstrument, stopRemoteUserNote],
  );

  // Handle stop all notes
  const handleStopAllNotes = useCallback(
    (data: {
      userId: string;
      username: string;
      instrument: string;
      category: string;
    }) => {
      console.log("🛑 Stop all notes event received:", data);
      // Stop all notes for the remote user
      if (data.userId !== userId) {
        console.log("🛑 Stopping all notes for remote user:", data.username);
        // Always stop all notes for this user, regardless of playing indicators
        stopRemoteUserNote(data.userId, [], data.instrument, data.category as any);
      }
    },
    [userId, stopRemoteUserNote],
  );

  useEffect(() => {
    // Only set up the handler when we're connected to a room
    if (connectionState !== ConnectionState.IN_ROOM) {
      console.log(
        "🔧 Skipping onInstrumentChanged setup - not in room yet:",
        connectionState,
      );
      return;
    }

    console.log("🔧 Setting up onInstrumentChanged handler");
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
        connectionState,
      );
      return;
    }

    console.log("🔧 Setting up onStopAllNotes handler");
    const unsubscribe = onStopAllNotes(handleStopAllNotes);
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStopAllNotes, connectionState]);

  // Set up synth params changed handler
  useEffect(() => {
    const unsubscribe = onSynthParamsChanged((data) => {
      // Handle synth parameter changes from other users
      console.log("Synth params changed:", data);
      try {
        // Update synth parameters for the remote user
        updateRemoteUserSynthParams(
          data.userId,
          data.username,
          data.instrument,
          data.category as InstrumentCategory,
          data.params,
        );
      } catch (error) {
        console.error("❌ Failed to update remote synth params:", error);
      }
    });

    return unsubscribe;
  }, [onSynthParamsChanged, updateRemoteUserSynthParams]);

  // Set up request synth params response handler
  useEffect(() => {
    const unsubscribe = onRequestSynthParamsResponse((data) => {
      // Handle requests for synth parameters
      console.log("Synth params requested:", data);
      
      // Send current synth parameters if we're using a synthesizer
      if (currentCategory === InstrumentCategory.Synthesizer && synthState && Object.keys(synthState).length > 0) {
        console.log("🎛️ Sending current synth params in response to request:", synthState);
        updateSynthParams(synthState);
      }
    });

    return unsubscribe;
  }, [onRequestSynthParamsResponse, currentCategory, synthState, updateSynthParams]);

  // Set up auto send synth params to new user handler
  useEffect(() => {
    const unsubscribe = onAutoSendSynthParamsToNewUser((data) => {
      console.log("🎛️ [DEBUG] Auto-send synth params to new user requested:", data);
      console.log("🎛️ [DEBUG] Current category:", currentCategory);
      console.log("🎛️ [DEBUG] Current synthState:", synthState);
      
      // Send current synth parameters if we're using a synthesizer
      if (currentCategory === InstrumentCategory.Synthesizer && synthState && Object.keys(synthState).length > 0) {
        console.log("🎛️ Auto-sending current synth params to new user:", synthState);
        updateSynthParams(synthState);
      } else {
        console.log("🎛️ [DEBUG] Not sending synth params - not using synthesizer or no synth state");
      }
    });

    return unsubscribe;
  }, [onAutoSendSynthParamsToNewUser, currentCategory, synthState, updateSynthParams]);

  // Set up send current synth params to new user handler
  useEffect(() => {
    const unsubscribe = onSendCurrentSynthParamsToNewUser((data) => {
      console.log("🎛️ [DEBUG] Send current synth params to new user:", data);
      console.log("🎛️ [DEBUG] Current category:", currentCategory);
      console.log("🎛️ [DEBUG] Current synthState:", synthState);
      
      // Send current synth parameters if we're using a synthesizer
      if (currentCategory === InstrumentCategory.Synthesizer && synthState && Object.keys(synthState).length > 0) {
        console.log("🎛️ Sending current synth params to new user:", synthState);
        updateSynthParams(synthState);
      } else {
        console.log("🎛️ [DEBUG] Not sending synth params - not using synthesizer or no synth state");
      }
    });

    return unsubscribe;
  }, [onSendCurrentSynthParamsToNewUser, currentCategory, synthState, updateSynthParams]);

  // Set up request current synth params for new user handler
  useEffect(() => {
    const unsubscribe = onRequestCurrentSynthParamsForNewUser((data) => {
      console.log("🎛️ [DEBUG] Request current synth params for new user:", data);
      console.log("🎛️ [DEBUG] Current category:", currentCategory);
      console.log("🎛️ [DEBUG] Current synthState:", synthState);
      console.log("🎛️ [DEBUG] My userId:", userId);
      
      // Only respond if this request is for us and we're using a synthesizer
      if (data.synthUserId === userId && currentCategory === InstrumentCategory.Synthesizer && synthState && Object.keys(synthState).length > 0) {
        console.log("🎛️ Responding to synth params request for new user:", synthState);
        updateSynthParams(synthState);
      } else {
        console.log("🎛️ [DEBUG] Not responding to synth params request - not for us or not using synthesizer");
      }
    });

    return unsubscribe;
  }, [onRequestCurrentSynthParamsForNewUser, currentCategory, synthState, updateSynthParams, userId]);

  // Set up send synth params to new user now handler
  useEffect(() => {
    const unsubscribe = onSendSynthParamsToNewUserNow((data) => {
      console.log("🎛️ [DEBUG] Send synth params to new user now:", data);
      console.log("🎛️ [DEBUG] Current category:", currentCategory);
      console.log("🎛️ [DEBUG] Current synthState:", synthState);
      console.log("🎛️ [DEBUG] My userId:", userId);
      
      // Only respond if this request is for us and we're using a synthesizer
      if (data.synthUserId === userId && currentCategory === InstrumentCategory.Synthesizer && synthState && Object.keys(synthState).length > 0) {
        console.log("🎛️ Immediately sending synth params to new user:", synthState);
        updateSynthParams(synthState);
      } else {
        console.log("🎛️ [DEBUG] Not immediately sending synth params - not for us or not using synthesizer");
      }
    });

    return unsubscribe;
  }, [onSendSynthParamsToNewUserNow, currentCategory, synthState, updateSynthParams, userId]);

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
    const unsubscribe = onGuestCancelled((userId) => {
      // Handle when a guest cancels their approval request
      console.log("Guest cancelled:", userId);
    });

    return unsubscribe;
  }, [onGuestCancelled]);

  // Set up member rejected handler
  useEffect(() => {
    const unsubscribe = onMemberRejected((userId) => {
      // Handle when a member is rejected
      console.log("Member rejected:", userId);
    });

    return unsubscribe;
  }, [onMemberRejected]);

  // Note playing handlers
  const handlePlayNote = useCallback(
    async (
      notes: string[],
      velocity: number,
      eventType: "note_on" | "note_off" | "sustain_on" | "sustain_off",
      isKeyHeld?: boolean,
    ) => {
      console.log("🎵 handlePlayNote called:", {
        notes,
        velocity,
        eventType,
        isKeyHeld,
        isConnected,
      });

      // Always play locally first
      try {
        if (eventType === "note_on") {
          console.log("🎵 Playing locally:", { notes, velocity, isKeyHeld });
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
          console.log("🛑 Stopping locally:", { notes });
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

      const noteData = {
        notes,
        velocity,
        instrument: currentInstrument,
        category: currentCategory,
        eventType,
        isKeyHeld,
      };

      console.log("🎵 Sending noteData to playNote:", noteData);
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
    ],
  );

  const handleStopNote = useCallback(
    (notes: string[] | string) => {
      const notesArray = Array.isArray(notes) ? notes : [notes];
      handlePlayNote(notesArray, 0, "note_off");
    },
    [handlePlayNote],
  );

  const handleReleaseKeyHeldNote = useCallback(
    (note: string) => {
      handlePlayNote([note], 0, "note_off", false);
    },
    [handlePlayNote],
  );

  const handleSustainChange = useCallback(
    (sustained: boolean) => {
      // Apply sustain locally first
      setSustainState(sustained);

      // Send to remote users if connected
      if (!isConnected) return;
      handlePlayNote([], 0, sustained ? "sustain_on" : "sustain_off");
    },
    [isConnected, handlePlayNote, setSustainState],
  );

  const handleSustainToggleChange = useCallback(
    (sustained: boolean) => {
      handleSustainChange(sustained);
    },
    [handleSustainChange],
  );

  // MIDI controller (defined after handlers)
  const midiController = useMidiController({
    onNoteOn: (note: number, velocity: number) => {
      // Convert MIDI note number to note name and call handlePlayNote
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
      handlePlayNote([noteName], velocity, "note_on", true);
    },
    onNoteOff: (note: number) => {
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
    },
    onControlChange: () => {}, // Not used in this context
    onPitchBend: () => {}, // Not used in this context
    onSustainChange: handleSustainChange,
  });

  // Room management handlers
  const handleApproveMember = useCallback(
    (userId: string) => {
      approveMember(userId);
    },
    [approveMember],
  );

  const handleRejectMember = useCallback(
    (userId: string) => {
      rejectMember(userId);
    },
    [rejectMember],
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
      );

      // Stop all notes before switching instruments
      if (isConnected) {
        console.log("🛑 Sending stop all notes to remote users before instrument switch");
        stopAllNotes(currentInstrument, currentCategory);
      }

      // Stop sequencer playback if it's playing
      if (sequencerStore.isPlaying) {
        console.log("🛑 Stopping sequencer playback before instrument switch");
        sequencerStore.hardStop();
      }

      await handleInstrumentChange(instrument);
      if (isConnected) {
        console.log(
          "🎵 Sending instrument change to remote users:",
          instrument,
          currentCategory,
        );
        changeInstrument(instrument, currentCategory);

        // Send current synth parameters as preset for the new instrument
        console.log(
          "🎛️ Sending current synth preset for new instrument:",
          instrument,
        );
        console.log("🎛️ Current synthState:", synthState);
        if (synthState && Object.keys(synthState).length > 0) {
          console.log("🎛️ Sending synth preset to remote users:", synthState);
          updateSynthParams(synthState);
        } else {
          console.log("🎛️ No synth state to send as preset");
        }
      } else {
        console.log("🎵 Not connected, skipping remote instrument change send");
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
    ],
  );

  const handleCategoryChangeWrapper = useCallback(
    (category: string) => {
      console.log("🎵 Category change wrapper called:", category);
      
      // Stop all notes before changing category
      if (isConnected) {
        console.log("🛑 Sending stop all notes to remote users before category change");
        stopAllNotes(currentInstrument, currentCategory);
      }

      // Stop sequencer playback if it's playing
      if (sequencerStore.isPlaying) {
        console.log("🛑 Stopping sequencer playback before category change");
        sequencerStore.hardStop();
      }
      
      handleCategoryChange(category as any);
      // Don't send remote change here - let the subsequent instrument change handle it
      // The local category change will trigger an instrument change to the default instrument
      // of that category, and handleInstrumentChangeWrapper will send the correct instrument
      console.log(
        "🎵 Category changed locally, waiting for instrument change to sync to remote",
      );
    },
    [handleCategoryChange, isConnected, stopAllNotes, currentInstrument, currentCategory, sequencerStore],
  );

  // Synth parameter update
  const updateSynthParamsWrapper = useCallback(
    (params: any) => {
      console.log("🎛️ updateSynthParamsWrapper called with params:", params);
      console.log("🎛️ isConnected:", isConnected);
      console.log("🎛️ Calling local instrumentUpdateSynthParams...");
      instrumentUpdateSynthParams(params);
      if (isConnected) {
        console.log(
          "🎛️ Connected - sending synth params to remote users:",
          params,
        );
        updateSynthParams(params);
      } else {
        console.log("🎛️ Not connected, skipping remote synth params send");
      }
    },
    [instrumentUpdateSynthParams, isConnected, updateSynthParams],
  );

  // Broadcast full preset parameters as well
  const loadPresetParamsWrapper = useCallback(
    (params: any) => {
      console.log("🎛️ loadPresetParamsWrapper called with params:", params);
      instrumentUpdateSynthParams(params);
      if (isConnected) {
        console.log(
          "🎛️ Connected - broadcasting preset synth params to remote users",
        );
        updateSynthParams(params);
      }
    },
    [instrumentUpdateSynthParams, isConnected, updateSynthParams],
  );

  // Chat message handler
  const handleSendChatMessage = useCallback(
    (message: string) => {
      if (!currentRoom?.id) return;
      sendChatMessage(message, currentRoom.id);
    },
    [currentRoom?.id, sendChatMessage],
  );

  // Notification handlers
  const clearFallbackNotification = useCallback(() => {
    setFallbackNotification(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketCleanup();
    };
  }, [socketCleanup]);

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

    // Socket connection
    socketRef,
    getActiveSocket,
  };
};
