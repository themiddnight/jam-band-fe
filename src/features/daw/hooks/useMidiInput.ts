import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type MidiMessageType = 'noteon' | 'noteoff' | 'controlchange' | 'pitchbend' | 'unknown';

export interface MidiMessage {
  type: MidiMessageType;
  channel: number;
  note?: number;
  velocity?: number;
  control?: number;
  value?: number;
  monitoringHandled?: boolean;
  raw: MIDIMessageEvent;
}

export interface MidiInputDevice {
  id: string;
  name: string;
  manufacturer?: string;
}

export interface UseMidiInputOptions {
  autoConnect?: boolean;
  onMessage?: (message: MidiMessage) => void;
}

interface UseMidiInputState {
  isSupported: boolean;
  isEnabled: boolean;
  inputs: MidiInputDevice[];
  lastMessage: MidiMessage | null;
}

const parseMidiMessage = (event: MIDIMessageEvent): MidiMessage => {
  const data = event.data ? Array.from(event.data) : [0, 0, 0];
  const status = data[0] ?? 0;
  const data1 = data[1] ?? 0;
  const data2 = data[2] ?? 0;
  const command = status & 0xf0;
  const channel = status & 0x0f;

  switch (command) {
    case 0x90: {
      if (data2 === 0) {
        return {
          type: 'noteoff',
          channel,
          note: data1,
          velocity: data2,
          raw: event,
        };
      }
      return {
        type: 'noteon',
        channel,
        note: data1,
        velocity: data2,
        raw: event,
      };
    }
    case 0x80:
      return {
        type: 'noteoff',
        channel,
        note: data1,
        velocity: data2,
        raw: event,
      };
    case 0xb0:
      return {
        type: 'controlchange',
        channel,
        control: data1,
        value: data2,
        raw: event,
      };
    case 0xe0: {
      const value = ((data2 << 7) | data1) - 8192;
      return {
        type: 'pitchbend',
        channel,
        value,
        raw: event,
      };
    }
    default:
      return {
        type: 'unknown',
        channel,
        raw: event,
      };
  }
};

export const useMidiInput = (options: UseMidiInputOptions = {}): UseMidiInputState & {
  requestAccess: () => Promise<void>;
  dispose: () => void;
} => {
  const { autoConnect = true, onMessage } = options;
  const [state, setState] = useState<UseMidiInputState>({
    isSupported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
    isEnabled: false,
    inputs: [],
    lastMessage: null,
  });
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const messageHandlerRef = useRef<typeof onMessage | undefined>(onMessage);

  messageHandlerRef.current = onMessage;

  const disconnect = useCallback(() => {
    const midi = midiAccessRef.current;
    if (!midi) {
      return;
    }
    midi.onstatechange = null;
    midi.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
  }, []);

  const updateInputsState = useCallback(() => {
    const midi = midiAccessRef.current;
    if (!midi) {
      return;
    }
    const inputs: MidiInputDevice[] = [];
    midi.inputs.forEach((input) => {
      inputs.push({
        id: input.id,
        name: input.name ?? `MIDI Device ${inputs.length + 1}`,
        manufacturer: input.manufacturer ?? undefined,
      });
    });
    setState((prev) => ({
      ...prev,
      inputs,
    }));
  }, []);

  const requestAccess = useCallback(async () => {
    if (!state.isSupported || midiAccessRef.current) {
      return;
    }
    try {
      // Request MIDI access (force any, as the MIDIAccess typing issue prevents full correctness)
      const access = await (navigator as any).requestMIDIAccess();
      midiAccessRef.current = access as MIDIAccess;
      (access as MIDIAccess).onstatechange = updateInputsState;
      (access as MIDIAccess).inputs.forEach((input: any) => {
        input.onmidimessage = (event: MIDIMessageEvent) => {
          const message = parseMidiMessage(event);
          setState((prev) => ({
            ...prev,
            lastMessage: message,
          }));
          messageHandlerRef.current?.(message);
        };
      });
      updateInputsState();
      setState((prev) => ({
        ...prev,
        isEnabled: true,
      }));
    } catch (error) {
      console.error('Failed to access MIDI devices', error);
      setState((prev) => ({
        ...prev,
        isEnabled: false,
      }));
    }
  }, [state.isSupported, updateInputsState]);

  const dispose = useCallback(() => {
    disconnect();
    midiAccessRef.current = null;
    setState((prev) => ({
      ...prev,
      isEnabled: false,
      inputs: [],
    }));
  }, [disconnect]);

  useEffect(() => {
    if (!autoConnect) {
      return;
    }
    requestAccess();
    return () => {
      dispose();
    };
  }, [autoConnect, requestAccess, dispose]);

  return useMemo(
    () => ({
      ...state,
      requestAccess,
      dispose,
    }),
    [state, requestAccess, dispose]
  );
};

