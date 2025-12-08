import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { useUserStore } from "../shared/stores/userStore";

export default function Register() {
  const navigate = useNavigate();
  const { register, loginWithGoogle, loading, error, clearError } = useAuth();
  const { isAuthenticated } = useUserStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccess(false);
    const result = await register({ email, password, username });
    if (result.success) {
      setSuccess(true);
    }
  };

  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center p-2 sm:p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md p-2 sm:p-4">
          <p className="text-xl font-bold mb-5">Registration Successful!</p>
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-full border p-2 sm:p-4">
            <div className="alert alert-info">
              <span>
                Please check your email to verify your account before logging in.
              </span>
            </div>
            <Link to="/login" className="btn btn-neutral mt-4 w-full">
              Go to Login
            </Link>
          </fieldset>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base-200 flex items-center justify-center p-2 sm:p-4">
      <div className="card bg-base-100 shadow-xl w-full max-w-md p-2 sm:p-4">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <p className="text-xl font-bold mb-5">Sign Up</p>
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
                minLength={8}
                disabled={loading}
              />
              <label className="label">
                <span className="label-text-alt">
                  Must be at least 8 characters
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <label className="label">Username</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={30}
                disabled={loading}
              />
              <label className="label">
                <span className="label-text-alt">
                  Must be 3-30 characters
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary mt-2 w-full"
              disabled={loading}
            >
              {loading ? "Registering..." : "Sign Up"}
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
          <div className="text-sm mt-2">
            Already have an account?{" "}
            <Link to="/login" className="link link-primary">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

