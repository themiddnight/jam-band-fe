import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useResizable } from "@/shared/hooks/useResizable";
import { useUserStore } from "@/shared/stores/userStore";
import { Footer, AnchoredPopup } from "@/features/ui";
import { useDeepLinkHandler } from "@/shared/hooks/useDeepLinkHandler";
import { getRoomContext } from "@/shared/analytics/context";
import { trackInviteSent } from "@/shared/analytics/events";
import { useNetworkAnalytics } from "@/shared/analytics/useNetworkAnalytics";
import MultitrackView from "@/features/daw/components/multitrack";
import RegionEditor from "@/features/daw/components/regioneditor";
import Sidebar from "@/features/daw/components/sidebar";
import VirtualInstrumentPanel from "@/features/daw/components/VirtualInstrumentPanel";
import { SynthControlsPanel } from "@/features/daw/components/SynthControlsPanel";
import { TransportToolbar } from "@/features/daw/components/transport";
import { usePlaybackEngine } from "@/features/daw/hooks/playback/usePlaybackEngine";
import { useRecordingEngine } from "@/features/daw/hooks/playback/useRecordingEngine";
import { useAudioRecordingEngine } from "@/features/daw/hooks/playback/useAudioRecordingEngine";
import { useMidiMonitoring } from "@/features/daw/hooks/playback/useMidiMonitoring";
import { useMidiInput } from "@/features/daw/hooks/useMidiInput";
import type { MidiMessage } from "@/features/daw/hooks/useMidiInput";
import { useKeyboardShortcuts } from "@/features/daw/hooks/useKeyboardShortcuts";
import { useTrackAudioParams } from "@/features/daw/hooks/useTrackAudioParams";
import { useEffectsIntegration } from "@/features/effects/hooks/useEffectsIntegration";
import { initializeStoreObservers } from "@/features/daw/stores/storeObservers";
import { useMidiStore } from "@/features/daw/stores/midiStore";
import { useArrangeRoomScaleStore } from "@/features/daw/stores/arrangeRoomStore";
import { usePerformanceStore } from "@/features/daw/stores/performanceStore";
import { ProjectMenu } from "@/features/daw/components/ProjectMenu";
import { PerformanceSettingsModal } from "@/features/daw/components/PerformanceSettingsModal";
import { useRoom } from "@/features/rooms";
import { useWebRTCVoice, useCombinedLatency } from "@/features/audio";
import { ToastNotification } from "@/shared/components/ToastNotification";
import { useToastNotification } from "@/shared/hooks/useToastNotification";
import { DAWCollaborationProvider } from "@/features/daw/contexts/DAWCollaborationContext";
import { RoomSocketProvider } from "@/features/rooms/contexts/RoomSocketProvider";
import { KickUserModal, RoomSettingsModal } from "@/features/rooms";
import type { Socket } from "socket.io-client";
import { useDAWCollaboration } from "@/features/daw/hooks/useDAWCollaboration";
import { useAudioRegionLoader } from "@/features/daw/hooks/playback/useAudioRegionLoader";
import { useBroadcast } from "@/features/daw/hooks/useBroadcast";
import { useBroadcastPlayback } from "@/features/daw/hooks/useBroadcastPlayback";
import { useArrangeUserStateStore } from "@/features/daw/stores/userStateStore";
import { getRoomProject } from "@/features/daw/services/projectUploader";
import { deserializeProject } from "@/features/daw/services/projectSerializer";
import { useProjectStore } from "@/features/daw/stores/projectStore";
import { useRegionStore } from "@/features/daw/stores/regionStore";
import { useTrackStore } from "@/features/daw/stores/trackStore";
import { useSynthStore } from "@/features/daw/stores/synthStore";
import { useEffectsStore } from "@/features/effects/stores/effectsStore";

/**
 * Arrange Room page for multi-track production with async editing
 * Currently a placeholder - will be implemented with DAW features
 */
export default function ArrangeRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { username, userId } = useUserStore();
  const { generateInviteUrl } = useDeepLinkHandler();
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [showKickModal, setShowKickModal] = useState(false);
  const [userToKick, setUserToKick] = useState<any | null>(null);
  const [showRoomSettingsModal, setShowRoomSettingsModal] = useState(false);
  const [isUpdatingRoomSettings, setIsUpdatingRoomSettings] = useState(false);
  const [showPerformanceSettingsModal, setShowPerformanceSettingsModal] = useState(false);
  const [isPendingPopupOpen, setIsPendingPopupOpen] = useState(false);
  const pendingBtnRef = useRef<HTMLButtonElement>(null);
  const recordingHandlerRef = useRef<(message: MidiMessage) => void>(() => { });
  const [recordingHandlerBase, setRecordingHandlerBase] = useState<
    (message: MidiMessage) => void
  >(() => () => { });

  // Keep ref in sync with state
  useEffect(() => {
    recordingHandlerRef.current = recordingHandlerBase;
  }, [recordingHandlerBase]);

  // Room management
  const {
    currentRoom,
    currentUser,
    isConnected,
    isConnecting,
    showLeaveConfirmModal,
    setShowLeaveConfirmModal,
    handleLeaveRoomClick,
    handleLeaveRoomConfirm,
    handleApproveMember,
    handleRejectMember,
    kickUser,
    handleUpdateRoomSettings,
    getActiveSocket,
  } = useRoom();

  // Get active socket for collaboration
  const activeSocket = getActiveSocket();
  const roomAnalyticsContext = useMemo(() => getRoomContext(currentRoom), [currentRoom]);
  const socketRef = useRef<Socket | null>(null);
  socketRef.current = activeSocket;

  // WebRTC Voice Communication
  const isVoiceEnabled = !!currentUser?.role;
  const isRoomOwner = currentUser?.role === "room_owner";
  const canTransmitVoice =
    isRoomOwner || currentUser?.role === "band_member";

  const webRTCParams = useMemo(
    () => ({
      socket: activeSocket,
      currentUserId: currentUser?.id || "",
      currentUsername: currentUser?.username || "",
      roomId: currentRoom?.id || "",
      isEnabled: isVoiceEnabled,
      canTransmit: canTransmitVoice,
    }),
    [
      activeSocket,
      currentUser?.id,
      currentUser?.username,
      currentRoom?.id,
      isVoiceEnabled,
      canTransmitVoice,
    ]
  );

  const {
    addLocalStream,
    removeLocalStream,
    voiceUsers,
    peerConnections,
    isConnecting: isVoiceConnecting,
    connectionError: voiceConnectionError,
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

  useNetworkAnalytics({
    roomId: currentRoom?.id ?? null,
    roomType: currentRoom?.roomType ?? null,
    ping: null,
    totalLatency: currentLatency ?? null,
    browserLatency: browserAudioLatency ?? null,
    meshLatency: meshLatency ?? null,
    isConnected,
  });

  // Sync peer connections with RTC latency measurement
  // Use a ref to track peer connection IDs to avoid re-running effect on every Map change
  const lastSeenPeerIdsRef = useRef<Set<string>>(new Set());
  const addPeerConnectionRef = useRef(addPeerConnection);
  const removePeerConnectionRef = useRef(removePeerConnection);
  const peerConnectionsRef = useRef(peerConnections);

  // Keep refs in sync
  useEffect(() => {
    addPeerConnectionRef.current = addPeerConnection;
    removePeerConnectionRef.current = removePeerConnection;
    peerConnectionsRef.current = peerConnections;
  }, [addPeerConnection, removePeerConnection, peerConnections]);

  // Use a more efficient approach: only run when the size or keys change
  // Convert Map to a stable array of IDs for comparison
  const peerConnectionIds = useMemo(() => {
    return Array.from(peerConnections.keys()).sort().join(",");
  }, [peerConnections]);

  useEffect(() => {
    const currentConnections = peerConnectionsRef.current;
    const currentIds = new Set<string>();

    // Add or update current peer connections
    currentConnections.forEach((connection, userId) => {
      currentIds.add(userId);
      addPeerConnectionRef.current(userId, connection);
    });

    // Remove peers that were present before but not anymore
    const lastSeen = lastSeenPeerIdsRef.current;
    lastSeen.forEach((id) => {
      if (!currentIds.has(id)) {
        removePeerConnectionRef.current(id);
      }
    });

    // Update the last seen set
    lastSeenPeerIdsRef.current = currentIds;
  }, [peerConnectionIds]); // Only depend on the string of IDs, not the Map itself

  // DAW Collaboration enabled flag
  const isCollaborationEnabled = isConnected && !!currentRoom;
  const collaborationValue = useDAWCollaboration({
    socket: activeSocket,
    roomId: currentRoom?.id || null,
    enabled: isCollaborationEnabled,
  });

  // Initialize DAW store observers for undo/redo history
  useEffect(() => {
    const disposeObservers = initializeStoreObservers();
    return () => {
      disposeObservers?.();
    };
  }, []);

  // Broadcast setup
  const {
    handleBroadcastToggle,
    broadcastMidiMessage,
    getBroadcastUsers,
  } = useBroadcast({
    socket: activeSocket,
    roomId: currentRoom?.id || null,
    userId: userId || "",
    username: username || "",
    enabled: isConnected && !!currentRoom,
  });

  const voiceMuteStates = useArrangeUserStateStore((state) => state.voiceStates);
  const setVoiceMuteState = useArrangeUserStateStore((state) => state.setVoiceState);

  const activeRoomId = currentRoom?.id ?? null;

  // Broadcast playback (receive and play notes from other users)
  useBroadcastPlayback({
    socket: activeSocket,
    enabled: isConnected && !!currentRoom,
  });

  const handleVoiceMuteStateChange = useCallback(
    (isMuted: boolean) => {
      if (!userId) return;
      setVoiceMuteState(userId, isMuted);

      if (activeSocket && activeRoomId) {
        activeSocket.emit("arrange:voice_state", {
          roomId: activeRoomId,
          isMuted,
        });
      }
    },
    [userId, setVoiceMuteState, activeSocket, activeRoomId]
  );

  // Wrap recording handler to also broadcast virtual instrument notes
  const recordingHandler = useCallback(
    (message: MidiMessage) => {
      // Use ref to avoid closure issues with late initialization
      recordingHandlerRef.current(message);
      // Broadcast virtual instrument notes if broadcasting is enabled
      broadcastMidiMessage(message);
    },
    [broadcastMidiMessage]
  );

  // MIDI setup
  const setMidiStatus = useMidiStore((state) => state.setStatus);
  const setLastMidiMessage = useMidiStore((state) => state.setLastMessage);
  const lastMidiMessage = useMidiStore((state) => state.lastMessage);
  const handleMidiMessage = useCallback(
    (message: MidiMessage) => {
      setLastMidiMessage(message);
      // Use the wrapped recordingHandler which includes broadcasting
      recordingHandler(message);
    },
    [setLastMidiMessage, recordingHandler]
  );

  const midi = useMidiInput({
    autoConnect: true,
    onMessage: handleMidiMessage,
  });

  // Initialize playback engines and other DAW features
  usePlaybackEngine();
  useAudioRecordingEngine({
    handleRegionAdd: collaborationValue.handleRegionAdd,
  });
  useAudioRegionLoader();
  useMidiMonitoring(lastMidiMessage);

  const { isInitialized: isEffectsInitialized, error: effectsError } =
    useEffectsIntegration({
      userId: userId ?? "",
      enabled: Boolean(userId),
    });

  const { showError } = useToastNotification();

  useEffect(() => {
    if (effectsError) {
      showError("Failed to initialize audio effects. Some effects may not work properly.");
      console.error(
        "🎛️ Effects integration error (Arrange Room):",
        effectsError
      );
    }
  }, [effectsError, isEffectsInitialized, showError]);

  // Update MIDI status in store
  useEffect(() => {
    setMidiStatus({
      isSupported: midi.isSupported,
      isEnabled: midi.isEnabled,
      inputs: midi.inputs,
    });
  }, [midi.inputs, midi.isEnabled, midi.isSupported, setMidiStatus]);

  // Redirect to lobby if no username/userId
  useEffect(() => {
    if (!username || !userId) {
      navigate("/", { replace: true });
    }
  }, [username, userId, navigate]);

  // Redirect to lobby if no roomId
  useEffect(() => {
    if (!roomId) {
      navigate("/", { replace: true });
    }
  }, [roomId, navigate]);

  // Auto-join room when component mounts
  useEffect(() => {
    if (roomId && username && userId && !isConnected && !isConnecting) {
      // Room will be joined via useRoom hook when socket connects
      // This is handled automatically by the room management system
    }
  }, [roomId, username, userId, isConnected, isConnecting]);

  // Load project state when room is connected (for page refresh)
  useEffect(() => {
    if (!roomId || !isConnected) return;

    let isMounted = true;

    const loadProjectState = async () => {
      try {
        const project = await getRoomProject(roomId);
        if (!project || !isMounted) return;

        console.log('🔄 Loading project state from server after refresh:', {
          projectName: project.metadata?.name,
          tracks: project.tracks?.length,
          regions: project.regions?.length,
        });

        // Set loading flag
        useProjectStore.getState().setIsLoadingProject(true);

        // Deserialize project settings
        deserializeProject(project);

        // Load regions (they already have audioUrl set by the server)
        useRegionStore.setState({
          regions: project.regions || [],
          selectedRegionIds: [],
          lastSelectedRegionId: null,
        });

        // Load tracks
        if (project.tracks) {
          useTrackStore.setState({ tracks: project.tracks });
        }

        // Load synth states
        if (project.synthStates) {
          useSynthStore.setState({ synthStates: project.synthStates });
        }

        // Load effect chains
        if (project.effectChains) {
          useEffectsStore.setState({ chains: project.effectChains });
        }

        // Clear loading flag
        setTimeout(() => {
          if (isMounted) {
            useProjectStore.getState().setIsLoadingProject(false);
          }
        }, 200);

        console.log('✅ Project state loaded successfully');
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Failed to load project state';
        showError(`Failed to load project: ${errorMessage}`);
        console.error('Failed to load project state:', error);
        if (isMounted) {
          useProjectStore.getState().setIsLoadingProject(false);
        }
      }
    };

    // Small delay to ensure room is fully connected
    const timeoutId = setTimeout(loadProjectState, 500);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [roomId, isConnected, showError]);

  const handleKickConfirm = useCallback(() => {
    if (userToKick) {
      kickUser(userToKick.id);
      setShowKickModal(false);
      setUserToKick(null);
    }
  }, [userToKick, kickUser]);

  const handleCopyInviteUrl = useCallback(
    async (role: "band_member" | "audience") => {
      if (!roomId) return;

      const inviteUrl = generateInviteUrl(roomId, role, "arrange");
      let didCopy = false;

      try {
        await navigator.clipboard.writeText(inviteUrl);
        didCopy = true;
      } catch (error) {
        showError("Failed to copy invite URL. Please try again.");
        console.error("Failed to copy invite URL:", error);
      }

      if (didCopy) {
        setCopiedRole(role);
        setTimeout(() => setCopiedRole(null), 2000);
        trackInviteSent(roomAnalyticsContext, role, "copy");
      }
    },
    [roomId, generateInviteUrl, roomAnalyticsContext, showError]
  );

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
        const errorMessage = error instanceof Error
          ? error.message
          : "Failed to update room settings";
        showError(`Failed to update room settings: ${errorMessage}`);
        console.error("Failed to update room settings:", error);
      } finally {
        setIsUpdatingRoomSettings(false);
      }
    },
    [handleUpdateRoomSettings, showError]
  );

  useArrangeRoomScaleStore();

  // Performance settings
  const performanceSettings = usePerformanceStore((state) => state.settings);
  const updatePerformanceSettings = usePerformanceStore((state) => state.updateSettings);

  const handleOpenPerformanceSettings = useCallback(() => {
    setShowPerformanceSettingsModal(true);
  }, []);

  const handleClosePerformanceSettings = useCallback(() => {
    setShowPerformanceSettingsModal(false);
  }, []);

  const handleSavePerformanceSettings = useCallback(
    (settings: typeof performanceSettings) => {
      updatePerformanceSettings(settings);
      // You can add additional logic here to apply settings immediately
    },
    [updatePerformanceSettings]
  );

  // Resizable multitrack - mobile-friendly defaults
  const {
    height: multitrackHeight,
    isResizing: isMultitrackResizing,
    handleMouseDown: handleMultitrackMouseDown,
    attachHandleRef: attachMultitrackHandleRef,
  } = useResizable({
    initialHeight:
      typeof window !== "undefined" && window.innerWidth < 640 ? 250 : 400,
    minHeight: 200,
    maxHeight:
      typeof window !== "undefined" && window.innerWidth < 640 ? 400 : 800,
  });

  // Resizable region editor - mobile-friendly defaults
  const {
    height: regionEditorHeight,
    isResizing: isRegionEditorResizing,
    handleMouseDown: handleRegionEditorMouseDown,
    attachHandleRef: attachRegionEditorHandleRef,
  } = useResizable({
    initialHeight:
      typeof window !== "undefined" && window.innerWidth < 640 ? 220 : 320,
    minHeight: 200,
    maxHeight:
      typeof window !== "undefined" && window.innerWidth < 640 ? 350 : 1000,
  });

  // Computed values
  const pendingCount = currentRoom?.pendingMembers?.length ?? 0;
  const isLoadingProject = useProjectStore((state) => state.isLoadingProject);
  const isSavingProject = useProjectStore((state) => state.isSavingProject);

  return (
    <RoomSocketProvider socket={activeSocket}>
      <DAWCollaborationProvider
        socket={activeSocket}
        roomId={currentRoom?.id || null}
        enabled={isCollaborationEnabled}
        value={collaborationValue}
      >
      <TrackAudioParamsBridge />
      <KeyboardShortcutsBridge />
      <RecordingEngineBridge onHandlerReady={setRecordingHandlerBase} />
      
      {/* Loading Overlay */}
      {isLoadingProject && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="card bg-base-200 shadow-xl p-8">
            <div className="card-body items-center text-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <h3 className="card-title mt-4">Loading Project</h3>
              <p className="text-base-content/70">
                Please wait while we load the project...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Saving Overlay */}
      {isSavingProject && (
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
      
      <ToastNotification />
      <div className="min-h-dvh bg-base-200 flex flex-col">
        <div className="flex-1 pt-3 px-3">
          <div className="">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-secondary">
                  Arrange
                </h2>
                <span className="badge badge-xs sm:badge-sm badge-primary">
                  {currentRoom?.name}
                </span>
                <div className='divider divider-horizontal m-0!' />
                <span className="text-xs">
                  {currentUser?.username}
                </span>
                <span className="text-xs text-base-content/70">
                  {currentUser?.role === "room_owner"
                    ? "Room Owner"
                    : "Band Member"}
                </span>
                {/* Room Settings Button - Only for room owner */}
                {isRoomOwner && (
                  <button
                    onClick={handleOpenRoomSettings}
                    className="btn btn-xs btn-ghost"
                    title="Room Settings"
                  >
                    ⚙️
                  </button>
                )}
                {/* Performance Settings Button */}
                <button
                  onClick={handleOpenPerformanceSettings}
                  className="btn btn-xs btn-ghost"
                  title={`Performance Settings (Quality: ${performanceSettings.waveformQuality}, Lookahead: ${performanceSettings.audioLookahead}s)`}
                >
                  ⚡
                </button>
                <button
                  onClick={() => handleCopyInviteUrl("band_member")}
                  className={`btn btn-xs btn-ghost ${copiedRole === "band_member" ? "btn-success" : ""}`}
                  title="Copy invite link"
                >
                  {copiedRole === "band_member" ? "✓ Copied!" : "📋"}
                </button>
                {!isConnected && (
                  <span className="badge badge-xs sm:badge-sm badge-warning">
                    Connecting...
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ProjectMenu canLoadProject={isRoomOwner} />
                {/* Pending notification button for room owner */}
                {isRoomOwner && (
                  <div className="relative">
                    <button
                      ref={pendingBtnRef}
                      aria-label="Pending member requests"
                      className="btn btn-ghost btn-xs relative"
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
                      className="w-72 sm:w-80"
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
                                    className="btn btn-xs btn-success"
                                    onClick={() => handleApproveMember(user.id)}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    className="btn btn-xs btn-error"
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
                <button
                  onClick={handleLeaveRoomClick}
                  className="btn btn-outline btn-xs sm:btn-xs"
                >
                  <span className="hidden sm:inline">Leave Room</span>
                  <span className="sm:hidden">Leave</span>
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col">
              <TransportToolbar />
              <div className="flex flex-col xl:flex-row xl:h-[calc(100vh-10rem)]">
                {/* Main content area */}
                <main className="flex flex-1 flex-col gap-2 p-1 overflow-y-auto min-w-0">
                  {/* Resizable Multitrack Section */}
                  <div className="relative">
                    <div
                      style={{ height: `${multitrackHeight}px` }}
                      className="overflow-hidden"
                    >
                      <MultitrackView />
                    </div>

                    {/* Resize Handle */}
                    <div
                      ref={attachMultitrackHandleRef}
                      onMouseDown={handleMultitrackMouseDown}
                      onTouchStart={handleMultitrackMouseDown}
                      className={`
                        h-2 w-full cursor-ns-resize
                        flex items-center justify-center
                        hover:bg-primary/20 active:bg-primary/30
                        transition-colors
                        ${isMultitrackResizing ? "bg-primary/30" : "bg-base-300"}
                      `}
                      style={{ touchAction: "none" }}
                      title="Drag to resize"
                    >
                      <div className="w-12 h-1 bg-base-content/30 rounded-full" />
                    </div>
                  </div>

                  {/* Resizable Region Editor Section */}
                  <div className="relative">
                    <div
                      style={{ height: `${regionEditorHeight}px` }}
                      className="overflow-hidden"
                    >
                      <RegionEditor />
                    </div>

                    {/* Resize Handle */}
                    <div
                      ref={attachRegionEditorHandleRef}
                      onMouseDown={handleRegionEditorMouseDown}
                      onTouchStart={handleRegionEditorMouseDown}
                      className={`
                        h-2 w-full cursor-ns-resize
                        flex items-center justify-center
                        hover:bg-primary/20 active:bg-primary/30
                        transition-colors
                        ${isRegionEditorResizing ? "bg-primary/30" : "bg-base-300"}
                      `}
                      style={{ touchAction: "none" }}
                      title="Drag to resize"
                    >
                      <div className="w-12 h-1 bg-base-content/30 rounded-full" />
                    </div>
                  </div>

                  <SynthControlsPanel />

                  <VirtualInstrumentPanel
                    onRecordMidiMessage={recordingHandler}
                  />
                </main>

                {/* Sidebar: Right on desktop, bottom on mobile */}
                <div className="flex flex-col xl:flex-row gap-2">
                  <Sidebar
                    collaboratorsProps={useMemo(
                      () => ({
                        isVoiceEnabled,
                        canTransmitVoice,
                        onStreamReady: addLocalStream,
                        onStreamRemoved: removeLocalStream,
                        rtcLatency: currentLatency,
                        rtcLatencyActive,
                        browserAudioLatency,
                        meshLatency,
                        isConnecting: isVoiceConnecting,
                        connectionError: !!voiceConnectionError,
                        onConnectionRetry: () => window.location.reload(),
                        userCount: currentRoom?.users?.length || 0,
                        roomUsers: currentRoom?.users || [],
                        voiceUsers,
                        broadcastUsers: getBroadcastUsers(),
                        voiceMuteStates,
                        onMuteStateChange: handleVoiceMuteStateChange,
                        onBroadcastChange: handleBroadcastToggle,
                      }),
                      [
                        isVoiceEnabled,
                        canTransmitVoice,
                        addLocalStream,
                        removeLocalStream,
                        currentLatency,
                        rtcLatencyActive,
                        browserAudioLatency,
                        meshLatency,
                        isVoiceConnecting,
                        voiceConnectionError,
                        currentRoom?.users,
                        voiceUsers,
                        getBroadcastUsers,
                        voiceMuteStates,
                        handleVoiceMuteStateChange,
                        handleBroadcastToggle,
                      ]
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />

        {/* Modals */}
        {showLeaveConfirmModal && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg">Leave Room?</h3>
              <p className="py-4">Are you sure you want to leave this room?</p>
              <div className="modal-action">
                <button
                  onClick={() => setShowLeaveConfirmModal(false)}
                  className="btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveRoomConfirm}
                  className="btn btn-primary"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}

        {showKickModal && (
          <KickUserModal
            open={showKickModal}
            onClose={() => {
              setShowKickModal(false);
              setUserToKick(null);
            }}
            targetUser={userToKick}
            onConfirm={handleKickConfirm}
          />
        )}

        {/* Room Settings Modal */}
        <RoomSettingsModal
          open={showRoomSettingsModal}
          onClose={handleCloseRoomSettings}
          onSave={handleSaveRoomSettings}
          room={currentRoom}
          isLoading={isUpdatingRoomSettings}
        />

        {/* Performance Settings Modal */}
        <PerformanceSettingsModal
          open={showPerformanceSettingsModal}
          onClose={handleClosePerformanceSettings}
          onSave={handleSavePerformanceSettings}
          currentSettings={performanceSettings}
        />
      </div>
    </DAWCollaborationProvider>
  </RoomSocketProvider>
  );
}

const TrackAudioParamsBridge = memo(() => {
  useTrackAudioParams();
  return null;
});
TrackAudioParamsBridge.displayName = "TrackAudioParamsBridge";

const KeyboardShortcutsBridge = memo(() => {
  useKeyboardShortcuts();
  return null;
});
KeyboardShortcutsBridge.displayName = "KeyboardShortcutsBridge";

interface RecordingEngineBridgeProps {
  onHandlerReady: Dispatch<SetStateAction<(message: MidiMessage) => void>>;
}

const RecordingEngineBridge = memo(
  ({ onHandlerReady }: RecordingEngineBridgeProps) => {
    const handler = useRecordingEngine();

    useEffect(() => {
      onHandlerReady(() => handler);
    }, [handler, onHandlerReady]);

    return null;
  }
);
RecordingEngineBridge.displayName = "RecordingEngineBridge";
