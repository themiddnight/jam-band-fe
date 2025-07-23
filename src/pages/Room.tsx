import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import { useRoomStore } from "../stores/roomStore";
import { useSocket } from "../hooks/useSocket";
import { useInstrument } from "../hooks/useInstrument";
import { useScaleState } from "../hooks/useScaleState";
import { useInstrumentManager } from "../hooks/useInstrumentManager";
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
import { preloadCriticalComponents } from "../utils/componentPreloader";
import { getSafariUserMessage } from "../utils/webkitCompat";

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.state?.role as "band_member" | "audience";

  const { username } = useUserStore();
  const { currentRoom, currentUser, pendingApproval, error, setError } =
    useRoomStore();
  const {
    connect,
    joinRoom,
    leaveRoom,
    approveMember,
    rejectMember,
    transferOwnershipTo,
    playNote,
    changeInstrument,
    updateMixer,
    onNoteReceived,
    onUserLeft,
    onInstrumentChanged,
    isConnected,
    isConnecting,
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
    playNotes,
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
  } = useInstrument();

  // Multi-user audio for playing other users' instruments
  const instrumentManager = useInstrumentManager();

  const [mixerMode, setMixerMode] = useState<"original" | "custom">("original");
  const [localMixerSettings, setLocalMixerSettings] = useState<
    Record<string, number>
  >({});

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

  // Handle socket errors
  useEffect(() => {
    if (error && error.includes("Room not found")) {
      // If room not found, redirect back to lobby
      navigate("/");
    }
  }, [error, navigate]);

  // Initialize instrument manager when audio context is ready
  useEffect(() => {
    if (isAudioContextReady) {
      instrumentManager.initialize();
    }
  }, [isAudioContextReady, instrumentManager]);

  // Clean up multi-user audio when component unmounts
  useEffect(() => {
    return () => {
      instrumentManager.cleanupAllInstruments();
    };
  }, [instrumentManager]);

  // Handle user leaving - cleanup their instruments
  useEffect(() => {
    const cleanup = onUserLeft((user) => {
      console.log("Cleaning up instruments for user:", user.username);
      instrumentManager.cleanupUserInstruments(user.id);
    });

    return cleanup;
  }, [onUserLeft, instrumentManager]);

  // Handle instrument changes - preload new instruments
  useEffect(() => {
    const cleanup = onInstrumentChanged(async (data) => {
      console.log("🎵 User changed instrument:", data);
      try {
        await instrumentManager.updateUserInstrument(
          data.userId,
          data.username,
          data.instrument,
          data.category as InstrumentCategory
        );
        console.log(
          "✅ Successfully updated instrument for user:",
          data.username
        );
      } catch (error) {
        console.error(
          "❌ Failed to update instrument for user:",
          data.username,
          error
        );
      }
    });

    return cleanup;
  }, [onInstrumentChanged, instrumentManager]);

  // Preload all room instruments when room data changes
  useEffect(() => {
    if (currentRoom && currentRoom.users && instrumentManager.isReady()) {
      console.log("Preloading instruments for room users");
      instrumentManager.preloadRoomInstruments(currentRoom.users);
    }
  }, [currentRoom, instrumentManager]);

  // Handle incoming notes from other users
  useEffect(() => {
    const cleanup = onNoteReceived(async (data) => {
      // Don't automatically switch instruments - each user maintains their own instrument
      console.log("🎵 Received note from another user:", data);

      // Play the note using the separate multi-user audio system
      switch (data.eventType) {
        case "note_on":
          console.log(
            `🎹 Playing notes for ${data.username}:`,
            data.notes,
            `isKeyHeld: ${data.isKeyHeld}`
          );
          try {
            await instrumentManager.playUserNotes(
              data.userId,
              data.username,
              data.notes,
              data.velocity,
              data.instrument,
              data.category as InstrumentCategory,
              data.isKeyHeld || false
            );
            console.log(
              "✅ Successfully played notes for user:",
              data.username
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
          console.log(`🛑 Stopping notes for ${data.username}:`, data.notes);
          try {
            await instrumentManager.stopUserNotes(
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
          console.log(`🎛️ User ${data.username} sustain ON`);
          try {
            instrumentManager.setUserSustain(
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
          console.log(`🎛️ User ${data.username} sustain OFF`);
          try {
            instrumentManager.setUserSustain(
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
  }, [onNoteReceived, instrumentManager]);

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

      // Send to other users
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
    [playNotes, playNote, currentInstrument, currentCategory]
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
    onControlChange: (controller: number) => {
      console.log("MIDI Control Change:", controller);
    },
    onPitchBend: (value: number, channel: number) => {
      console.log("MIDI Pitch Bend:", value, "Channel:", channel);
    },
    onSustainChange: (sustain: boolean) => {
      // Use the same handleSustainChange function as keyboard/button inputs
      // This ensures MIDI sustain works with all input methods
      handleSustainChange(sustain);
    },
  });

  // Handle mixer mode change
  const handleMixerModeChange = (mode: "original" | "custom") => {
    setMixerMode(mode);
    updateMixer(mode, mode === "custom" ? localMixerSettings : undefined);
  };

  // Handle mixer settings change
  const handleMixerSettingsChange = (userId: string, gain: number) => {
    if (mixerMode === "custom") {
      const newSettings = { ...localMixerSettings, [userId]: gain };
      setLocalMixerSettings(newSettings);
      updateMixer("custom", newSettings);
    } else {
      // Original mode - only room owner can change
      if (currentUser?.role === "room_owner") {
        const newSettings = { ...currentRoom?.mixerSettings, [userId]: gain };
        updateMixer("original", newSettings);
      }
    }
  };

  // Handle approve member
  const handleApproveMember = useCallback(
    (userId: string) => {
      console.log("Approving member:", userId);
      approveMember(userId);
    },
    [approveMember]
  );

  // Handle reject member
  const handleRejectMember = useCallback(
    (userId: string) => {
      console.log("Rejecting member:", userId);
      rejectMember(userId);
    },
    [rejectMember]
  );

  // Leave room
  const handleLeaveRoom = () => {
    leaveRoom();
    navigate("/");
  };

  // Render pending approval modal
  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-xl">
              Waiting for Approval
            </h2>
            <p className="text-base-content/70 mb-4">
              Your request to join as a band member is pending approval from the
              room owner.
            </p>
            <div className="loading loading-spinner loading-lg text-primary"></div>
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
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
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
            <div className="loading loading-spinner loading-lg text-primary"></div>
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
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
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
    <div className="min-h-screen bg-base-200 p-3">
      <div className="flex flex-col items-center">
        {/* Room Header */}
        <div className="w-full max-w-6xl mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{currentRoom?.name}</h1>
              <p className="text-base-content/70">
                {currentUser?.role === "room_owner"
                  ? "Room Owner"
                  : currentUser?.role === "band_member"
                  ? "Band Member"
                  : "Audience"}
              </p>
            </div>
            <div className="flex items-center gap-4">
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
                <span className="text-sm">
                  {isConnected
                    ? "Connected"
                    : isConnecting
                    ? "Connecting..."
                    : "Disconnected"}
                </span>
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
        <div className="w-full max-w-6xl mb-4">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Room Members</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentRoom?.users.map((user) => (
                  <div key={user.id} className="card bg-base-200">
                    <div className="card-body p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{user.username}</h4>
                          <p className="text-sm text-base-content/70">
                            {user.role === "room_owner"
                              ? "Owner"
                              : user.role === "band_member"
                              ? "Band Member"
                              : "Audience"}
                          </p>
                          {user.currentInstrument && (
                            <p className="text-xs text-base-content/50">
                              {user.currentInstrument}
                            </p>
                          )}
                        </div>
                        {currentUser?.role === "room_owner" &&
                          user.role === "band_member" && (
                            <button
                              onClick={() => transferOwnershipTo(user.id)}
                              className="btn btn-xs btn-outline"
                            >
                              Make Owner
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pending Members */}
              {currentRoom?.pendingMembers &&
                currentRoom.pendingMembers.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Pending Requests</h4>
                    <div className="space-y-2">
                      {currentRoom.pendingMembers.map((user) => (
                        <div
                          key={user.id}
                          className="flex justify-between items-center p-3 bg-base-200 rounded"
                        >
                          <span>{user.username}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveMember(user.id)}
                              className="btn btn-xs btn-success"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectMember(user.id)}
                              className="btn btn-xs btn-error"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Mixer Controls */}
        <div className="w-full max-w-6xl mb-4">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center mb-4">
                <h3 className="card-title">Sound Mixer</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMixerModeChange("original")}
                    className={`btn btn-sm ${
                      mixerMode === "original" ? "btn-primary" : "btn-outline"
                    }`}
                    disabled={currentUser?.role !== "room_owner"}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => handleMixerModeChange("custom")}
                    className={`btn btn-sm ${
                      mixerMode === "custom" ? "btn-primary" : "btn-outline"
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentRoom?.users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <span className="text-sm min-w-0 flex-1 truncate">
                      {user.username}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={
                        mixerMode === "custom"
                          ? localMixerSettings[user.id] || 1
                          : currentRoom?.mixerSettings[user.id] || 1
                      }
                      onChange={(e) =>
                        handleMixerSettingsChange(
                          user.id,
                          parseFloat(e.target.value)
                        )
                      }
                      disabled={
                        mixerMode === "original" &&
                        currentUser?.role !== "room_owner"
                      }
                      className="range range-xs range-primary"
                    />
                    <span className="text-xs w-8 text-right">
                      {Math.round(
                        (mixerMode === "custom"
                          ? localMixerSettings[user.id] || 1
                          : currentRoom?.mixerSettings[user.id] || 1) * 100
                      )}
                      %
                    </span>
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
    };

    // Show loading indicator while audio context is initializing
    if (!isAudioContextReady) {
      return (
        <div className="card bg-base-100 shadow-xl w-full max-w-6xl">
          <div className="card-body text-center">
            <h3 className="card-title justify-center text-xl">
              Initializing Audio...
            </h3>
            <div className="loading loading-spinner loading-lg text-primary"></div>
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
            <div className="loading loading-spinner loading-lg text-primary"></div>
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
