import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUserStore } from "@/shared/stores/userStore";
import { Footer } from "@/features/ui";
import { useDeepLinkHandler } from "@/shared/hooks/useDeepLinkHandler";
import { MultitrackView } from "@/features/daw/multitrack";
import { Sidebar } from "@/features/daw/sidebar";
import { RegionEditor } from "@/features/daw/regioneditor";
import VirtualInstrumentPanel from "@/features/daw/components/VirtualInstrumentPanel";
import { SynthControlsPanel } from "@/features/daw/components/SynthControlsPanel";
import { TransportToolbar } from "@/features/daw/transport";
import { usePlaybackEngine } from "@/features/daw/playback/usePlaybackEngine";
import { useRecordingEngine } from "@/features/daw/playback/useRecordingEngine";
import { useAudioRecordingEngine } from "@/features/daw/playback/useAudioRecordingEngine";
import { useMidiMonitoring } from "@/features/daw/playback/useMidiMonitoring";
import { useMidiInput } from "@/features/daw/hooks/useMidiInput";
import { useKeyboardShortcuts } from "@/features/daw/hooks/useKeyboardShortcuts";
import { useTrackAudioParams } from "@/features/daw/hooks/useTrackAudioParams";
import { useEffectsIntegration } from "@/features/effects/hooks/useEffectsIntegration";
import { initializeStoreObservers } from "@/features/daw/stores/storeObservers";
import { useMidiStore } from "@/features/daw/stores/midiStore";
import { useArrangeRoomScaleStore } from "@/features/daw/stores/arrangeRoomStore";

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
  const handleRecordingMidiMessage = useRecordingEngine();
  const midi = useMidiInput({
    autoConnect: true,
    onMessage: (message) => {
      setLastMidiMessage(message);
      handleRecordingMidiMessage(message);
    },
  });

  // Initialize playback engines and other DAW features
  usePlaybackEngine();
  useAudioRecordingEngine();
  useMidiMonitoring(lastMidiMessage);
  useKeyboardShortcuts();
  useTrackAudioParams();

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

  const handleLeaveRoom = () => {
    navigate("/");
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
    <div className="min-h-dvh bg-base-200 flex flex-col">
      <div className="flex-1 p-3">
        <div className="">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-secondary">Arrange Room</h2>
                <span className="badge badge-sm badge-secondary">Demo</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                onClick={handleLeaveRoom}
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

                <VirtualInstrumentPanel onRecordMidiMessage={handleRecordingMidiMessage} />
              </main>

              {/* Sidebar: Right on desktop, bottom on mobile */}
              <Sidebar />
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
}

