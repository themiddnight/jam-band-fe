import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification, loading, error } = useAuth();
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      handleVerify(token);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleVerify = async (token: string) => {
    const result = await verifyEmail(token);
    if (result.success) {
      setVerified(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    }
  };

  const handleResend = async () => {
    setResending(true);
    await resendVerification();
    setResending(false);
  };

  if (verified) {
    return (
      <div className="min-h-dvh bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <h2 className="card-title text-2xl justify-center mb-4 text-success">
              Email Verified!
            </h2>
            <p>Your email has been successfully verified.</p>
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
            Verify Email
          </h2>

          {loading && (
            <div className="flex justify-center">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-4">
              <p>Verifying your email address...</p>
              <div className="text-center">
                <button
                  onClick={handleResend}
                  className="btn btn-outline"
                  disabled={resending}
                >
                  {resending ? "Sending..." : "Resend Verification Email"}
                </button>
              </div>
              <div className="text-center">
                <Link to="/login" className="link link-primary">
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

