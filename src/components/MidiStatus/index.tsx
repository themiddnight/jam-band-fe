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
}

export default function MidiStatus({
  isConnected,
  getMidiInputs,
  onRequestAccess,
}: MidiStatusProps) {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setDevices(getMidiInputs());
    } else {
      setDevices([]);
    }
  }, [isConnected, getMidiInputs]);

  const handleRequestAccess = async () => {
    setIsRequesting(true);
    try {
      await onRequestAccess();
    } catch (error) {
      console.error("Failed to request MIDI access:", error);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="flex justify-center items-center gap-3 bg-white p-3 rounded-lg shadow-lg relative">
      <div 
        className="flex items-center gap-2 cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-sm font-medium text-gray-700">MIDI</span>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {/* Tooltip for connected state */}
      {showTooltip && isConnected && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Connected Devices:</h4>
              {devices.length > 0 ? (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {device.name}
                        </p>
                        {device.manufacturer && (
                          <p className="text-xs text-gray-600">
                            {device.manufacturer}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        device.state === 'connected' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {device.state}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No MIDI devices detected</p>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Supported Controls:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
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
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 w-64">
          <p className="text-sm text-gray-600 mb-3">
            Connect a MIDI controller to use physical keys and controls
          </p>
          <button
            onClick={handleRequestAccess}
            disabled={isRequesting}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
          >
            {isRequesting ? 'Requesting...' : 'Connect MIDI Device'}
          </button>
        </div>
      )}
    </div>
  );
} 