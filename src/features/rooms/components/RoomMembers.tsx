import PlayingIndicator from "./PlayingIndicator";
import UserActionsMenu from "./UserActionsMenu";
import PendingSwapStatus from "./PendingSwapStatus";
import { getInstrumentIcon } from "@/shared/constants/instruments";
import { useUserStore } from "@/shared/stores";
import type { RoomUser } from "@/shared/types";
import { memo } from "react";

interface VoiceUser {
  userId: string;
  username: string;
  isMuted: boolean;
  audioLevel: number;
}

interface RoomMembersProps {
  users: RoomUser[];
  pendingMembers: RoomUser[];
  playingIndicators: Map<string, { velocity: number; timestamp: number }>;
  voiceUsers?: VoiceUser[];
  onApproveMember: (userId: string) => void;
  onRejectMember: (userId: string) => void;
  onSwapInstrument: (targetUserId: string) => void;
  onKickUser: (targetUserId: string) => void;
  pendingSwapTarget?: RoomUser | null;
  onCancelSwap?: () => void;
}

const RoomMembers = memo(
  ({ 
    users, 
    playingIndicators, 
    voiceUsers = [], 
    onSwapInstrument,
    onKickUser,
    pendingSwapTarget,
    onCancelSwap
  }: RoomMembersProps) => {
    const { userId: currentUserId } = useUserStore();
    
    const sortedUsers = users.slice().sort((a, b) => {
      const roleOrder = {
        room_owner: 0,
        band_member: 1,
        audience: 2,
      } as const;
      return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
    });

    // Get current user's role for permission checks
    const currentUser = users.find(user => user.id === currentUserId);
    const currentUserRole = currentUser?.role || "";

    return (
      <div className="card bg-base-100 shadow-lg w-full">
        <div className="card-body p-3">
          <h3 className="card-title">Room Members</h3>
          {/* Active Members - Compact List */}
          <div className="flex flex-wrap gap-2">
            {sortedUsers.map((user) => {
              const playingIndicator = playingIndicators.get(user.id);
              const voiceUser = voiceUsers.find((v) => v.userId === user.id);
              const isCurrentUser = user.id === currentUserId;
              const hasPendingSwap = isCurrentUser && pendingSwapTarget;

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-2 bg-base-200 rounded-lg min-w-fit transition-all duration-100 border-2"
                  style={{
                    borderColor:
                      voiceUser?.audioLevel && voiceUser.audioLevel > 0.01
                        ? "hsl(30, 100%, 60%)"
                        : "transparent",
                  }}
                >
                  {user.role === "room_owner" && <div>👑</div>}
                  {user.role !== "audience" && (
                    <PlayingIndicator
                      velocity={playingIndicator?.velocity || 0}
                      mode="pulse"
                    />
                  )}
                  {voiceUser?.isMuted && user.role !== "audience" && "🔇"}
                  
                  {/* Username or Pending Status */}
                  <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm whitespace-nowrap">
                    {user.username}
                  </span>
                    {hasPendingSwap && onCancelSwap && (
                      <PendingSwapStatus
                        targetUser={pendingSwapTarget}
                        onCancel={onCancelSwap}
                      />
                    )}
                  </div>
                  
                  <div className="flex gap-2 text-xs whitespace-nowrap">
                    {user.role === "band_member" ||
                    user.role === "room_owner" ? (
                      user.currentInstrument ? (
                        getInstrumentIcon(user.currentInstrument)
                      ) : (
                        <div>🎸</div>
                      )
                    ) : (
                      <div>👥</div>
                    )}
                  </div>
                  {user.role !== "audience" && user.currentInstrument ? (
                    <span className="text-xs text-base-content/60 bg-base-300 px-2 py-1 rounded whitespace-nowrap">
                      {user.currentInstrument.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  
                  {/* User Actions Menu - only for other users */}
                  {!isCurrentUser && (
                    <UserActionsMenu
                      user={user}
                      currentUserRole={currentUserRole}
                      onSwapInstrument={onSwapInstrument}
                      onKickUser={onKickUser}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

RoomMembers.displayName = "RoomMembers";

export default RoomMembers;
