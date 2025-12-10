import { useState, useEffect, useCallback } from 'react';

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  groupId: string;
}

export const useAudioDevices = () => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const getDevices = useCallback(async () => {
    try {
      // Check if we have permission first
      // We can't query permission status directly for microphone in all browsers,
      // but listing devices usually returns empty labels if permission isn't granted.
      if (!navigator.mediaDevices?.enumerateDevices) {
        console.warn('Media devices API not available');
        setDevices([]);
        return;
      }

      const deviceInfos = await navigator.mediaDevices.enumerateDevices();

      const formattedDevices: AudioDevice[] = deviceInfos.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `${device.kind} (no label)`,
        kind: device.kind,
        groupId: device.groupId
      }));

      setDevices(formattedDevices);

      // If we have labels, it generally means we have permission
      const hasLabels = deviceInfos.some(d => d.label.length > 0 && d.kind === 'audioinput');
      setPermissionGranted(hasLabels);

    } catch (error) {
      console.error('Error listing audio devices:', error);
    }
  }, []);

  useEffect(() => {
    getDevices();

    // Listen for device changes (plugging/unplugging)
    const handleDeviceChange = () => {
      getDevices();
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    return () => {
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, [getDevices]);

  const requestAccess = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn('getUserMedia API not available');
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, getting permission is enough
      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
      return true; // Success
    } catch (error) {
      console.error('Error requesting audio permission:', error);
      return false; // Failed
    }
  };

  const inputDevices = devices.filter(d => d.kind === 'audioinput');
  const outputDevices = devices.filter(d => d.kind === 'audiooutput');

  return {
    devices,
    inputDevices,
    outputDevices,
    permissionGranted,
    refreshDevices: getDevices,
    requestAccess
  };
};
