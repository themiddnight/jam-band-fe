import { useEffect, useState, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUserStore } from "@/shared/stores/userStore";
import { Footer } from "@/features/ui";
import { useDeepLinkHandler } from "@/shared/hooks/useDeepLinkHandler";
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
import { ProjectMenu } from "@/features/daw/components/ProjectMenu";
import { useRoom } from "@/features/rooms";
import { useWebRTCVoice } from "@/features/audio";
import { VoiceInput } from "@/features/audio";
import { DAWCollaborationProvider } from "@/features/daw/contexts/DAWCollaborationContext";
import { RoomMembers, KickUserModal } from "@/features/rooms";
import type { Socket } from "socket.io-client";
import { useDAWCollaboration } from "@/features/daw/hooks/useDAWCollaboration";
import { useAudioRegionLoader } from "@/features/daw/hooks/playback/useAudioRegionLoader";

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
  const [recordingHandler, setRecordingHandler] = useState<(message: MidiMessage) => void>(() => () => {});

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
    kickUser,
    getActiveSocket,
  } = useRoom();

  // Get active socket for collaboration
  const activeSocket = getActiveSocket();
  const socketRef = useRef<Socket | null>(null);
  socketRef.current = activeSocket;

  // WebRTC Voice Communication
  const isVoiceEnabled = !!currentUser?.role;
  const canTransmitVoice =
    currentUser?.role === "room_owner" || currentUser?.role === "band_member";

  const webRTCParams = {
    socket: activeSocket,
    currentUserId: currentUser?.id || "",
    currentUsername: currentUser?.username || "",
    roomId: currentRoom?.id || "",
    isEnabled: isVoiceEnabled,
    canTransmit: canTransmitVoice,
  };

  const {
    addLocalStream,
    removeLocalStream,
  } = useWebRTCVoice(webRTCParams);

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

  // MIDI setup
  const setMidiStatus = useMidiStore((state) => state.setStatus);
  const setLastMidiMessage = useMidiStore((state) => state.setLastMessage);
  const lastMidiMessage = useMidiStore((state) => state.lastMessage);
  const midi = useMidiInput({
    autoConnect: true,
    onMessage: (message) => {
      setLastMidiMessage(message);
      recordingHandler(message);
    },
  });

  // Initialize playback engines and other DAW features
  usePlaybackEngine();
  useAudioRecordingEngine({ handleRegionAdd: collaborationValue.handleRegionAdd });
  useAudioRegionLoader();
  useMidiMonitoring(lastMidiMessage);

  const { isInitialized: isEffectsInitialized, error: effectsError } = useEffectsIntegration({
    userId: userId ?? "",
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (effectsError) {
      console.error("🎛️ Effects integration error (Arrange Room):", effectsError);
    }
    if (isEffectsInitialized) {
      console.log("🎛️ Arrange Room effects integration active");
    }
  }, [effectsError, isEffectsInitialized]);

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

  const handleKickUser = (targetUserId: string) => {
    const user = currentRoom?.users?.find((u: any) => u.id === targetUserId);
    if (user) {
      setUserToKick(user);
      setShowKickModal(true);
    }
  };

  const handleKickConfirm = () => {
    if (userToKick) {
      kickUser(userToKick.id);
      setShowKickModal(false);
      setUserToKick(null);
    }
  };

  const handleCopyInviteUrl = async (role: "band_member" | "audience") => {
    if (!roomId) return;

    const inviteUrl = generateInviteUrl(roomId, role, "arrange");

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedRole(role);
      setTimeout(() => setCopiedRole(null), 2000);
    } catch (error) {
      console.error("Failed to copy invite URL:", error);
    }
  };

  useArrangeRoomScaleStore();

  return (
    <DAWCollaborationProvider
      socket={activeSocket}
      roomId={currentRoom?.id || null}
      enabled={isCollaborationEnabled}
      value={collaborationValue}
    >
      <TrackAudioParamsBridge />
      <KeyboardShortcutsBridge />
      <RecordingEngineBridge onHandlerReady={setRecordingHandler} />
      <div className="min-h-dvh bg-base-200 flex flex-col">
        <div className="flex-1 p-3">
        <div className="">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-secondary">Arrange Room</h2>
                {currentRoom && (
                  <span className="badge badge-sm badge-primary">{currentRoom.name}</span>
                )}
                {!isConnected && (
                  <span className="badge badge-sm badge-warning">Connecting...</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ProjectMenu />
              <div className="dropdown dropdown-end">
                <label tabIndex={0} className="btn btn-sm btn-ghost" title="Copy invite link">
                  📋
                </label>
                <div tabIndex={0} className="dropdown-content z-[1] card card-compact w-64 p-2 shadow bg-base-100">
                  <div className="card-body">
                    <h3 className="font-bold text-sm">Copy Invite Link</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleCopyInviteUrl("band_member")}
                        className={`btn btn-sm w-full ${copiedRole === "band_member" ? "btn-success" : "btn-primary"}`}
                      >
                        {copiedRole === "band_member" ? "✓ Copied!" : "📋 Producer"}
                      </button>
                      <button
                        onClick={() => handleCopyInviteUrl("audience")}
                        className={`btn btn-sm w-full ${copiedRole === "audience" ? "btn-success" : "btn-outline"}`}
                      >
                        {copiedRole === "audience" ? "✓ Copied!" : "📋 Listener"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLeaveRoomClick}
                className="btn btn-outline btn-sm"
              >
                Leave Room
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div>
            <TransportToolbar />
            <div className="flex flex-1 flex-col xl:flex-row overflow-hidden">
              {/* Main content area */}
              <main className="flex flex-1 flex-col gap-2 p-1 overflow-hidden min-w-0">
                <div className="flex-1 min-h-0">
                  <MultitrackView />
                </div>
                
                <div className="h-64 sm:h-80 lg:h-96">
                  <RegionEditor />
                </div>

                <SynthControlsPanel />

                          <VirtualInstrumentPanel onRecordMidiMessage={recordingHandler} />
              </main>

              {/* Sidebar: Right on desktop, bottom on mobile */}
              <div className="flex flex-col xl:flex-row gap-2">
                <Sidebar />
                
                {/* Room Members Sidebar */}
                {currentRoom && (
                  <div className="w-full xl:w-64 bg-base-100 rounded-lg shadow p-4">
                    <h3 className="font-bold text-sm mb-2">Room Members</h3>
                    <RoomMembers
                      users={currentRoom.users || []}
                      pendingMembers={currentRoom.pendingMembers || []}
                      playingIndicators={new Map()}
                      onKickUser={handleKickUser}
                      onApproveMember={() => {}}
                      onRejectMember={() => {}}
                      onSwapInstrument={() => {}}
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* WebRTC Voice Input */}
            {isVoiceEnabled && (
              <div className="mt-2">
                <VoiceInput
                  isVisible={true}
                  onStreamReady={addLocalStream}
                  onStreamRemoved={removeLocalStream}
                />
              </div>
            )}
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
              <button onClick={() => setShowLeaveConfirmModal(false)} className="btn">
                Cancel
              </button>
              <button onClick={handleLeaveRoomConfirm} className="btn btn-primary">
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
      </div>
    </DAWCollaborationProvider>
  );
}

const TrackAudioParamsBridge = () => {
  useTrackAudioParams();
  return null;
};

const KeyboardShortcutsBridge = () => {
  useKeyboardShortcuts();
  return null;
};

interface RecordingEngineBridgeProps {
  onHandlerReady: Dispatch<SetStateAction<(message: MidiMessage) => void>>;
}

const RecordingEngineBridge = ({ onHandlerReady }: RecordingEngineBridgeProps) => {
  const handler = useRecordingEngine();

  useEffect(() => {
    onHandlerReady(() => handler);
  }, [handler, onHandlerReady]);

  return null;
};

