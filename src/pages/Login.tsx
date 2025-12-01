import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { useUserStore } from "../shared/stores/userStore";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle, loading, error, clearError } = useAuth();
  const { isAuthenticated } = useUserStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get("redirect") || "/";
      navigate(redirect);
    }
  }, [isAuthenticated, navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const result = await login({ email, password });
    if (result.success) {
      const redirect = searchParams.get("redirect") || "/";
      navigate(redirect);
    }
  };

  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  return (
    <div className="min-h-dvh bg-base-200 flex items-center justify-center p-2 sm:p-4">      
      <div className="card bg-base-100 shadow-xl w-full max-w-md p-2 sm:p-4">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <p className="text-xl font-bold mb-5">Login</p>
        <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-full border p-2 sm:p-4">

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="label">Email</label>
              <input
                type="email"
                className="input w-full"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="label">Password</label>
              <input
                type="password"
                className="input w-full"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-neutral mt-2 w-full"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </fieldset>

        <div className="divider">OR</div>

        <button
          onClick={handleGoogleLogin}
          className="btn btn-outline w-full"
          disabled={loading}
        >
          Continue with Google
        </button>

        <div className="text-center space-y-3 mt-2">
          <Link to="/forgot-password" className="link link-primary text-sm">
            Forgot password?
          </Link>
          <div className="text-sm mt-2">
            Don't have an account?{" "}
            <Link to="/register" className="link link-primary">
              Sign up
            </Link>
          </div>
          <div className="text-sm">
            <Link to="/" className="link link-secondary">
              Continue as Guest
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

