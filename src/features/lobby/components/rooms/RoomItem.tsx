import { ConnectionState } from "@/features/audio/types/connectionState";

interface RoomItemProps {
  room: {
    id: string;
    name: string;
    roomType: "perform" | "arrange";
    description?: string;
    isPrivate: boolean;
    isHidden: boolean;
    userCount: number;
  };
  onJoinRoom: (roomId: string, role: "band_member" | "audience") => void;
  isConnecting: boolean;
  connectionState: ConnectionState;
}

export function RoomItem({
  room,
  onJoinRoom,
  isConnecting,
  connectionState,
}: RoomItemProps) {
  return (
    <div className="card bg-base-200">
      <div className="card-body p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{room.name}</h3>
              <span
                className={`badge badge-sm ${room.roomType === "perform" ? "badge-primary" : "badge-secondary"}`}
              >
                {room.roomType === "perform" ? "Perform" : "Arrange"}
              </span>
              {room.isPrivate && (
                <span className="badge badge-warning badge-sm">Private</span>
              )}
              {room.isHidden && (
                <span className="badge badge-neutral badge-sm">Hidden</span>
              )}
            </div>
            {room.description && (
              <p className="text-sm text-base-content/80 mt-1">
                {room.description}
              </p>
            )}
            <p className="text-xs text-base-content/70 mt-1">
              {room.userCount} member{room.userCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-xs text-base-content/70">Join as:</span>
            <button
              onClick={() => onJoinRoom(room.id, "band_member")}
              className="btn btn-xs btn-primary"
              disabled={
                isConnecting || connectionState === ConnectionState.REQUESTING
              }
            >
              Band Member
            </button>
            {room.roomType === "perform" && (
              <button
                onClick={() => onJoinRoom(room.id, "audience")}
                className="btn btn-xs btn-outline"
                disabled={
                  isConnecting || connectionState === ConnectionState.REQUESTING
                }
              >
                Audience
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
