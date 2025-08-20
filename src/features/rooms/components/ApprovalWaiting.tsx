import { useCallback } from "react";
import { ConnectionState } from "@/features/audio/types/connectionState";

interface ApprovalWaitingProps {
  connectionState: ConnectionState;
  onCancel: () => void;
  roomName?: string;
}

/**
 * Component for displaying approval waiting state with cancellation option
 */
export const ApprovalWaiting: React.FC<ApprovalWaitingProps> = ({
  connectionState,
  onCancel,
  roomName
}) => {
  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  if (connectionState !== ConnectionState.REQUESTING) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body text-center flex flex-col items-center justify-center">
          <h2 className="card-title justify-center text-xl">
            Waiting for Approval
          </h2>
          <p className="text-base-content/70 mb-4">
            Your request to join {roomName ? `"${roomName}"` : "the room"} as a band member is pending approval from the room owner.
          </p>
          <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
          <div className="card-actions justify-center mt-4">
            <button 
              onClick={handleCancel} 
              className="btn btn-outline"
              title="Cancel your join request and return to lobby"
            >
              Cancel Request
            </button>
          </div>
          <div className="text-xs text-base-content/50 mt-2">
            Request will timeout automatically after 30 seconds
          </div>
        </div>
      </div>
    </div>
  );
};