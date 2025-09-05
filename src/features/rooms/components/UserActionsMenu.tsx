import { useRef, useState } from "react";
import AnchoredPopup from "@/features/ui/components/shared/AnchoredPopup";
import type { RoomUser } from "@/shared/types";

interface UserActionsMenuProps {
  user: RoomUser;
  currentUserRole: string;
  onSwapInstrument: (targetUserId: string) => void;
  onKickUser: (targetUserId: string) => void;
}

export default function UserActionsMenu({
  user,
  currentUserRole,
  onSwapInstrument,
  onKickUser,
}: UserActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const canKick = currentUserRole === "room_owner" && user.role !== "room_owner";
  const canSwap = user.role !== "audience"; // Can swap with band members and room owner

  const handleSwapClick = () => {
    onSwapInstrument(user.id);
    setIsOpen(false);
  };

  const handleKickClick = () => {
    onKickUser(user.id);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-xs p-1 min-h-0 h-6 w-6 text-base-content/60 hover:text-base-content hover:bg-base-300"
        title="User actions"
      >
        ⋯
      </button>

      <AnchoredPopup
        open={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={anchorRef}
        placement="bottom"
        className="min-w-40"
      >
        <div className="p-2">
          {canSwap && (
            <button
              onClick={handleSwapClick}
              className="w-full text-left px-3 py-2 text-sm rounded hover:bg-base-200 flex items-center gap-2"
            >
              🔄 Swap Instrument
            </button>
          )}
          {canKick && (
            <button
              onClick={handleKickClick}
              className="w-full text-left px-3 py-2 text-sm rounded hover:bg-error hover:text-error-content flex items-center gap-2 text-error"
            >
              🚫 Kick Out
            </button>
          )}
          {!canSwap && !canKick && (
            <div className="px-3 py-2 text-sm text-base-content/50">
              No actions available
            </div>
          )}
        </div>
      </AnchoredPopup>
    </>
  );
} 