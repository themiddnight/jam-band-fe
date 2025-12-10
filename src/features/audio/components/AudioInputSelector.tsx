import React, { useEffect } from 'react';
import { useAudioDevices } from '@/features/audio/hooks/useAudioDevices';

interface AudioInputSelectorProps {
  value: string | null;
  onChange: (deviceId: string) => void;
  className?: string;
  showLabel?: boolean;
}

export const AudioInputSelector: React.FC<AudioInputSelectorProps> = ({
  value,
  onChange,
  className = '',
  showLabel = true,
}) => {
  const { inputDevices, permissionGranted, requestAccess, refreshDevices } = useAudioDevices();

  // Debug logging
  // Auto-select first device if no device is selected, or if selected device is removed
  useEffect(() => {
    if (!permissionGranted || inputDevices.length === 0) {
      return;
    }

    // Check if current value exists in the device list
    const currentDeviceExists = value && inputDevices.some(d => d.deviceId === value);

    if (!currentDeviceExists) {
      // Selected device was removed (unplugged) or no device selected yet
      // Auto-select the first available device
      const firstDevice = inputDevices[0];
      onChange(firstDevice.deviceId);
    }
  }, [inputDevices, value, onChange, permissionGranted]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    onChange(newDeviceId);
  };

  if (!permissionGranted) {
    return (
      <div className={`form-control ${className}`}>
        {showLabel && (
          <label className="label text-xs">
            <span className="label-text">Audio Input</span>
          </label>
        )}
        <button
          onClick={() => requestAccess().then(() => refreshDevices())}
          className="btn btn-sm btn-warning btn-outline"
        >
          Enable Microphone Access
        </button>
      </div>
    );
  }

  return (
    <div className={`form-control ${className}`}>
      {showLabel && (
        <label className="label text-xs">
          <span className="label-text">Audio Input</span>
        </label>
      )}
      <select
        className="select select-bordered select-xs w-full max-w-xs"
        value={value || ''}
        onChange={handleChange}
        disabled={inputDevices.length === 0}
      >
        <option value="" disabled>Select Input Device</option>
        {inputDevices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
        {inputDevices.length === 0 && (
          <option value="" disabled>No input devices found</option>
        )}
      </select>
    </div>
  );
};
