import { Modal } from "@/features/ui";

interface KickedModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function KickedModal({ open, onClose, reason }: KickedModalProps) {
  return (
    <Modal
      open={open}
      setOpen={onClose}
      title="Removed from Room"
      showCancelButton={false}
      okText="OK"
      onOk={onClose}
      allowClose={true}
      size="md"
    >
      <p className="text-base-content/70">{reason}</p>
    </Modal>
  );
}
