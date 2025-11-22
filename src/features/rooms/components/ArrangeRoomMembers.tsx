import { useUserStore } from "@/shared/stores";
import type { RoomUser } from "@/shared/types";
import { memo } from "react";

interface VoiceUser {
  userId: string;
  username: string;
  isMuted: boolean;
  audioLevel: number;
}

interface BroadcastUser {
  userId: string;
  username: string;
  trackId: string;
}

interface ArrangeRoomMembersProps {
  users: RoomUser[];
  voiceUsers?: VoiceUser[];
  broadcastUsers?: BroadcastUser[];
}

const ArrangeRoomMembers = memo(
  ({ users, voiceUsers = [], broadcastUsers = [] }: ArrangeRoomMembersProps) => {
    const { userId: currentUserId } = useUserStore();

    // Separate users by role
    const roomMembers = users.filter(
      (user) => user.role === "room_owner" || user.role === "band_member"
    );
    // const audience = users.filter((user) => user.role === "audience");

    // Sort performers by role (room_owner first, then band_member)
    const sortedRoomMembers = roomMembers.slice().sort((a, b) => {
      const roleOrder: Record<string, number> = {
        room_owner: 0,
        band_member: 1,
      };
      return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
    });

    const renderUser = (user: RoomUser) => {
      const voiceUser = voiceUsers.find((v) => v.userId === user.id);
      const broadcastUser = broadcastUsers.find((b) => b.userId === user.id);
      const isCurrentUser = user.id === currentUserId;
      // const isAudience = user.role === "audience";

      // Determine border color based on speaking activity
      const borderColor =
        voiceUser?.audioLevel && voiceUser.audioLevel > 0.01
          ? "hsl(30, 100%, 60%)"
          : "transparent";

      return (
        <div
          key={user.id}
          className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-colors ${
            isCurrentUser ? "bg-primary/10" : "bg-base-200"
          }`}
          style={{
            borderColor,
          }}
        >
          {/* Role indicator */}
          {user.role === "room_owner" && <div className="text-sm">👑</div>}
          {/* {isAudience && <div className="text-sm">👥</div>} */}

          {/* Broadcast indicator */}
          {broadcastUser && (
            <div className="text-sm" title="Broadcasting instrument">
              🎹
            </div>
          )}

          {/* Username */}
          <span className="font-medium text-sm flex-1">{user.username}</span>
        </div>
      );
    };

    return (
      <div className="space-y-3">
        {/* Performers Section */}
        {sortedRoomMembers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-base-content/70">
              Room Members
            </h4>
            <div className="flex flex-wrap gap-2">
              {sortedRoomMembers.map((user) => renderUser(user))}
            </div>
          </div>
        )}

        {/* Audience Section */}
        {/* {audience.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {audience.map((user) => renderUser(user))}
            </div>
          </div>
        )} */}
      </div>
    );
  }
);

ArrangeRoomMembers.displayName = "ArrangeRoomMembers";

export default ArrangeRoomMembers;

