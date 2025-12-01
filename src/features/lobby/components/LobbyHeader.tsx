import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/shared/stores/userStore";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { PingDisplay, usePingMeasurement } from "@/features/audio";
import type { Socket } from "socket.io-client";

interface LobbyHeaderProps {
  connectionState: ConnectionState;
  isConnecting: boolean;
  isConnected: boolean;
  activeSocket: Socket | null;
  onGuestButtonClick: () => void;
}

export function LobbyHeader({
  connectionState,
  isConnecting,
  isConnected,
  activeSocket,
  onGuestButtonClick,
}: LobbyHeaderProps) {
  const navigate = useNavigate();
  const { isAuthenticated, username } = useUserStore();
  const { currentPing } = usePingMeasurement({
    socket: activeSocket,
    enabled: isConnected,
  });

  return (
    <div className="flex justify-between items-center mb-3">
      <h1 className="text-4xl font-bold text-primary">collab</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              connectionState === ConnectionState.LOBBY
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
        {isAuthenticated ? (
          <button
            onClick={() => navigate("/account")}
            className="btn btn-sm btn-primary"
            title="Account Settings"
          >
            {username || "Account"} ⚙️
          </button>
        ) : (
          <button
            onClick={onGuestButtonClick}
            className="btn btn-sm btn-outline"
            title="Click to login or continue as guest"
          >
            Guest - {username || "User"}
          </button>
        )}
      </div>
    </div>
  );
}

