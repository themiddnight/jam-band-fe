import type { RoomUser } from "../stores/roomStore";
import PlayingIndicator from "./PlayingIndicator";
import { memo } from "react";

interface RoomMembersProps {
  users: RoomUser[];
  pendingMembers: RoomUser[];
  playingIndicators: Map<string, { velocity: number; timestamp: number }>;
  onApproveMember: (userId: string) => void;
  onRejectMember: (userId: string) => void;
}

const RoomMembers = memo(({ users, playingIndicators }: RoomMembersProps) => {
  const sortedUsers = users.slice().sort((a, b) => {
    const roleOrder = {
      room_owner: 0,
      band_member: 1,
      audience: 2,
    } as const;
    return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
  });

  return (
    <div className="w-full max-w-6xl my-3">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body p-2">
          <h3 className="card-title">Room Members</h3>
          {/* Active Members - Compact List */}
          <div className="flex flex-wrap gap-2">
            {sortedUsers.map((user) => {
              const playingIndicator = playingIndicators.get(user.username);

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-2 bg-base-200 rounded-lg min-w-fit"
                >
                  {user.role !== "audience" && (
                    <PlayingIndicator
                      velocity={playingIndicator?.velocity || 0}
                    />
                  )}
                  <span className="font-medium text-sm whitespace-nowrap">
                    {user.username}
                  </span>
                  {user.role !== "audience" && user.currentInstrument ? (
                    <span className="text-xs text-base-content/60 bg-base-300 px-2 py-1 rounded whitespace-nowrap">
                      {user.currentInstrument.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  <span className="text-xs whitespace-nowrap">
                    {user.role === "room_owner"
                      ? "👑"
                      : user.role === "band_member"
                        ? "🎹"
                        : "🦻🏼"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

RoomMembers.displayName = "RoomMembers";

export default RoomMembers;
