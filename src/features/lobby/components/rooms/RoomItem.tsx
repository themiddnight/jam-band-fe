import { ConnectionState } from "@/features/audio/types/connectionState";
import { useNavigate } from "react-router-dom";

interface RoomItemProps {
  room: {
    id: string;
    name: string;
    roomType: "perform" | "arrange";
    description?: string;
    isPrivate: boolean;
    isHidden: boolean;
    userCount: number;
    isBroadcasting?: boolean;
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
  const navigate = useNavigate();

  const handleAudienceJoin = () => {
    if (room.isBroadcasting) {
      // Navigate to dedicated audience room for HLS streaming
      navigate(`/perform/${room.id}/audience`);
    } else {
      // Show tooltip or message that broadcast is not active
      // For now, just disable the button
    }
  };

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
              {/* {room.roomType === "perform" && room.isBroadcasting && (
                <span className="badge badge-success badge-sm animate-pulse">LIVE</span>
              )} */}
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
              <div className="tooltip" data-tip={room.isBroadcasting ? "Join as audience" : "Broadcast not active"}>
                <button
                  onClick={handleAudienceJoin}
                  className={`btn btn-xs ${room.isBroadcasting ? "btn-success" : "btn-outline btn-disabled"}`}
                  disabled={
                    !room.isBroadcasting ||
                    isConnecting || 
                    connectionState === ConnectionState.REQUESTING
                  }
                >
                  Audience
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
