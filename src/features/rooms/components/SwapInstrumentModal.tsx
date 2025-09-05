import { Modal } from "@/features/ui/components/shared/Modal";
import type { RoomUser } from "@/shared/types";

interface SwapInstrumentModalProps {
  open: boolean;
  onClose: () => void;
  requesterUser: RoomUser | null;
  onApprove: () => void;
  onReject: () => void;
}

export default function SwapInstrumentModal({
  open,
  onClose,
  requesterUser,
  onApprove,
  onReject,
}: SwapInstrumentModalProps) {
  if (!requesterUser) return null;

  return (
    <Modal
      open={open}
      setOpen={(open) => !open && onClose()}
      title="Instrument Swap Request"
      showOkButton={true}
      showCancelButton={true}
      okText="Accept"
      cancelText="Reject"
      onOk={onApprove}
      onCancel={onReject}
      allowClose={true}
    >
      <div className="space-y-4">
        <p className="text-base-content">
          <strong>{requesterUser.username}</strong> wants to swap instruments with you.
        </p>
        
        <div className="bg-base-200 p-3 rounded-lg space-y-2">
          <p className="text-sm">
            <strong>Their instrument:</strong> {requesterUser.currentInstrument?.replace(/_/g, " ") || "None"}
          </p>
          <p className="text-sm text-base-content/70">
            This will exchange your current instrument, sequencer patterns, and settings.
          </p>
        </div>
        
        <p className="text-sm text-base-content/60">
          Do you want to accept this swap?
        </p>
      </div>
    </Modal>
  );
} 