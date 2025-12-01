import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserStore } from "../shared/stores/userStore";
import { getCurrentUser, setToken } from "../shared/api/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useUserStore();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setToken(token);
      getCurrentUser()
        .then((result) => {
          login(result.user, token);
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

