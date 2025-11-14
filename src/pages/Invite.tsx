import { useUserStore } from "../shared/stores/userStore";
import { useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";

export default function Invite() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { username, userId } = useUserStore();

  useEffect(() => {
    if (!roomId) {
      navigate("/");
      return;
    }

    // Get role and room type from query parameters
    const role = searchParams.get("role");
    const roomType = searchParams.get("roomType");

    // Validate role parameter
    if (!role || !["band_member", "audience"].includes(role)) {
      // Default to audience if no valid role specified
      console.log(
        `🎭 Invalid role parameter "${role}", defaulting to audience`,
      );
      // Default to perform room if no room type specified
      const roomPath = roomType === "arrange" ? "arrange" : "perform";
      navigate(`/${roomPath}/${roomId}`, { state: { role: "audience" } });
      return;
    }

    

    // Ensure user has username set
    if (!username || !userId) {
      // Store the intended destination in sessionStorage and redirect to lobby
      sessionStorage.setItem(
        "pendingInvite",
        JSON.stringify({
          roomId,
          role: role as "band_member" | "audience",
        }),
      );
      navigate("/");
      return;
    }

    // Redirect to room with specified role and type
    const roomPath = roomType === "arrange" ? "arrange" : "perform";
    navigate(`/${roomPath}/${roomId}`, {
      state: { role: role as "band_member" | "audience" },
    });
  }, [roomId, searchParams, navigate, username, userId]);

  // Show loading while redirecting
  return (
    <div className="min-h-dvh bg-base-200 flex items-center justify-center">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body text-center">
          <h2 className="card-title justify-center text-xl">Joining Room...</h2>
          <p className="text-base-content/70 mb-4">
            Redirecting you to the jam session...
          </p>
          <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
        </div>
      </div>
    </div>
  );
}
