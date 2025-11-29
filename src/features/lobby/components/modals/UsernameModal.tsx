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
      title={username ? "Change Username" : "Welcome to COLLAB! 👋"}
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
            <div className="flex gap-2 bg-base-300 p-3 rounded">
              🌟
              <div className="flex flex-col gap-3">
                <p className="text-xs font-light">This is an early-stage PoC project designed for musicians and producers to collaborate. Please note that it may contain bugs and limitations. To improve performance and stability (especially latency), we collect non-personally identifiable technical usage data (e.g., latency metrics, session duration, room usage statistics). This data will not be linked to your username.</p>
                <p className="text-xs font-light opacity-50">นี่คือโปรเจกต์ Proof of Concept (PoC) ที่กำลังพัฒนาเพื่อให้นักดนตรี/โปรดิวเซอร์ได้ทำเพลงร่วมกัน อาจมีบั๊กและข้อบกพร่อง เราจะเก็บข้อมูลการใช้งานทางเทคนิค (เช่น Latency และสถิติการใช้ห้อง) เพื่อปรับปรุงแอปฯ ข้อมูลเหล่านี้ไม่ระบุตัวตนและจะไม่เชื่อมโยงกับ Username ของคุณ</p>
              </div>
            </div>
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
