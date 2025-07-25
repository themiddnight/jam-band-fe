import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import { useRoomStore } from "../stores/roomStore";
import { useSocket } from "../hooks/useSocket";
import { useUnifiedInstrument } from "../hooks/useUnifiedInstrument";
import { useScaleState } from "../hooks/useScaleState";
import { useMidiController } from "../hooks/useMidiController";
import { InstrumentCategory } from "../constants/instruments";
import { ControlType } from "../types";
import {
  LazyKeyboardWrapper as Keyboard,
  LazyGuitarWrapper as Guitar,
  LazyBassWrapper as Bass,
  LazyDrumpadWrapper as Drumpad,
  LazyDrumsetWrapper as Drumset,
  LazySynthControlsWrapper as SynthControls,
} from "../components/LazyComponents";
import ScaleSelector from "../components/ScaleSelector";
import InstrumentCategorySelector from "../components/InstrumentCategorySelector";
import MidiStatus from "../components/MidiStatus";
import PlayingIndicator from "../components/PlayingIndicator";
import { preloadCriticalComponents } from "../utils/componentPreloader";
import { getSafariUserMessage } from "../utils/webkitCompat";

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.state?.role as "band_member" | "audience";

  const { username } = useUserStore();
  const { currentRoom, currentUser, pendingApproval, error, rejectionMessage, setError } =
    useRoomStore();

  // State to track playing indicators for each user
  const [playingIndicators, setPlayingIndicators] = useState<Map<string, { velocity: number; timestamp: number }>>(new Map());

  // State to track instrument fallback notifications
  const [fallbackNotification, setFallbackNotification] = useState<{
    message: string;
    type: 'local' | 'remote';
    username?: string;
  } | null>(null);

  const {
    connect,
    joinRoom,
    disconnect,
    approveMember,
    rejectMember,
    // transferOwnershipTo,
    playNote,
    changeInstrument,
    updateSynthParams: socketUpdateSynthParams,
    requestSynthParams,
    onNoteReceived,
    onUserLeft,
    onInstrumentChanged,
    onSynthParamsChanged,
    onRequestSynthParamsResponse,
    isConnected,
    isConnecting,
    cleanup: socketCleanup,
  } = useSocket();

  const scaleState = useScaleState();

  // Track sustain toggle state for MIDI controller access
  const [sustainToggleState, setSustainToggleState] = useState<boolean>(false);

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
  } = useUnifiedInstrument({
    onSynthParamsChange: socketUpdateSynthParams,
  });



  // Initialize room
  useEffect(() => {
    if (!roomId || !username) {
      navigate("/");
      return;
    }

    // Clear any previous error
    setError(null);

    // Connect to socket if not already connected
    if (!isConnected && !isConnecting) {
      connect();
    }
  }, [
    roomId,
    username,
    connect,
    isConnected,
    isConnecting,
    setError,
    navigate,
  ]);

  // Join room when socket is connected
  useEffect(() => {
    if (isConnected && roomId && username) {
      // Join the room (this will establish the session even if we're already in the room)
      joinRoom(roomId, username, role);
    }
  }, [isConnected, roomId, username, role, joinRoom]);

  // Request synth parameters when joining a room with synthesizer users
  useEffect(() => {
    if (currentRoom && currentUser && currentCategory === InstrumentCategory.Synthesizer) {
      // Check if there are other users with synthesizers and request their parameters
      const otherSynthUsers = currentRoom.users.filter(user =>
        user.id !== currentUser.id &&
        user.currentCategory === InstrumentCategory.Synthesizer
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
      } else if (error.includes("rejected") || error.includes("Your request was rejected")) {
        // If user was rejected, redirect to lobby immediately
        navigate("/");
      }
    }
  }, [error, navigate]);

  // Handle rejection message and redirect to lobby
  useEffect(() => {
    if (rejectionMessage) {
      // Redirect to lobby with rejection message
      navigate("/", { state: { rejectionMessage } });
    }
  }, [rejectionMessage, navigate]);



  // Initialize audio context when needed
  // (This is now handled automatically by the unified instrument hook)

  // Clean up is handled automatically by the unified instrument hook

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clean up socket optimizations
      socketCleanup();
    };
  }, [socketCleanup]);

  // Cleanup old playing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPlayingIndicators(prev => {
        const newMap = new Map(prev);
        for (const [username, indicator] of newMap.entries()) {
          if (now - indicator.timestamp > 200) { // Remove after 200ms
            newMap.delete(username);
          }
        }
        return newMap;
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
        type: 'local'
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
        console.log(`⏭️ Skipping own instrument change for user ${data.username}`);
        return;
      }

      try {
        await updateRemoteUserInstrument(
          data.userId,
          data.username,
          data.instrument,
          data.category as InstrumentCategory
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
          error
        );
      }
    });

    return cleanup;
  }, [onInstrumentChanged, updateRemoteUserInstrument, requestSynthParams, currentUser]);

  // Handle synthesizer parameter changes from remote users
  useEffect(() => {
    const cleanup = onSynthParamsChanged(async (data) => {
      // Skip if this is the current user's own synth params change
      if (currentUser && data.userId === currentUser.id) {
        console.log(`⏭️ Skipping own synth params change for user ${data.username}`);
        return;
      }

      try {
        await updateRemoteUserSynthParams(
          data.userId,
          data.username,
          data.instrument,
          data.category as InstrumentCategory,
          data.params
        );
      } catch (error) {
        console.error(
          "❌ Failed to update synth parameters for user:",
          data.username,
          error
        );
      }
    });

    return cleanup;
  }, [onSynthParamsChanged, updateRemoteUserSynthParams, currentUser]);

  // Sync synth parameters when joining a room with existing synthesizer users
  useEffect(() => {
    if (currentRoom && currentUser && currentCategory === InstrumentCategory.Synthesizer && synthState && isSynthesizerLoaded) {
      // Check if there are other users with synthesizers and sync our parameters
      const otherSynthUsers = currentRoom.users.filter(user =>
        user.id !== currentUser.id &&
        user.currentCategory === InstrumentCategory.Synthesizer
      );

      if (otherSynthUsers.length > 0) {
        // Sync the complete synth state to ensure all parameters are synchronized
        setTimeout(() => {
          socketUpdateSynthParams(synthState);
        }, 500);
      }
    }
  }, [currentRoom, currentUser, currentCategory, synthState, socketUpdateSynthParams, isSynthesizerLoaded]);

  // Handle requests for synth parameters from new users
  useEffect(() => {
    const cleanup = onRequestSynthParamsResponse(() => {
      if (currentCategory === InstrumentCategory.Synthesizer && synthState) {
        // Send the complete synth state to ensure all parameters are synchronized
        socketUpdateSynthParams(synthState);
      }
    });

    return cleanup;
  }, [onRequestSynthParamsResponse, currentCategory, synthState, socketUpdateSynthParams]);

  // Track preloaded instruments to avoid redundant requests
  const preloadedInstruments = useRef<Set<string>>(new Set());

  // Debounce mechanism to prevent infinite loops
  const lastPreloadTime = useRef<number>(0);
  const PRELOAD_DEBOUNCE_MS = 1000; // Minimum 1 second between preload attempts

  // Memoize room users to prevent effect from running too frequently
  const roomUsers = useMemo(() => {
    return currentRoom?.users || [];
  }, [currentRoom?.users]);

  // Preload all room instruments when room data changes
  useEffect(() => {
    const now = Date.now();

    // Only run if we have users and audio context is ready
    if (roomUsers.length === 0 || !isAudioContextReady) {
      return;
    }

    // Check if there are any users with instruments that need preloading
    const usersWithInstruments = roomUsers.filter(user =>
      user.currentInstrument && user.currentCategory
    );

    // If no users have instruments set, don't run at all
    if (usersWithInstruments.length === 0) {
      console.log(`📭 No users with instruments to preload`);
      return;
    }

    // Debounce check
    if ((now - lastPreloadTime.current) <= PRELOAD_DEBOUNCE_MS) {
      console.log(`⏸️ Skipping preload check - debounced (last run ${now - lastPreloadTime.current}ms ago)`);
      return;
    }

    console.log(`🔍 [${now}] Checking ${roomUsers.length} users for instrument preloading`);
    lastPreloadTime.current = now;

    const instrumentsToPreload = usersWithInstruments
      .filter((user): user is typeof user & { currentInstrument: string; currentCategory: string } => {
        const instrumentKey = `${user.id}-${user.currentInstrument}-${user.currentCategory}`;
        // Only preload if we haven't already preloaded this exact instrument for this user
        if (preloadedInstruments.current.has(instrumentKey)) {
          console.log(`⏭️ Skipping user ${user.username} - ${user.currentInstrument} already preloaded`);
          return false;
        }

        console.log(`✅ Will preload ${user.currentInstrument} (${user.currentCategory}) for user ${user.username}`);
        return true;
      })
      .map(user => {
        // Add to preloaded set here, after filtering
        const instrumentKey = `${user.id}-${user.currentInstrument}-${user.currentCategory}`;
        preloadedInstruments.current.add(instrumentKey);

        return {
          userId: user.id,
          username: user.username,
          instrumentName: user.currentInstrument,
          category: user.currentCategory
        };
      });

    if (instrumentsToPreload.length > 0) {
      console.log(`🎵 Preloading ${instrumentsToPreload.length} new instruments for room users:`, instrumentsToPreload);
      preloadRoomInstruments(instrumentsToPreload);
    } else {
      console.log(`📭 No new instruments to preload`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUsers, isAudioContextReady]); // Removed preloadRoomInstruments from deps

  // Handle incoming notes from other users with deduplication
  const recentReceivedNotes = useRef<Map<string, number>>(new Map());
  const NOTE_RECEIVE_DEDUPE_WINDOW = 50; // 50ms window to prevent duplicate processing

  // Handle playing indicators for all users (including self)
  const handleNotePlayed = useCallback((data: { username: string; velocity: number }) => {
    setPlayingIndicators(prev => {
      const newMap = new Map(prev);
      newMap.set(data.username, {
        velocity: data.velocity,
        timestamp: Date.now()
      });
      return newMap;
    });
  }, []);

  useEffect(() => {
    const cleanup = onNoteReceived(async (data) => {
      // Trigger playing indicator for the user who played the note
      handleNotePlayed({ username: data.username, velocity: data.velocity });

      // For mono synths, be more careful with deduplication to preserve key tracking
      const isMonoSynth = data.instrument === "analog_mono" || data.instrument === "fm_mono";

      // Create a unique key for this received note event
      const eventKey = `${data.userId}-${data.eventType}-${data.notes.join(',')}-${data.instrument}-${data.velocity}`;
      const now = Date.now();

      // Only apply deduplication to note_on events for mono synths, or all events for other instruments
      const shouldCheckDuplicate = !isMonoSynth || data.eventType === "note_on";

      if (shouldCheckDuplicate) {
        // Check if we recently processed the same event
        const lastProcessed = recentReceivedNotes.current.get(eventKey);
        if (lastProcessed && (now - lastProcessed) < NOTE_RECEIVE_DEDUPE_WINDOW) {
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
              data.isKeyHeld || false
            );
          } catch (error) {
            console.error(
              "❌ Failed to play notes for user:",
              data.username,
              error
            );
          }
          break;
        case "note_off":
          try {
            await stopRemoteUserNote(
              data.userId,
              data.notes,
              data.instrument,
              data.category as InstrumentCategory
            );
          } catch (error) {
            console.error(
              "❌ Failed to stop notes for user:",
              data.username,
              error
            );
          }
          break;
        case "sustain_on":
          try {
            setRemoteUserSustain(
              data.userId,
              true,
              data.instrument,
              data.category as InstrumentCategory
            );
          } catch (error) {
            console.error(
              "❌ Failed to set sustain on for user:",
              data.username,
              error
            );
          }
          break;
        case "sustain_off":
          try {
            setRemoteUserSustain(
              data.userId,
              false,
              data.instrument,
              data.category as InstrumentCategory
            );
          } catch (error) {
            console.error(
              "❌ Failed to set sustain off for user:",
              data.username,
              error
            );
          }
          break;
      }
    });

    return cleanup;
  }, [onNoteReceived, playRemoteUserNote, stopRemoteUserNote, setRemoteUserSustain, handleNotePlayed]);

  // Handle instrument changes
  useEffect(() => {
    if (currentInstrument && currentCategory) {
      console.log(`🎵 Sending instrument change to backend: ${currentInstrument} (${currentCategory})`);
      changeInstrument(currentInstrument, currentCategory);
    }
  }, [currentInstrument, currentCategory, changeInstrument]);

  // Initialize audio context on room join
  useEffect(() => {
    if (isConnected && roomId && username && !isAudioContextReady) {
      const initAudio = async () => {
        try {
          await initializeAudioContext();
          preloadCriticalComponents();
        } catch (error) {
          console.error("Failed to initialize audio context:", error);
        }
      };
      initAudio();
    }
  }, [isConnected, roomId, username, isAudioContextReady, initializeAudioContext]);

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
    [playNotes, playNote, currentInstrument, currentCategory, username, handleNotePlayed]
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
    [stopNotes, playNote, currentInstrument, currentCategory]
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
    [releaseKeyHeldNote, playNote, currentInstrument, currentCategory]
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
    ]
  );

  const handleSustainToggleChange = useCallback(
    (sustainToggle: boolean) => {
      // Update the sustain toggle state for MIDI controller access
      setSustainToggleState(sustainToggle);
    },
    []
  );

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
    [approveMember]
  );

  // Handle reject member
  const handleRejectMember = useCallback(
    (userId: string) => {
      rejectMember(userId);
    },
    [rejectMember]
  );

  // Leave room
  const handleLeaveRoom = () => {
    // Disconnect socket to prevent automatic reconnection
    disconnect();
    navigate("/");
  };

  // Render pending approval modal
  if (pendingApproval || (currentRoom && currentUser && currentRoom.pendingMembers.some(member => member.id === currentUser.id))) {
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
                Cancel
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
    <div className="min-h-dvh bg-base-200 p-3">
      <div className="flex flex-col items-center">
        {/* Fallback Notification */}
        {fallbackNotification && (
          <div className="alert alert-info mb-4 w-full max-w-6xl">
            <div>
              <h4 className="font-bold">Safari Compatibility</h4>
              <p className="text-sm">{fallbackNotification.message}</p>
            </div>
            <button
              onClick={() => setFallbackNotification(null)}
              className="btn btn-sm btn-ghost"
            >
              ×
            </button>
          </div>
        )}

        {/* Room Header */}
        <div className="w-full max-w-6xl mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{currentRoom?.name}</h1>
              <div>
                <span className="mr-2">
                  {currentUser?.username}
                </span>
                <span className="text-sm text-base-content/70">
                  {currentUser?.role === "room_owner"
                    ? "Room Owner"
                    : currentUser?.role === "band_member"
                      ? "Band Member"
                      : "Audience"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${isConnected
                      ? "bg-success"
                      : isConnecting
                        ? "bg-warning"
                        : "bg-error"
                    }`}
                ></div>
                {/* <span className="text-sm">
                  {isConnected
                    ? "Connected"
                    : isConnecting
                      ? "Connecting..."
                      : "Disconnected"}
                </span> */}
              </div>
              <button
                onClick={handleLeaveRoom}
                className="btn btn-outline btn-sm"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>

        {/* Room Members */}
        <div className="w-full max-w-6xl mb-3">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-2">
              {/* <div className="flex items-center justify-between">
                <h4 className="card-title">Room Members ({currentRoom?.users.length || 0})</h4>
                {currentRoom?.pendingMembers && currentRoom.pendingMembers.length > 0 && (
                  <div className="badge badge-warning badge-sm">
                    {currentRoom.pendingMembers.length} pending
                  </div>
                )}
              </div> */}

              {/* Active Members - Compact List */}
              <div className="flex flex-wrap gap-2">
                {currentRoom?.users
                  .slice() // make a shallow copy to avoid mutating original
                  .sort((a, b) => {
                    const roleOrder = {
                      room_owner: 0,
                      band_member: 1,
                      audience: 2,
                    };
                    return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
                  })
                  .map((user) => {
                    const playingIndicator = playingIndicators.get(user.username);

                    return (
                      <div key={user.id} className="flex items-center gap-2 p-2 bg-base-200 rounded-lg min-w-fit">
                        {user.role !== 'audience' && <PlayingIndicator velocity={playingIndicator?.velocity || 0} />}
                        <span className="font-medium text-sm whitespace-nowrap">{user.username}</span>
                        {user.role !== 'audience' && user.currentInstrument ? (
                          <span className="text-xs text-base-content/60 bg-base-300 px-2 py-1 rounded whitespace-nowrap">
                            {user.currentInstrument.replace(/_/g, " ")}
                          </span>
                        ) : null}
                        <span className="text-xs whitespace-nowrap">
                          {user.role === "room_owner" ? "👑" :
                            user.role === "band_member" ? "🎹" : "🦻🏼"}
                        </span>
                        {/* {currentUser?.role === "room_owner" && user.role === "band_member" && (
                          <button
                            onClick={() => transferOwnershipTo(user.id)}
                            className="btn btn-xs btn-outline btn-ghost"
                            title="Transfer ownership"
                          >
                            👑
                          </button>
                        )} */}
                      </div>
                    );
                  })}

                {/* Pending Members - Compact */}
                {currentRoom?.pendingMembers && currentRoom.pendingMembers.map((user) => (
                  <div
                    key={user.id}
                    className="flex justify-between items-center gap-2 p-2 bg-warning/30 rounded-lg"
                  >
                    <span className="text-sm">{user.username}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleApproveMember(user.id)}
                        className="btn btn-xs btn-success"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleRejectMember(user.id)}
                        className="btn btn-xs btn-error"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>



        {/* Instrument Controls */}
        {(currentUser?.role === "room_owner" ||
          currentUser?.role === "band_member") && (
            <>
              <div className="flex gap-2 flex-wrap w-full max-w-6xl mb-3">
                <MidiStatus
                  isConnected={midiController.isConnected}
                  getMidiInputs={midiController.getMidiInputs}
                  onRequestAccess={midiController.requestMidiAccess}
                  connectionError={midiController.connectionError}
                  isRequesting={midiController.isRequesting}
                  refreshMidiDevices={midiController.refreshMidiDevices}
                />
                <ScaleSelector
                  rootNote={scaleState.rootNote}
                  scale={scaleState.scale}
                  onRootNoteChange={scaleState.setRootNote}
                  onScaleChange={scaleState.setScale}
                />
                <InstrumentCategorySelector
                  currentCategory={currentCategory}
                  currentInstrument={currentInstrument}
                  onCategoryChange={handleCategoryChange}
                  onInstrumentChange={handleInstrumentChange}
                  isLoading={isLoadingInstrument}
                  dynamicDrumMachines={dynamicDrumMachines}
                />
              </div>

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

        {/* Audience View */}
        {currentUser?.role === "audience" && (
          <div className="w-full max-w-6xl">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body text-center">
                <h3 className="card-title justify-center">Audience Mode</h3>
                <p className="text-base-content/70">
                  You are listening to the jam session. Band members can play
                  instruments while you enjoy the music.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function renderInstrumentControl() {
    const controlType = getCurrentInstrumentControlType();
    const commonProps = {
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
    };

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
          />
        );
      case ControlType.Drumset:
        return <Drumset {...commonProps} availableSamples={availableSamples} />;
      case ControlType.Keyboard:
      default:
        return <Keyboard {...commonProps} />;
    }
  }
}
