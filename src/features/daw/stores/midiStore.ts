import { create } from 'zustand';

import type { MidiInputDevice, MidiMessage } from '../hooks/useMidiInput';

interface MidiStoreState {
  isSupported: boolean;
  isEnabled: boolean;
  inputs: MidiInputDevice[];
  lastMessage: MidiMessage | null;
  setStatus: (status: Partial<Omit<MidiStoreState, 'setStatus'>>) => void;
  setLastMessage: (message: MidiMessage) => void;
}

export const useMidiStore = create<MidiStoreState>((set) => ({
  isSupported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  isEnabled: false,
  inputs: [],
  lastMessage: null,
  setStatus: (status) => set(status),
  setLastMessage: (message) => set({ lastMessage: message }),
}));

