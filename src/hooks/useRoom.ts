/* eslint-disable react-hooks/exhaustive-deps */
import { InstrumentCategory } from "../constants/instruments";
import { useRoomQuery } from "../services/useRooms";
import { useRoomStore } from "../stores/roomStore";
import { useUserStore } from "../stores/userStore";
import { useInstrument } from "./useInstrument";
import { useMidiController } from "./useMidiController";
import { useScaleState } from "./useScaleState";
import { useSocket } from "./useSocket";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

export const useRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.state?.role as "band_member" | "audience";

  const { username, userId } = useUserStore();
  const { currentRoom, currentUser, pendingApproval, error, setError } =
    useRoomStore();

  // State to track playing indicators for each user
  const [playingIndicators, setPlayingIndicators] = useState<
    Map<string, { velocity: number; timestamp: number }>
  >(new Map());

  // State to track instrument fallback notifications
  const [fallbackNotification, setFallbackNotification] = useState<{
    message: string;
    type: "local" | "remote";
    username?: string;
  } | null>(null);

  // Track sustain toggle state for MIDI controller access
  const [sustainToggleState, setSustainToggleState] = useState<boolean>(false);

  // State for leave room confirmation modal
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] =
    useState<boolean>(false);
  const [hasLeftRoom, setHasLeftRoom] = useState<boolean>(false);

  const {
    connect,
    joinRoom,
    disconnect,
    approveMember,
    rejectMember,
    playNote,
    changeInstrument,
    updateSynthParams: socketUpdateSynthParams,
    requestSynthParams,
    sendChatMessage,
    onNoteReceived,
    onUserLeft,
    onInstrumentChanged,
    onSynthParamsChanged,
    onRequestSynthParamsResponse,
    isConnected,
    isConnecting,
    socketRef,
    cleanup: socketCleanup,
  } = useSocket();

  const scaleState = useScaleState();

  const {
    currentInstrument,
    currentCategory,
    availableSamples,
    dynamicDrumMachines,
    isLoadingInstrument,
    isAudioContextReady,
    audioContextError,
    initializeAudioContext,
    playNote: playNotes,
    stopNotes,
    stopSustainedNotes,
    releaseKeyHeldNote,
    setSustainState,
    handleInstrumentChange,
    handleCategoryChange,
    getCurrentInstrumentControlType,
    synthState,
    updateSynthParams,
    loadPresetParams,
    isSynthesizerLoaded,
    lastFallbackInstrument,
    lastFallbackCategory,
    // Remote user methods
    playRemoteUserNote,
    stopRemoteUserNote,
    setRemoteUserSustain,
    updateRemoteUserInstrument,
    updateRemoteUserSynthParams,
    cleanupRemoteUser,
    preloadRoomInstruments,
  } = useInstrument({
    onSynthParamsChange: socketUpdateSynthParams,
  });

  // Initialize room
  useEffect(() => {
    if (!roomId || !username || !userId) {
      navigate("/");
      return;
    }

    // Reset leave room state when component mounts
    setHasLeftRoom(false);

    // Clear any previous error
    setError(null);

    // Connect to socket if not already connected
    if (!isConnected && !isConnecting) {
      connect();
    }
  }, [
    roomId,
    username,
    userId,
    connect,
    isConnected,
    isConnecting,
    setError,
    navigate,
  ]);

  // Join room when socket is connected
  useEffect(() => {
    if (isConnected && roomId && username && userId && !hasLeftRoom) {
      // Join the room (this will establish the session even if we're already in the room)
      joinRoom(roomId, username, userId, role);
    }
  }, [isConnected, roomId, username, userId, role, joinRoom, hasLeftRoom]);

  // Request synth parameters when joining a room with synthesizer users
  useEffect(() => {
    if (
      currentRoom &&
      currentUser &&
      currentCategory === InstrumentCategory.Synthesizer
    ) {
      // Check if there are other users with synthesizers and request their parameters
      const otherSynthUsers = currentRoom.users.filter(
        (user) =>
          user.id !== currentUser.id &&
          user.currentCategory === InstrumentCategory.Synthesizer,
      );

      if (otherSynthUsers.length > 0) {
        // Small delay to ensure we're fully connected
        setTimeout(() => {
          requestSynthParams();
        }, 1000);
      }
    }
  }, [currentRoom, currentUser, currentCategory, requestSynthParams]);

  // Handle socket errors and redirect to lobby when rejected
  useEffect(() => {
    if (error) {
      if (error.includes("Room not found")) {
        // If room not found, redirect back to lobby
        navigate("/");
      } else if (
        error.includes("rejected") ||
        error.includes("Your request was rejected")
      ) {
        // If user was rejected, redirect to lobby immediately with rejection message
        navigate("/", {
          state: {
            rejectionMessage: error,
          },
        });
      }
    }
  }, [error, navigate]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clean up socket optimizations
      socketCleanup();
    };
  }, [socketCleanup]);

  // Cleanup old playing indicators - optimized to prevent unnecessary re-renders
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPlayingIndicators((prev) => {
        let hasChanges = false;
        const newMap = new Map(prev);

        for (const [username, indicator] of newMap.entries()) {
          if (now - indicator.timestamp > 200) {
            // Remove after 200ms
            newMap.delete(username);
            hasChanges = true;
          }
        }

        // Only return new Map if there were actual changes
        return hasChanges ? newMap : prev;
      });
    }, 100); // Check every 100ms

    return () => clearInterval(interval);
  }, []);

  // Handle user leaving - cleanup their instruments
  useEffect(() => {
    const cleanup = onUserLeft((user) => {
      cleanupRemoteUser(user.id);
    });

    return cleanup;
  }, [onUserLeft, cleanupRemoteUser]);

  // Handle instrument fallback notifications
  useEffect(() => {
    if (lastFallbackInstrument && lastFallbackCategory) {
      const message = `Safari compatibility: Switched from ${currentInstrument} to ${lastFallbackInstrument}`;
      setFallbackNotification({
        message,
        type: "local",
      });

      // Clear the notification after 5 seconds
      const timeout = setTimeout(() => {
        setFallbackNotification(null);
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [lastFallbackInstrument, lastFallbackCategory, currentInstrument]);

  // Handle instrument changes - preload new instruments
  useEffect(() => {
    const cleanup = onInstrumentChanged(async (data) => {
      // Skip if this is the current user's own instrument change
      if (currentUser && data.userId === currentUser.id) {
        return;
      }

      try {
        await updateRemoteUserInstrument(
          data.userId,
          data.username,
          data.instrument,
          data.category as InstrumentCategory,
        );
        // If the user changed to a synthesizer, request their current parameters
        if (data.category === InstrumentCategory.Synthesizer) {
          // Small delay to ensure the instrument is fully loaded
          setTimeout(() => {
            requestSynthParams();
          }, 500);
        }
      } catch (error) {
        console.error(
          "❌ Failed to update instrument for user:",
          data.username,
          error,
        );
      }
    });

    return cleanup;
  }, [
    onInstrumentChanged,
    updateRemoteUserInstrument,
    requestSynthParams,
    currentUser,
  ]);

  // Handle synthesizer parameter changes from remote users
  useEffect(() => {
    const cleanup = onSynthParamsChanged(async (data) => {
      // Skip if this is the current user's own synth params change
      if (currentUser && data.userId === currentUser.id) {
        return;
      }

      try {
        await updateRemoteUserSynthParams(
          data.userId,
          data.username,
          data.instrument,
          data.category as InstrumentCategory,
          data.params,
        );
      } catch (error) {
        console.error(
          "❌ Failed to update synth parameters for user:",
          data.username,
          error,
        );
      }
    });

    return cleanup;
  }, [onSynthParamsChanged, updateRemoteUserSynthParams, currentUser]);

  // Sync synth parameters when joining a room with existing synthesizer users
  useEffect(() => {
    if (
      currentRoom &&
      currentUser &&
      currentCategory === InstrumentCategory.Synthesizer &&
      synthState &&
      isSynthesizerLoaded
    ) {
      // Check if there are other users with synthesizers and sync our parameters
      const otherSynthUsers = currentRoom.users.filter(
        (user) =>
          user.id !== currentUser.id &&
          user.currentCategory === InstrumentCategory.Synthesizer,
      );

      if (otherSynthUsers.length > 0) {
        // Sync the complete synth state to ensure all parameters are synchronized
        setTimeout(() => {
          socketUpdateSynthParams(synthState);
        }, 500);
      }
    }
  }, [
    currentRoom,
    currentUser,
    currentCategory,
    socketUpdateSynthParams,
    isSynthesizerLoaded,
  ]);

  // Handle requests for synth parameters from new users
  useEffect(() => {
    const cleanup = onRequestSynthParamsResponse(() => {
      if (currentCategory === InstrumentCategory.Synthesizer && synthState) {
        // Send the complete synth state to ensure all parameters are synchronized
        socketUpdateSynthParams(synthState);
      }
    });

    return cleanup;
  }, [onRequestSynthParamsResponse, currentCategory, socketUpdateSynthParams]);

  // Track preloaded instruments to avoid redundant requests
  const preloadedInstruments = useRef<Set<string>>(new Set());

  // Debounce mechanism to prevent infinite loops
  const lastPreloadTime = useRef<number>(0);
  const PRELOAD_DEBOUNCE_MS = 500; // Reduced to 500ms since we're only checking on instrument changes

  // Memoize room users to prevent effect from running too frequently
  const roomUsers = useMemo(() => {
    if (!currentRoom?.users) return [];

    // Create a stable reference by serializing user data that matters for preloading
    return currentRoom.users.map((user) => ({
      id: user.id,
      username: user.username,
      currentInstrument: user.currentInstrument,
      currentCategory: user.currentCategory,
    }));
  }, [currentRoom?.users]);

  // Create a more stable dependency for preloading - only track instrument changes
  const instrumentChanges = useMemo(() => {
    if (!currentRoom?.users) return "";

    // Create a hash of all user instruments to detect changes
    return currentRoom.users
      .filter((user) => user.currentInstrument && user.currentCategory)
      .map(
        (user) =>
          `${user.id}:${user.currentInstrument}:${user.currentCategory}`,
      )
      .sort()
      .join("|");
  }, [currentRoom?.users]);

  // Preload all room instruments when instrument changes occur
  useEffect(() => {
    const now = Date.now();

    // Only run if we have users and audio context is ready
    if (roomUsers.length === 0 || !isAudioContextReady) {
      return;
    }

    // Check if there are any users with instruments that need preloading
    const usersWithInstruments = roomUsers.filter(
      (user) => user.currentInstrument && user.currentCategory,
    );

    // If no users have instruments set, don't run at all
    if (usersWithInstruments.length === 0) {
      return;
    }

    // Debounce check
    if (now - lastPreloadTime.current <= PRELOAD_DEBOUNCE_MS) {
      return;
    }

    lastPreloadTime.current = now;

    const instrumentsToPreload = usersWithInstruments
      .filter(
        (
          user,
        ): user is typeof user & {
          currentInstrument: string;
          currentCategory: string;
        } => {
          const instrumentKey = `${user.id}-${user.currentInstrument}-${user.currentCategory}`;
          // Only preload if we haven't already preloaded this exact instrument for this user
          if (preloadedInstruments.current.has(instrumentKey)) {
            return false;
          }

          return true;
        },
      )
      .map((user) => {
        // Add to preloaded set here, after filtering
        const instrumentKey = `${user.id}-${user.currentInstrument}-${user.currentCategory}`;
        preloadedInstruments.current.add(instrumentKey);

        return {
          userId: user.id,
          username: user.username,
          instrumentName: user.currentInstrument,
          category: user.currentCategory,
        };
      });

    if (instrumentsToPreload.length > 0) {
      preloadRoomInstruments(instrumentsToPreload);
    }
  }, [instrumentChanges, isAudioContextReady, preloadRoomInstruments]);

  // Handle incoming notes from other users with deduplication
  const recentReceivedNotes = useRef<Map<string, number>>(new Map());
  const NOTE_RECEIVE_DEDUPE_WINDOW = 50; // 50ms window to prevent duplicate processing

  // Handle playing indicators for all users (including self) - optimized
  const handleNotePlayed = useCallback(
    (data: { username: string; velocity: number }) => {
      setPlayingIndicators((prev) => {
        const existing = prev.get(data.username);
        const newIndicator = {
          velocity: data.velocity,
          timestamp: Date.now(),
        };

        // Only update if the data has actually changed
        if (
          !existing ||
          existing.velocity !== newIndicator.velocity ||
          Math.abs(existing.timestamp - newIndicator.timestamp) > 10
        ) {
          const newMap = new Map(prev);
          newMap.set(data.username, newIndicator);
          return newMap;
        }

        return prev;
      });
    },
    [],
  );

  useEffect(() => {
    const cleanup = onNoteReceived(async (data) => {
      // Trigger playing indicator for the user who played the note
      handleNotePlayed({ username: data.username, velocity: data.velocity });

      // For mono synths, be more careful with deduplication to preserve key tracking
      const isMonoSynth =
        data.instrument === "analog_mono" || data.instrument === "fm_mono";

      // Create a unique key for this received note event
      const eventKey = `${data.userId}-${data.eventType}-${data.notes.join(",")}-${data.instrument}-${data.velocity}`;
      const now = Date.now();

      // Only apply deduplication to note_on events for mono synths, or all events for other instruments
      const shouldCheckDuplicate = !isMonoSynth || data.eventType === "note_on";

      if (shouldCheckDuplicate) {
        // Check if we recently processed the same event
        const lastProcessed = recentReceivedNotes.current.get(eventKey);
        if (lastProcessed && now - lastProcessed < NOTE_RECEIVE_DEDUPE_WINDOW) {
          return;
        }
      }

      // Record this event
      recentReceivedNotes.current.set(eventKey, now);

      // Clean up old entries periodically
      if (recentReceivedNotes.current.size > 100) {
        const cutoff = now - NOTE_RECEIVE_DEDUPE_WINDOW * 2;
        for (const [key, timestamp] of recentReceivedNotes.current.entries()) {
          if (timestamp < cutoff) {
            recentReceivedNotes.current.delete(key);
          }
        }
      }

      // Don't automatically switch instruments - each user maintains their own instrument
      // Play the note using the separate multi-user audio system
      switch (data.eventType) {
        case "note_on":
          try {
            await playRemoteUserNote(
              data.userId,
              data.username,
              data.notes,
              data.velocity,
              data.instrument,
              data.category as InstrumentCategory,
              data.isKeyHeld || false,
            );
          } catch (error) {
            console.error(
              "❌ Failed to play notes for user:",
              data.username,
              error,
            );
          }
          break;
        case "note_off":
          try {
            await stopRemoteUserNote(
              data.userId,
              data.notes,
              data.instrument,
              data.category as InstrumentCategory,
            );
          } catch (error) {
            console.error(
              "❌ Failed to stop notes for user:",
              data.username,
              error,
            );
          }
          break;
        case "sustain_on":
          try {
            setRemoteUserSustain(
              data.userId,
              true,
              data.instrument,
              data.category as InstrumentCategory,
            );
          } catch (error) {
            console.error(
              "❌ Failed to set sustain on for user:",
              data.username,
              error,
            );
          }
          break;
        case "sustain_off":
          try {
            setRemoteUserSustain(
              data.userId,
              false,
              data.instrument,
              data.category as InstrumentCategory,
            );
          } catch (error) {
            console.error(
              "❌ Failed to set sustain off for user:",
              data.username,
              error,
            );
          }
          break;
      }
    });

    return cleanup;
  }, [
    onNoteReceived,
    playRemoteUserNote,
    stopRemoteUserNote,
    setRemoteUserSustain,
    handleNotePlayed,
  ]);

  // Handle instrument changes
  useEffect(() => {
    if (currentInstrument && currentCategory) {
      changeInstrument(currentInstrument, currentCategory);
    }
  }, [currentInstrument, currentCategory, changeInstrument]);

  // Initialize audio context on room join
  useEffect(() => {
    if (isConnected && roomId && username && !isAudioContextReady) {
      const initAudio = async () => {
        try {
          await initializeAudioContext();
        } catch (error) {
          console.error("Failed to initialize audio context:", error);
        }
      };
      initAudio();
    }
  }, [
    isConnected,
    roomId,
    username,
    isAudioContextReady,
    initializeAudioContext,
  ]);

  // Handle note playing with socket emission
  const handlePlayNote = useCallback(
    (notes: string[], velocity: number, isKeyHeld: boolean) => {
      // Play locally
      playNotes(notes, velocity, isKeyHeld);

      // Trigger playing indicator for local user
      if (username) {
        handleNotePlayed({ username, velocity });
      }

      // Send to other users (avoid double-triggering for drum machines)
      if (currentInstrument && currentCategory) {
        playNote({
          notes,
          velocity,
          instrument: currentInstrument,
          category: currentCategory,
          eventType: "note_on",
          isKeyHeld,
        });
      }
    },
    [
      playNotes,
      playNote,
      currentInstrument,
      currentCategory,
      username,
      handleNotePlayed,
    ],
  );

  const handleStopNote = useCallback(
    (notes: string[]) => {
      // Stop locally
      stopNotes(notes);

      // Send to other users
      if (currentInstrument && currentCategory) {
        playNote({
          notes,
          velocity: 0,
          instrument: currentInstrument,
          category: currentCategory,
          eventType: "note_off",
        });
      }
    },
    [stopNotes, playNote, currentInstrument, currentCategory],
  );

  const handleReleaseKeyHeldNote = useCallback(
    (note: string) => {
      // Release locally
      releaseKeyHeldNote(note);

      // Send to other users
      if (currentInstrument && currentCategory) {
        playNote({
          notes: [note],
          velocity: 0,
          instrument: currentInstrument,
          category: currentCategory,
          eventType: "note_off",
        });
      }
    },
    [releaseKeyHeldNote, playNote, currentInstrument, currentCategory],
  );

  const handleSustainChange = useCallback(
    (sustain: boolean) => {
      // Update locally
      setSustainState(sustain);

      // Stop sustained notes when sustain is turned off (like keyboard system does)
      if (!sustain) {
        stopSustainedNotes();
      }

      // Send to other users
      if (currentInstrument && currentCategory) {
        playNote({
          notes: [],
          velocity: 0,
          instrument: currentInstrument,
          category: currentCategory,
          eventType: sustain ? "sustain_on" : "sustain_off",
        });
      }
    },
    [
      setSustainState,
      stopSustainedNotes,
      playNote,
      currentInstrument,
      currentCategory,
    ],
  );

  const handleSustainToggleChange = useCallback((sustainToggle: boolean) => {
    // Update the sustain toggle state for MIDI controller access
    setSustainToggleState(sustainToggle);
  }, []);

  // MIDI Controller integration
  const midiController = useMidiController({
    onNoteOn: (note: number, velocity: number) => {
      // Convert MIDI note number to note name
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
      const noteName = noteNames[note % 12];
      const fullNoteName = `${noteName}${octave}`;

      // MIDI notes should be treated as key-held since they have explicit note-off events
      // This prevents the 300ms auto-timeout and allows proper sustain behavior
      handlePlayNote([fullNoteName], velocity, true);
    },
    onNoteOff: (note: number) => {
      // Convert MIDI note number to note name
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
      const noteName = noteNames[note % 12];
      const fullNoteName = `${noteName}${octave}`;

      // Use handleReleaseKeyHeldNote to properly handle sustain and send to other users
      handleReleaseKeyHeldNote(fullNoteName);
    },
    onControlChange: () => {
      // MIDI Control Change
    },
    onPitchBend: () => {
      // MIDI Pitch Bend
    },
    onSustainChange: (sustain: boolean) => {
      // For MIDI sustain, we need to handle the inverse behavior when sustain toggle is active
      // When sustain toggle is ON and MIDI sustain is pressed (true), we should stop sustained notes
      // When sustain toggle is ON and MIDI sustain is released (false), we should resume sustain
      if (sustain) {
        // MIDI sustain pedal pressed down
        if (sustainToggleState) {
          // If toggle mode is active, pressing sustain should stop current sustained notes
          stopSustainedNotes();
          // Also temporarily turn off sustain to communicate with remote users
          // then immediately turn it back on to maintain the toggle state
          handleSustainChange(false);
          // Use setTimeout to ensure the sustain off message is sent before turning it back on
          setTimeout(() => {
            handleSustainChange(true);
          }, 10);
        } else {
          // Normal momentary sustain behavior
          handleSustainChange(true);
        }
      } else {
        // MIDI sustain pedal released
        if (sustainToggleState) {
          // If toggle mode is active, releasing sustain should resume sustain mode
          handleSustainChange(true);
        } else {
          // Normal momentary sustain behavior
          handleSustainChange(false);
        }
      }
    },
  });

  // Handle approve member
  const handleApproveMember = useCallback(
    (userId: string) => {
      approveMember(userId);
    },
    [approveMember],
  );

  // Handle reject member
  const handleRejectMember = useCallback(
    (userId: string) => {
      rejectMember(userId);
    },
    [rejectMember],
  );

  // Leave room (for canceling pending approval)
  const handleLeaveRoom = useCallback(() => {
    // For canceling pending approval, we don't need to send intentional leave flag
    // since the user is not actually in the room yet
    disconnect();
    navigate("/");
  }, [disconnect, navigate]);

  // Get the leave room mutation
  const { roomLeaveMutate } = useRoomQuery();

  // Handle leave room confirmation
  const handleLeaveRoomConfirm = useCallback(async () => {
    setShowLeaveConfirmModal(false);

    if (!roomId || !userId) {
      console.error("Missing roomId or userId for leave room");
      navigate("/");
      return;
    }

    try {
      // Set flag to prevent rejoining the room
      setHasLeftRoom(true);

      // Use HTTP-based leave room
      const result = await roomLeaveMutate.mutateAsync({ roomId, userId });

      if (result.success) {
        // Disconnect socket to prevent automatic reconnection
        disconnect();

        // Immediately redirect to lobby
        navigate("/");
      } else {
        console.error("Failed to leave room:", result.message);
        // Still navigate to lobby even if HTTP request failed
        disconnect();
        navigate("/");
      }
    } catch (error) {
      console.error("Error during leave room process:", error);
      // Ensure we still navigate even if there's an error
      disconnect();
      navigate("/");
    }
  }, [roomLeaveMutate, roomId, userId, disconnect, navigate]);

  // Handle leave room button click - shows confirmation modal
  const handleLeaveRoomClick = useCallback(() => {
    setShowLeaveConfirmModal(true);
  }, []);

  // Clear fallback notification
  const clearFallbackNotification = useCallback(() => {
    setFallbackNotification(null);
  }, []);

  // Wrapper for sendChatMessage that includes roomId
  const handleSendChatMessage = useCallback(
    (message: string) => {
      if (roomId) {
        sendChatMessage(message, roomId);
      }
    },
    [sendChatMessage, roomId],
  );

  return {
    // Room state
    roomId,
    currentRoom,
    currentUser,
    pendingApproval,
    error,
    role,
    username,

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
    sendChatMessage: handleSendChatMessage,

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
  };
};
