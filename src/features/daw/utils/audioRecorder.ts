import * as Tone from 'tone';

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingMediaStream: MediaStream | null = null;
let recordingStartTime: number = 0;
let recordingStartBeat: number = 0;

export const requestMicrophoneAccess = async (deviceId?: string): Promise<MediaStream> => {
  try {
    // If we have a stream, check if it matches the requested device (if any)
    const currentTrack = recordingMediaStream?.getAudioTracks()[0];
    const currentDeviceId = currentTrack?.getSettings().deviceId;

    // If stream exists and (no specific device requested OR matches requested device), return it
    if (recordingMediaStream && recordingMediaStream.active && (!deviceId || currentDeviceId === deviceId)) {
      return recordingMediaStream;
    }

    // Stop existing stream if any
    if (recordingMediaStream) {
      recordingMediaStream.getTracks().forEach(t => t.stop());
    }

    const constraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };

    if (deviceId) {
      constraints.deviceId = { exact: deviceId };
    }

    recordingMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: constraints,
    });

    return recordingMediaStream;
  } catch (error) {
    console.error('Failed to access microphone:', error);
    throw error;
  }
};

export const startRecording = async (startBeat: number, deviceId?: string): Promise<void> => {
  if (!recordingMediaStream) {
    await requestMicrophoneAccess(deviceId);
  } else if (deviceId) {
    // Check if current stream matches deviceId
    const currentTrack = recordingMediaStream.getAudioTracks()[0];
    const currentDeviceId = currentTrack?.getSettings().deviceId;
    if (currentDeviceId !== deviceId) {
      await requestMicrophoneAccess(deviceId);
    }
  }

  if (!recordingMediaStream) {
    throw new Error('No media stream available');
  }

  audioChunks = [];
  recordingStartTime = Date.now();
  recordingStartBeat = startBeat;

  mediaRecorder = new MediaRecorder(recordingMediaStream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm',
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(100); // Collect data every 100ms
};

export const stopRecording = async (): Promise<{
  audioBlob: Blob;
  audioUrl: string;
  audioBuffer: AudioBuffer;
  startBeat: number;
  durationBeats: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
      reject(new Error('No active recording'));
      return;
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Calculate duration in beats
      const recordingEndTime = Date.now();
      const durationMs = recordingEndTime - recordingStartTime;
      const bpm = Tone.Transport.bpm.value;
      const durationBeats = (durationMs / 1000) * (bpm / 60);

      // Convert blob to AudioBuffer
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = Tone.getContext().rawContext as AudioContext;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        resolve({
          audioBlob,
          audioUrl,
          audioBuffer,
          startBeat: recordingStartBeat,
          durationBeats: Math.max(0.25, durationBeats),
        });
      } catch (error) {
        reject(error);
      }

      audioChunks = [];
    };

    mediaRecorder.stop();
  });
};

export const cancelRecording = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  audioChunks = [];
};

export const releaseMicrophone = () => {
  if (recordingMediaStream) {
    recordingMediaStream.getTracks().forEach((track) => track.stop());
    recordingMediaStream = null;
  }
  mediaRecorder = null;
};

export const isMicrophoneAvailable = (): boolean => {
  return !!recordingMediaStream && recordingMediaStream.active;
};

export const isRecording = (): boolean => {
  return !!mediaRecorder && mediaRecorder.state === 'recording';
};

