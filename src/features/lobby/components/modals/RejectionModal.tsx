import { Modal } from "@/features/ui";

interface RejectionModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
}

export function RejectionModal({
  open,
  onClose,
  message,
}: RejectionModalProps) {
  return (
    <Modal
      open={open}
      setOpen={onClose}
      title="Request Rejected"
      onOk={onClose}
      okText="Return to Lobby"
      showCancelButton={false}
    >
      <p className="text-base-content/70">{message}</p>
    </Modal>
  );
}
