import { Modal } from "@/features/ui";

interface UsernameModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  username: string | null;
  tempUsername: string;
  onTempUsernameChange: (value: string) => void;
}

export function UsernameModal({
  open,
  onClose,
  onSubmit,
  username,
  tempUsername,
  onTempUsernameChange,
}: UsernameModalProps) {
  return (
    <Modal
      open={open}
      setOpen={onClose}
      title={username ? "Change Username" : "Welcome to COLLAB!"}
      onCancel={onClose}
      onOk={onSubmit}
      okText={username ? "Update" : "Continue"}
      cancelText="Cancel"
      showOkButton={!!tempUsername.trim()}
      showCancelButton={!!username}
      allowClose={!!username || !!tempUsername.trim()}
    >
      <div className="space-y-4">
        {!username && (
          <>
            <p className="text-base-content/70 mb-0">
              Please enter your username to continue
            </p>
            <p className="text-base-content/30 text-xs">
              We don't store your username—it's only saved in your browser.
            </p>
          </>
        )}
        <div className="form-control">
          <label className="label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            placeholder="Enter your username"
            className="input input-bordered w-full"
            value={tempUsername}
            onChange={(e) => onTempUsernameChange(e.target.value)}
            autoFocus
            required
            onKeyDown={(e) => {
              if (e.key === "Enter" && tempUsername.trim()) {
                onSubmit();
              }
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
