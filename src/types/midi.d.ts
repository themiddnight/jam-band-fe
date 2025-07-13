declare namespace WebMidi {
  interface MIDIAccess {
    inputs: Map<string, MIDIInput>;
    outputs: Map<string, MIDIOutput>;
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
  }

  interface MIDIInput {
    id: string;
    name: string | null;
    manufacturer: string | null;
    state: MIDIPortDeviceState;
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
  }

  interface MIDIOutput {
    id: string;
    name: string | null;
    manufacturer: string | null;
    state: MIDIPortDeviceState;
  }

  interface MIDIMessageEvent {
    data: Uint8Array;
  }

  interface MIDIConnectionEvent {
    port: MIDIPort;
  }

  interface MIDIPort {
    id: string;
    name: string | null;
    manufacturer: string | null;
    state: MIDIPortDeviceState;
  }

  type MIDIPortDeviceState = 'connected' | 'disconnected';
}

interface Navigator {
  requestMIDIAccess(): Promise<WebMidi.MIDIAccess>;
} 