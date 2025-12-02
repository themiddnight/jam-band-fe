import { Modal } from "@/features/ui";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/shared/stores/userStore";

interface AuthChoiceModalProps {
  open: boolean;
  onClose: () => void;
  onGuestEnter: () => void;
  allowClose?: boolean; // Allow closing the modal (for guest button click)
}

export function AuthChoiceModal({
  open,
  onClose,
  onGuestEnter,
  allowClose = false,
}: AuthChoiceModalProps) {
  const navigate = useNavigate();
  const { username, userId, userType } = useUserStore();
  // Check if already a guest with existing username and userId
  const isAlreadyGuest = (userType === "GUEST" || !userType) && username && userId;

  const handleLogin = () => {
    navigate("/login");
    onClose();
  };

  const handleSignup = () => {
    navigate("/register");
    onClose();
  };

  const handleGuest = () => {
    // If already a guest with username and userId, just close the modal without creating new guest
    if (isAlreadyGuest) {
      console.log("🎭 Already a guest, keeping existing username and userId:", { username, userId });
      onClose();
      return;
    }
    // Otherwise, create new guest
    onGuestEnter();
    onClose();
  };

  return (
    <Modal
      open={open}
      setOpen={allowClose ? onClose : () => { }} // Allow closing if allowClose is true
      title="Welcome to COLLAB! 👋"
      showOkButton={false}
      showCancelButton={false}
      allowClose={allowClose} // Allow closing if allowClose is true
    >
      <div className="space-y-4">
        <p className="text-base-content/70 mb-4 text-center">
          Please choose how you want to continue
        </p>

        <div className="space-y-3">
          <button
            className="btn btn-primary w-full"
            onClick={handleLogin}
          >
            Login
          </button>

          <button
            className="btn btn-secondary w-full"
            onClick={handleSignup}
          >
            Sign Up
          </button>

          <button
            className="btn btn-outline w-full"
            onClick={handleGuest}
          >
            Enter as Guest
          </button>
        </div>

        <p className="text-base-content/30 text-xs text-center mt-4">
          Guest users have limited features. Sign up to unlock full functionality.
        </p>
      </div>

      <div className="divider"></div>
      
      <div className="flex gap-2 bg-base-300 p-3 rounded">
        🌟
        <div className="flex flex-col gap-3">
          <p className="text-xs font-light">
            This is an early-stage PoC project designed for musicians and producers to collaborate. Please note that it may contain bugs and limitations. To improve performance and stability (especially latency), we collect non-personally identifiable technical usage data (e.g., latency metrics, session duration, room usage statistics). This data will not be linked to your username.
          </p>
          <p className="text-xs font-light opacity-50">
            นี่คือโปรเจกต์ Proof of Concept (PoC) ที่กำลังพัฒนาเพื่อให้นักดนตรี/โปรดิวเซอร์ได้ทำเพลงร่วมกัน อาจมีบั๊กและข้อบกพร่อง เราจะเก็บข้อมูลการใช้งานทางเทคนิค (เช่น Latency และสถิติการใช้ห้อง) เพื่อปรับปรุงแอปฯ ข้อมูลเหล่านี้ไม่ระบุตัวตนและจะไม่เชื่อมโยงกับ Username ของคุณ
          </p>
        </div>
      </div>
    </Modal>
  );
}

