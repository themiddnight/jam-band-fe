import { useRef, useState } from "react";
import { PingDisplay } from "@/features/audio";
import { AnchoredPopup } from "@/features/ui";
import { useDeepLinkHandler } from "@/shared/hooks/useDeepLinkHandler";
import { trackInviteSent } from "@/shared/analytics/events";
import { isUserRestricted, getRestrictionMessage } from "@/shared/utils/userPermissions";
import type { Room, RoomUser } from "@/shared/types";

// Helper function to format recording duration
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface PerformRoomHeaderProps {
  currentRoom: Room | null;
  currentUser: RoomUser | null;
  isConnected: boolean;
  isConnecting: boolean;
  currentPing: number | null;
  isRecording: boolean;
  isAudioRecording: boolean;
  isSessionRecording: boolean;
  recordingDuration: number;
  isBroadcasting: boolean;
  isBroadcastStarting: boolean;
  roomAnalyticsContext: any;
  
  // Actions
  handleOpenRoomSettings: () => void;
  handleLeaveRoomClick: () => void;
  toggleAudioRecording: () => void;
  toggleSessionRecording: () => void;
  toggleBroadcast: () => void;
  handleApproveMember: (userId: string) => void;
  handleRejectMember: (userId: string) => void;
}

export const PerformRoomHeader = ({
  currentRoom,
  currentUser,
  isConnected,
  isConnecting,
  currentPing,
  isRecording,
  isAudioRecording,
  isSessionRecording,
  recordingDuration,
  isBroadcasting,
  isBroadcastStarting,
  roomAnalyticsContext,
  handleOpenRoomSettings,
  handleLeaveRoomClick,
  toggleAudioRecording,
  toggleSessionRecording,
  toggleBroadcast,
  handleApproveMember,
  handleRejectMember,
}: PerformRoomHeaderProps) => {
  const { generateInviteUrl } = useDeepLinkHandler();
  
  // Local state
  const [isInvitePopupOpen, setIsInvitePopupOpen] = useState(false);
  const [isRecordingMenuOpen, setIsRecordingMenuOpen] = useState(false);
  const [isPendingPopupOpen, setIsPendingPopupOpen] = useState(false);
  
  // Refs
  const inviteBtnRef = useRef<HTMLButtonElement>(null);
  const recordingBtnRef = useRef<HTMLButtonElement>(null);
  const pendingBtnRef = useRef<HTMLButtonElement>(null);

  const pendingCount = currentRoom?.pendingMembers?.length ?? 0;

  const showSuccessMessage = (buttonId: string, message: string) => {
    const button = document.getElementById(buttonId);
    if (button) {
      const originalText = button.textContent;
      button.textContent = message;
      button.classList.add("btn-success");

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("btn-success");
      }, 2000);
    }
  };

  const handleCopyInviteUrl = async (role: "band_member" | "audience") => {
    if (!currentRoom?.id) return;

    const inviteUrl = generateInviteUrl(currentRoom.id, role, "perform");
    let didCopy = false;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      didCopy = true;
      showSuccessMessage(`copy-invite-${role}`, "Copied!");
    } catch (error: unknown) {
      console.error("Failed to copy invite URL:", error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement("textarea");
        textArea.value = inviteUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        didCopy = true;
        showSuccessMessage(`copy-invite-${role}`, "Copied!");
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
      }
    }

    if (didCopy) {
      trackInviteSent(roomAnalyticsContext, role, "copy");
    }
  };

  const handleShareInviteUrl = async (role: "band_member" | "audience") => {
    if (!currentRoom?.id) return;

    const inviteUrl = generateInviteUrl(currentRoom.id, role, "perform");
    const roleText = role === "band_member" ? "Band Member" : "Audience";

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${currentRoom?.name} on COLLAB`,
          text: `You're invited to join "${currentRoom?.name}" as ${roleText} on COLLAB!`,
          url: inviteUrl,
        });
        trackInviteSent(roomAnalyticsContext, role, "share");
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to share invite URL:", error);
        // Fallback to copy
        handleCopyInviteUrl(role);
      }
    } else {
      // Fallback to copy if share API not available
      handleCopyInviteUrl(role);
    }
  };

  return (
    <div className="w-full mb-4">
      {/* Room Name and Copy URL Button */}
      <div className="flex justify-between items-center flex-wrap">
        <div className="flex items-center gap-2 flrx-wrap">
          <h2 className="text-lg sm:text-xl font-bold text-primary">
            Perform
          </h2>
          <span className="badge badge-xs sm:badge-sm badge-primary">
            {currentRoom?.name}
          </span>

          <div className='divider divider-horizontal m-0!' />

          {/* User Name and Role */}
          <div className="flex items-center">
            <span className="text-sm mr-2">
              {currentUser?.username}
            </span>
            <span className="text-sm text-base-content/50">
              {currentUser?.role === "room_owner"
                ? "Room Owner"
                : "Band Member"}
            </span>
          </div>

          {/* Room Settings Button - Only for room owner */}
          {currentUser?.role === "room_owner" && (
            <button
              onClick={handleOpenRoomSettings}
              className="btn btn-xs btn-ghost"
              title="Room Settings"
            >
              ⚙️
            </button>
          )}

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
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-base-content/60 mb-2">
                      Band Member
                    </p>
                    <div className="flex gap-2">
                      <button
                        id="copy-invite-band_member"
                        onClick={() => handleCopyInviteUrl("band_member")}
                        className="btn btn-sm btn-primary flex-1"
                        title="Copy link for band member invitation"
                      >
                        📋 Copy
                      </button>
                      <button
                        id="share-invite-band_member"
                        onClick={() =>
                          handleShareInviteUrl("band_member")
                        }
                        className="btn btn-sm btn-outline"
                        title="Share link for band member invitation"
                      >
                        📤
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/60 mb-2">
                      Audience
                    </p>
                    <div className="flex gap-2">
                      <button
                        id="copy-invite-audience"
                        onClick={() => handleCopyInviteUrl("audience")}
                        className="btn btn-sm btn-outline flex-1"
                        title="Copy link for audience invitation"
                      >
                        📋 Copy
                      </button>
                      <button
                        id="share-invite-audience"
                        onClick={() => handleShareInviteUrl("audience")}
                        className="btn btn-sm btn-outline"
                        title="Share link for audience invitation"
                      >
                        📤
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </AnchoredPopup>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Recording Button with Dropdown */}
          <div className="relative">
            <button
              ref={recordingBtnRef}
              onClick={() => {
                if (isRecording) {
                  // If recording, stop whatever is recording
                  if (isAudioRecording) {
                    toggleAudioRecording();
                  } else if (isSessionRecording) {
                    toggleSessionRecording();
                  }
                } else {
                  // If not recording, show dropdown
                  setIsRecordingMenuOpen((v) => !v);
                }
              }}
              className={`btn btn-xs ${isRecording ? 'btn-error' : 'btn-soft btn-error'}`}
              title={isRecording ? `Recording... ${formatDuration(recordingDuration)}` : (isUserRestricted() ? getRestrictionMessage() : 'Start recording')}
              disabled={isUserRestricted()}
            >
              {isRecording ? 'Stop' : 'Record'}
              {isRecording && (
                <span className="ml-1 text-xs">{formatDuration(recordingDuration)}</span>
              )}
              {!isRecording && <span className="ml-1">▼</span>}
            </button>
            <AnchoredPopup
              open={isRecordingMenuOpen}
              onClose={() => setIsRecordingMenuOpen(false)}
              anchorRef={recordingBtnRef}
              placement="bottom"
              className="w-56"
            >
              <div className="p-2">
                <h4 className="font-semibold text-sm mb-2 px-2">Record Session</h4>
                <ul className="menu bg-base-100 w-full p-0">
                  <li>
                    <button
                      onClick={() => {
                        setIsRecordingMenuOpen(false);
                        toggleAudioRecording();
                      }}
                      className="flex items-center gap-2"
                    >
                      <span>🎵</span>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Record Audio</span>
                        <span className="text-xs text-base-content/60">Mixed WAV file</span>
                      </div>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setIsRecordingMenuOpen(false);
                        toggleSessionRecording();
                      }}
                      className="flex items-center gap-2"
                    >
                      <span>🎹</span>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Record Project</span>
                        <span className="text-xs text-base-content/60">Multitrack .collab file</span>
                      </div>
                    </button>
                  </li>
                </ul>
              </div>
            </AnchoredPopup>
          </div>
          {/* Broadcast Button - Room Owner Only */}
          {currentUser?.role === "room_owner" && (
            <button
              onClick={toggleBroadcast}
              className={`btn btn-xs ${isBroadcasting ? 'btn-success' : 'btn-soft btn-success'}`}
              title={isBroadcasting ? 'Stop broadcasting to audience' : (isUserRestricted() ? getRestrictionMessage() : 'Start broadcasting to audience')}
              disabled={isBroadcastStarting || isUserRestricted()}
            >
              {isBroadcastStarting ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : isBroadcasting ? (
                <>
                  <span className="animate-pulse">📡</span>
                  <span className="ml-1 text-xs">LIVE</span>
                </>
              ) : (
                '📡 Broadcast'
              )}
            </button>
          )}

          <div className='divider divider-horizontal m-0!' />

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
                      {currentRoom?.pendingMembers.map((user: RoomUser) => (
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

          <div className="flex items-center gap-3 min-w-16">
            <div
              className={`w-3 h-3 rounded-full ${isConnected
                ? "bg-success"
                : isConnecting
                  ? "bg-warning"
                  : "bg-error"
                }`}
            ></div>
            <PingDisplay
              ping={currentPing}
              isConnected={isConnected}
              variant="compact"
              showLabel={false}
            />
          </div>
          <button
            onClick={handleLeaveRoomClick}
            className="btn btn-outline btn-xs"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
};
