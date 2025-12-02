import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserStore } from "../shared/stores/userStore";
import { getCurrentUser, setToken, setRefreshToken } from "../shared/api/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useUserStore();

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    // Support legacy token parameter for backward compatibility
    const legacyToken = searchParams.get("token");

    if (accessToken && refreshToken) {
      setToken(accessToken);
      setRefreshToken(refreshToken);
      getCurrentUser()
        .then((result) => {
          login(result.user, accessToken);
          navigate("/");
        })
        .catch(() => {
          navigate("/login");
        });
    } else if (legacyToken) {
      // Legacy support: if only token is provided, treat it as accessToken
      setToken(legacyToken);
      getCurrentUser()
        .then((result) => {
          login(result.user, legacyToken);
          navigate("/");
        })
        .catch(() => {
          navigate("/login");
        });
    } else {
      navigate("/login");
    }
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-dvh bg-base-200 flex items-center justify-center">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Completing authentication...</p>
      </div>
    </div>
  );
}

