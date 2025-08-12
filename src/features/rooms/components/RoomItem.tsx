import type { Room } from "@/shared/types";

interface RoomItemProps {
  room: Room;
  onJoinAsBandMember: (roomId: string) => void;
  onJoinAsAudience: (roomId: string) => void;
  onCopyRoomUrl: (roomId: string) => void;
}

export default function RoomItem({
  room,
  onJoinAsBandMember,
  onJoinAsAudience,
  onCopyRoomUrl,
}: RoomItemProps) {
  const userCount = room.users.length;

  return (
    <div className="card bg-base-200">
      <div className="card-body p-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{room.name}</h3>
              <button
                onClick={() => onCopyRoomUrl(room.id)}
                className="btn btn-xs btn-ghost"
                title="Copy room URL"
              >
                📋
              </button>
            </div>
            <p className="text-sm text-base-content/70">
              {userCount} member{userCount !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-base-content/50">
              Created {new Date(room.createdAt).toLocaleDateString()}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {room.isPrivate && (
                <span className="badge badge-warning badge-xs">Private</span>
              )}
              {room.isHidden && (
                <span className="badge badge-neutral badge-xs">Hidden</span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => onJoinAsBandMember(room.id)}
              className="btn btn-sm btn-primary"
            >
              Join as Band Member
            </button>
            <button
              onClick={() => onJoinAsAudience(room.id)}
              className="btn btn-sm btn-outline"
            >
              Join as Audience
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
