import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AudioDeviceState {
  voiceInputDeviceId: string | null;
  dawInputDeviceId: string | null;

  setVoiceInputDeviceId: (deviceId: string | null) => void;
  setDawInputDeviceId: (deviceId: string | null) => void;
}

export const useAudioDeviceStore = create<AudioDeviceState>()(
  persist(
    (set) => ({
      voiceInputDeviceId: null,
      dawInputDeviceId: null,

      setVoiceInputDeviceId: (deviceId) => set({ voiceInputDeviceId: deviceId }),
      setDawInputDeviceId: (deviceId) => set({ dawInputDeviceId: deviceId }),
    }),
    {
      name: 'audio-device-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
