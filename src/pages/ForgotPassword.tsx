import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";

export default function ForgotPassword() {
  const { forgotPassword, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    const result = await forgotPassword(email);
    if (result.success) {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center p-2 sm:p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md p-2 sm:p-4">
          <p className="text-xl font-bold mb-5">Check Your Email</p>
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-full border p-2 sm:p-4">
            <div className="alert alert-info">
              <span>
                If an account exists with this email, a password reset link has
                been sent.
              </span>
            </div>
            <Link to="/login" className="btn btn-neutral mt-4 w-full">
              Back to Login
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

        <p className="text-xl font-bold mb-5">Forgot Password</p>
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

            <button
              type="submit"
              className="btn btn-primary mt-2 w-full"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        </fieldset>

        <div className="text-center space-y-3 mt-2">
          <Link to="/login" className="link link-primary text-sm">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

