import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUserStore } from "../shared/stores/userStore";
import { useAuth } from "../shared/hooks/useAuth";

export default function AccountSettings() {
  const navigate = useNavigate();
  const { authUser, isAuthenticated, logout } = useUserStore();
  const { resendVerification, loading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login?redirect=/account");
      return;
    }

    if (authUser) {
      setUsername(authUser.username || "");
      setEmail(authUser.email || "");
    }
  }, [isAuthenticated, authUser, navigate]);

  const handleResendVerification = async () => {
    await resendVerification();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (!isAuthenticated || !authUser) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-base-200 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Account Settings</h2>

            {/* Profile Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Profile</h3>
                <div className="space-y-2">
                  <div>
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <input
                      type="email"
                      className="input input-bordered w-full"
                      value={email}
                      disabled
                    />
                    {!authUser.emailVerified && (
                      <div className="alert alert-warning mt-2">
                        <span>Email not verified</span>
                        <button
                          onClick={handleResendVerification}
                          className="btn btn-sm btn-outline"
                          disabled={loading}
                        >
                          Resend Verification
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">Username</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={username}
                      disabled
                    />
                    <label className="label">
                      <span className="label-text-alt">
                        Username changes coming soon
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="divider"></div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Password</h3>
                <Link to="/forgot-password" className="btn btn-outline">
                  Change Password
                </Link>
              </div>

              {/* App Settings Section */}
              <div className="divider"></div>
              <div>
                <h3 className="text-lg font-semibold mb-2">App Settings</h3>
                <p className="text-sm text-base-content/70">
                  App settings and preferences will be available here in the
                  future.
                </p>
              </div>

              {/* Logout */}
              <div className="divider"></div>
              <div>
                <button
                  onClick={handleLogout}
                  className="btn btn-error btn-outline"
                >
                  Logout
                </button>
              </div>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="card-actions justify-end mt-4">
              <Link to="/" className="btn btn-ghost">
                Back to Lobby
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

