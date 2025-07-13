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
    <div className="bg-white p-3 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">MIDI Controller</h3>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {!isConnected && (
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-3">
            Connect a MIDI controller to use physical keys and controls
          </p>
          <button
            onClick={handleRequestAccess}
            disabled={isRequesting}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isRequesting ? 'Requesting...' : 'Connect MIDI Device'}
          </button>
        </div>
      )}

      {isConnected && devices.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Connected Devices:</p>
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
      )}

      {isConnected && devices.length === 0 && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            No MIDI devices detected. Please connect a MIDI controller.
          </p>
        </div>
      )}

      {isConnected && (
        <div className="mt-3 p-2 bg-blue-50 rounded">
          <p className="text-xs text-blue-800">
            <strong>Supported Controls:</strong><br />
            • Piano keys for note input<br />
            • Sustain pedal (CC 64)<br />
            • Control knobs/sliders (CC messages)<br />
            • Pitch bend wheel
          </p>
        </div>
      )}
    </div>
  );
} 