import { Modal } from "@/features/ui";

interface WaitingApprovalModalProps {
  open: boolean;
  onCancel: () => void;
}

export function WaitingApprovalModal({
  open,
  onCancel,
}: WaitingApprovalModalProps) {
  return (
    <Modal
      open={open}
      setOpen={() => {}}
      title="Waiting for Approval"
      showOkButton={false}
      showCancelButton={true}
      cancelText="Cancel Request"
      onCancel={onCancel}
      allowClose={false}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-base-content/70">
          Your request to join the private room as a band member is pending
          owner approval.
        </p>
        <div className="flex justify-center">
          <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
        </div>
      </div>
    </Modal>
  );
}
