import * as Tone from 'tone';

let mediaStream: MediaStream | null = null;
let mediaStreamSource: MediaStreamAudioSourceNode | null = null;
let currentDeviceId: string | undefined = undefined;
let pendingOperation: Promise<MediaStreamAudioSourceNode> | null = null;

/**
 * Get or create a MediaStreamAudioSourceNode for the specified device.
 * Uses raw navigator.mediaDevices.getUserMedia for reliable device switching.
 */
export const getOrCreateUserMedia = async (deviceId?: string): Promise<MediaStreamAudioSourceNode> => {
  const requestedDeviceId = deviceId || undefined;

  // If there's already an operation in progress, wait for it
  if (pendingOperation) {
    console.log('🎤 DAW Input: Waiting for pending operation...');
    try {
      await pendingOperation;
    } catch {
      // Ignore errors from pending operation
    }
  }

  // Check if we can reuse the existing stream
  const canReuse =
    mediaStream &&
    mediaStreamSource &&
    mediaStream.active &&
    requestedDeviceId === currentDeviceId;

  if (canReuse) {
    return mediaStreamSource!;
  }

  // Create new promise for this operation
  const operation = (async () => {

    // Close old stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      mediaStream = null;
    }

    // Disconnect old source
    if (mediaStreamSource) {
      try {
        mediaStreamSource.disconnect();
      } catch {
        // Ignore
      }
      mediaStreamSource = null;
    }

    // Request new stream with specific device
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: requestedDeviceId ? { exact: requestedDeviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }
    };

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create audio source node using Tone's context
      const context = Tone.getContext().rawContext as AudioContext;
      mediaStreamSource = context.createMediaStreamSource(mediaStream);
      currentDeviceId = requestedDeviceId;

      return mediaStreamSource;
    } catch (error) {
      console.error('DAW Input: Failed to get media stream:', error);
      throw error;
    }
  })();

  pendingOperation = operation;

  try {
    return await operation;
  } finally {
    pendingOperation = null;
  }
};

export const getCurrentDeviceId = (): string | undefined => {
  return currentDeviceId;
};

export const getUserMedia = (): MediaStreamAudioSourceNode | null => {
  return mediaStreamSource;
};

export const closeUserMedia = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (mediaStreamSource) {
    try {
      mediaStreamSource.disconnect();
    } catch {
      // Ignore
    }
    mediaStreamSource = null;
  }
  currentDeviceId = undefined;
};

export const isUserMediaAvailable = (): boolean => {
  return !!mediaStream && mediaStream.active;
};
