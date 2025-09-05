import { Modal } from "@/features/ui/components/shared/Modal";
import type { RoomUser } from "@/shared/types";

interface KickUserModalProps {
  open: boolean;
  onClose: () => void;
  targetUser: RoomUser | null;
  onConfirm: () => void;
}

export default function KickUserModal({
  open,
  onClose,
  targetUser,
  onConfirm,
}: KickUserModalProps) {
  if (!targetUser) return null;

  return (
    <Modal
      open={open}
      setOpen={(open) => !open && onClose()}
      title="Kick User"
      showOkButton={true}
      showCancelButton={true}
      okText="Kick Out"
      cancelText="Cancel"
      onOk={onConfirm}
      onCancel={onClose}
      allowClose={true}
    >
      <div className="space-y-4">
        <p className="text-base-content">
          Are you sure you want to kick <strong>{targetUser.username}</strong> from the room?
        </p>
        
        <div className="bg-warning/10 border border-warning/20 p-3 rounded-lg">
          <p className="text-sm text-warning-content">
            ⚠️ This will remove them from the room immediately. They can rejoin if they want.
          </p>
        </div>
        
        <p className="text-sm text-base-content/60">
          This action will redirect them to the lobby.
        </p>
      </div>
    </Modal>
  );
} 