import { useState, useCallback } from "react";

interface InstrumentMuteProps {
  /** Whether the instrument is currently muted (local only) */
  isMuted: boolean;
  /** Callback when mute state changes */
  onMuteChange: (muted: boolean) => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * Component for controlling virtual instrument mute/unmute state.
 * When muted: instrument plays locally only, no socket messages sent
 * When unmuted: instrument broadcasts to other players in the room
 */
export const InstrumentMute = ({
  isMuted,
  onMuteChange,
  className = "",
}: InstrumentMuteProps) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = useCallback(async () => {
    if (isToggling) return;
    
    setIsToggling(true);
    try {
      onMuteChange(!isMuted);
    } finally {
      // Small delay to prevent rapid clicking
      setTimeout(() => setIsToggling(false), 100);
    }
  }, [isMuted, onMuteChange, isToggling]);

  return (
    <div className={`card bg-base-100 shadow-lg grow ${className}`}>
      <div className="card-body p-3">
        <div className="flex flex-wrap justify-center items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="label">
              <span className="label-text text-xs">Instrument</span>
            </label>
            {/* Status indicator */}
            <div
              className={`w-2 h-2 rounded-full ${
                isMuted ? "bg-warning" : "bg-success"
              }`}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Mute/Unmute Toggle */}
            <button
              onClick={handleToggle}
              disabled={isToggling}
              className={`btn btn-sm ${
                isMuted 
                  ? "btn-warning" 
                  : "btn-success"
              } ${isToggling ? "loading" : ""}`}
              title={
                isMuted 
                  ? "Instrument is muted (local only) - Click to unmute and broadcast to room" 
                  : "Instrument is broadcasting to room - Click to mute (local only)"
              }
            >
              {isToggling ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <>
                  {isMuted ? "🎧" : "🔊"}
                  <span className="hidden sm:inline ml-1">
                    {isMuted ? "Practice" : "Live"}
                  </span>
                </>
              )}
            </button>

            {/* Status text */}
            {/* <span className={`text-xs hidden lg:inline font-medium ${
              isMuted 
                ? "text-warning" 
                : "text-success"
            }`}>
              {isMuted ? "Practice Mode" : "Broadcasting"}
            </span> */}
          </div>
        </div>
      </div>
    </div>
  );
};