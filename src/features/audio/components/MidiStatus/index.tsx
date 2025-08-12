import type { MidiDevice } from "../../hooks/useMidiController";
import AnchoredPopup from "@/features/ui/components/shared/AnchoredPopup";
import { useState, useEffect, useRef, useCallback } from "react";

interface MidiStatusProps {
  isConnected: boolean;
  getMidiInputs: () => MidiDevice[];
  onRequestAccess: () => Promise<boolean>;
  connectionError?: string | null;
  isRequesting?: boolean;
  refreshMidiDevices?: () => boolean; // Optional refresh function
}

export default function MidiStatus({
  isConnected,
  getMidiInputs,
  onRequestAccess,
  connectionError,
  isRequesting = false,
  refreshMidiDevices,
}: MidiStatusProps) {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Update devices when connection state changes
  useEffect(() => {
    const updateDeviceList = () => {
      if (isConnected) {
        const currentDevices = getMidiInputs();
        setDevices(currentDevices);
      } else {
        setDevices([]);
      }
    };

    updateDeviceList();
  }, [isConnected, getMidiInputs]);

  const handleRequestAccess = async () => {
    try {
      const success = await onRequestAccess();
      if (success) {
        // Refresh device list after successful connection
        const updatedDevices = getMidiInputs();
        setDevices(updatedDevices);
      }
    } catch (error) {
      console.error("Failed to request MIDI access:", error);
    }
  };

  const handleRefreshDevices = () => {
    if (refreshMidiDevices) {
      const hasDevices = refreshMidiDevices();
      const updatedDevices = getMidiInputs();
      setDevices(updatedDevices);

      if (!hasDevices && updatedDevices.length === 0) {
        console.log("No MIDI devices found after refresh");
      }
    }
  };

  const togglePopup = useCallback(() => {
    setIsPopupOpen((prev) => !prev);
  }, []);

  const closePopup = useCallback(() => {
    setIsPopupOpen(false);
  }, []);

  const getStatusBadge = () => {
    if (isConnected && devices.length > 0) return "status-success";
    if (connectionError) return "status-error";
    if (isRequesting) return "status-warning";
    if (isConnected && devices.length === 0) return "status-warning"; // Connected but no devices
    return "status-neutral";
  };

  // const getStatusText = () => {
  //   if (isConnected && devices.length > 0) return `${devices.length} device(s)`;
  //   if (isConnected && devices.length === 0) return "No devices";
  //   return "Disconnected";
  // };

  return (
    <div className="card bg-base-100 shadow-lg">
      <div className="card-body p-3 flex flex-col justify-center items-center">
        <div
          ref={buttonRef}
          className="flex items-center gap-2 cursor-pointer"
          onClick={togglePopup}
        >
          <span className="text-xs">MIDI</span>
          <div className={`status ${getStatusBadge()}`}></div>
          {/* <span className="text-xs text-base-content/70">{getStatusText()}</span> */}
        </div>

        {/* Popup for connected state */}
        {isConnected && (
          <AnchoredPopup
            open={isPopupOpen && isConnected}
            onClose={closePopup}
            anchorRef={buttonRef}
            placement="bottom"
            className="w-80"
          >
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-base-content">
                    Connected Devices:
                  </h4>
                  {refreshMidiDevices && (
                    <button
                      onClick={handleRefreshDevices}
                      className="btn btn-xs btn-ghost"
                      title="Refresh device list"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}
                </div>

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
                  <div className="text-center py-4">
                    <p className="text-sm text-base-content/70 mb-2">
                      MIDI access granted but no devices detected
                    </p>
                    <p className="text-xs text-base-content/50">
                      Try connecting a device and clicking refresh
                    </p>
                  </div>
                )}

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
          </AnchoredPopup>
        )}

        {/* Popup for disconnected state */}
        {!isConnected && (
          <AnchoredPopup
            open={isPopupOpen && !isConnected}
            onClose={closePopup}
            anchorRef={buttonRef}
            placement="bottom"
            className="w-64"
          >
            <div className="p-4">
              <div className="space-y-3">
                <p className="text-sm text-base-content/70">
                  Connect a MIDI controller to use physical keys and controls
                </p>

                {connectionError && (
                  <div className="alert alert-error">
                    <span className="text-sm">{connectionError}</span>
                  </div>
                )}

                {typeof navigator.requestMIDIAccess === "function" && (
                  <button
                    onClick={handleRequestAccess}
                    disabled={isRequesting}
                    className="btn btn-primary btn-sm w-full"
                  >
                    {isRequesting ? (
                      <>
                        <span className="loading loading-spinner mx-auto loading-xs"></span>
                        Requesting...
                      </>
                    ) : (
                      "Connect MIDI Device"
                    )}
                  </button>
                )}

                {typeof navigator.requestMIDIAccess !== "function" && (
                  <div className="alert alert-warning">
                    <span className="text-xs">
                      Web MIDI API not supported in this browser
                    </span>
                  </div>
                )}
              </div>
            </div>
          </AnchoredPopup>
        )}
      </div>
    </div>
  );
}
