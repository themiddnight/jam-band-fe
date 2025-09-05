import type { RoomUser } from "@/shared/types";

interface PendingSwapStatusProps {
  targetUser: RoomUser | null;
  onCancel: () => void;
}

export default function PendingSwapStatus({
  targetUser,
  onCancel,
}: PendingSwapStatusProps) {
  if (!targetUser) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-warning animate-pulse">
        🔄 Pending swap with {targetUser.username}
      </span>
      <button
        onClick={onCancel}
        className="btn btn-ghost btn-xs text-error hover:bg-error/20"
        title="Cancel swap request"
      >
        ✕
      </button>
    </div>
  );
} 