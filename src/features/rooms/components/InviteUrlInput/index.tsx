import { useInviteUrl } from "../../hooks/useInviteUrl";

interface InviteUrlInputProps {
  className?: string;
}

export const InviteUrlInput = ({ className = "" }: InviteUrlInputProps) => {
  const {
    inviteUrl,
    isValidating,
    error,
    handleSubmit,
    handleInputChange,
    handlePaste,
  } = useInviteUrl();

  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        <h3 className="card-title text-lg">Join with Invite URL</h3>
        <p className="text-sm text-base-content/70">
          Paste an invite URL to join a specific room
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <div className="join w-full">
              <input
                type="text"
                placeholder="Paste invite URL..."
                className={`input input-bordered join-item flex-1 ${
                  error ? "input-error" : ""
                }`}
                value={inviteUrl}
                onChange={handleInputChange}
                disabled={isValidating}
              />
              <button
                type="button"
                onClick={handlePaste}
                className="btn btn-soft join-item"
                disabled={isValidating}
                title="Paste from clipboard"
              >
                📋
              </button>
              <button
                type="submit"
                className="btn btn-primary join-item"
                disabled={isValidating}
              >
                {isValidating ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Go"
                )}
              </button>
            </div>
            {error && (
              <label className="label">
                <span className="label-text-alt text-error">{error}</span>
              </label>
            )}
          </div>
        </form>
        
        {/* <div className="text-xs text-base-content/50 mt-2">
          <p>Supported formats:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Full URL: https://domain.com/invite/roomId</li>
            <li>Path: /invite/roomId or /room/roomId</li>
            <li>Room ID: roomId</li>
          </ul>
        </div> */}
      </div>
    </div>
  );
};