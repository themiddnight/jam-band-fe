export {};

declare global {
  namespace WebMidi {
    type MIDIAccess = globalThis.MIDIAccess;
    type MIDIInput = globalThis.MIDIInput;
    type MIDIOutput = globalThis.MIDIOutput;
    type MIDIMessageEvent = globalThis.MIDIMessageEvent;
    type MIDIConnectionEvent = globalThis.MIDIConnectionEvent;
    type MIDIPort = globalThis.MIDIPort;
    type MIDIPortDeviceState = globalThis.MIDIPortDeviceState;
  }
}
