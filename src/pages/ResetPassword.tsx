import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword, loading, error } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      navigate("/forgot-password");
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return;
    }
    if (!token) return;

    const result = await resetPassword(token, password);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <h2 className="card-title text-2xl justify-center mb-4 text-success">
              Password Reset Successful!
            </h2>
            <p>Your password has been reset successfully.</p>
            <p className="text-sm text-base-content/70">
              Redirecting to login...
            </p>
            <Link to="/login" className="btn btn-primary mt-4">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body">
          <h2 className="card-title text-2xl justify-center mb-4">
            Reset Password
          </h2>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {password && confirmPassword && password !== confirmPassword && (
            <div className="alert alert-warning">
              <span>Passwords do not match</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">New Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
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

            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
              />
            </div>

            <div className="form-control mt-6">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || password !== confirmPassword}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </form>

          <div className="text-center mt-4">
            <Link to="/login" className="link link-primary">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

