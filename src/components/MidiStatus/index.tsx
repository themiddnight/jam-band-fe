import { useState, useEffect } from "react";

interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string | null;
  state: string;
}

interface MidiStatusProps {
  isConnected: boolean;
  getMidiInputs: () => MidiDevice[];
  onRequestAccess: () => Promise<boolean>;
  connectionError?: string | null;
  isRequesting?: boolean;
}

export default function MidiStatus({
  isConnected,
  getMidiInputs,
  onRequestAccess,
  connectionError,
  isRequesting = false,
}: MidiStatusProps) {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipTimeout, setTooltipTimeout] = useState<number | null>(null);

  useEffect(() => {
    if (isConnected) {
      setDevices(getMidiInputs());
    } else {
      setDevices([]);
    }
  }, [isConnected, getMidiInputs]);

  const handleRequestAccess = async () => {
    try {
      const success = await onRequestAccess();
      if (success) {
        // Refresh device list
        setDevices(getMidiInputs());
      }
    } catch (error) {
      console.error("Failed to request MIDI access:", error);
    }
  };

  const handleMouseEnter = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      setTooltipTimeout(null);
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowTooltip(false);
    }, 300); // 300ms delay before hiding
    setTooltipTimeout(timeout);
  };

  const getStatusBadge = () => {
    if (isConnected) return "status-success";
    if (connectionError) return "status-error";
    if (isRequesting) return "status-warning";
    return "status-neutral";
  };

  return (
    <div className="card bg-base-100 shadow-lg">
      <div className="card-body p-3 flex flex-col justify-center items-center">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <span className="text-xs">MIDI</span>
          <div className={`status ${getStatusBadge()}`}></div>
        </div>

        {/* Tooltip for connected state */}
        {showTooltip && isConnected && (
          <div
            className="absolute top-full left-0 mt-2 w-80 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50 p-4"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-base-content mb-2">
                  Connected Devices:
                </h4>
                {devices.length > 0 ? (
                  <div className="space-y-2">
                    {devices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-2 bg-base-200 rounded"
                      >
                        <div>
                          <p className="text-sm font-medium text-base-content">
                            {device.name}
                          </p>
                          {device.manufacturer && (
                            <p className="text-xs text-base-content/70">
                              {device.manufacturer}
                            </p>
                          )}
                        </div>
                        <div
                          className={`badge badge-xs ${
                            device.state === "connected"
                              ? "badge-success"
                              : "badge-error"
                          }`}
                        >
                          {device.state}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-base-content/70">
                    No MIDI devices detected
                  </p>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-base-content mb-2">
                  Supported Controls:
                </h4>
                <ul className="text-sm text-base-content/70 space-y-1">
                  <li>• Piano keys for note input</li>
                  <li>• Sustain pedal (CC 64)</li>
                  <li>• Control knobs/sliders (CC messages)</li>
                  <li>• Pitch bend wheel</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tooltip for disconnected state */}
        {showTooltip && !isConnected && (
          <div
            className="absolute top-full left-0 mt-2 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50 p-4 w-64"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="space-y-3">
              <p className="text-sm text-base-content/70">
                Connect a MIDI controller to use physical keys and controls
              </p>

              {connectionError && (
                <div className="alert alert-error">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm">{connectionError}</span>
                </div>
              )}

              <button
                onClick={handleRequestAccess}
                disabled={isRequesting}
                className="btn btn-primary btn-sm w-full"
              >
                {isRequesting ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Requesting...
                  </>
                ) : (
                  "Connect MIDI Device"
                )}
              </button>

              {!navigator.requestMIDIAccess && (
                <div className="alert alert-warning">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <span className="text-xs">
                    Web MIDI API not supported in this browser
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
