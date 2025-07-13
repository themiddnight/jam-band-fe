import { useEffect, useRef, useCallback } from "react";

export interface MidiControllerProps {
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
  onControlChange: (controller: number) => void;
  onPitchBend: (value: number, channel: number) => void;
  onSustainChange: (sustain: boolean) => void;
}

export const useMidiController = ({
  onNoteOn,
  onNoteOff,
  onControlChange,
  onPitchBend,
  onSustainChange,
}: MidiControllerProps) => {
  const midiAccess = useRef<WebMidi.MIDIAccess | null>(null);
  const inputs = useRef<WebMidi.MIDIInput[]>([]);

  const handleMidiMessage = useCallback((event: WebMidi.MIDIMessageEvent) => {
    const [status, data1, data2] = event.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;

    switch (messageType) {
      case 0x90: // Note On
        if (data2 > 0) {
          // Note On with velocity
          onNoteOn(data1, data2 / 127);
        } else {
          // Note On with velocity 0 = Note Off
          onNoteOff(data1);
        }
        break;

      case 0x80: // Note Off
        onNoteOff(data1);
        break;

      case 0xB0: // Control Change
        onControlChange(data1);
        
        // Handle sustain pedal (CC 64)
        if (data1 === 64) {
          onSustainChange(data2 >= 64);
        }
        break;

      case 0xE0: { // Pitch Bend
        const pitchValue = ((data2 << 7) | data1) / 16384; // 14-bit value normalized to 0-1
        onPitchBend(pitchValue, channel);
        break;
      }
    }
  }, [onNoteOn, onNoteOff, onControlChange, onPitchBend, onSustainChange]);

  const requestMidiAccess = useCallback(async () => {
    try {
      if (navigator.requestMIDIAccess) {
        const access = await navigator.requestMIDIAccess();
        midiAccess.current = access;
        
        // Store all inputs
        inputs.current = Array.from(access.inputs.values());
        
        // Set up event listeners for all inputs
        inputs.current.forEach(input => {
          input.onmidimessage = handleMidiMessage;
        });

        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }, [handleMidiMessage]);

  const getMidiInputs = useCallback(() => {
    return inputs.current.map(input => ({
      id: input.id,
      name: input.name || `MIDI Input ${input.id}`,
      manufacturer: input.manufacturer,
      state: input.state,
    }));
  }, []);

  const disconnect = useCallback(() => {
    inputs.current.forEach(input => {
      input.onmidimessage = null;
    });
    inputs.current = [];
    midiAccess.current = null;
  }, []);

  useEffect(() => {
    // Request MIDI access when the hook is initialized
    requestMidiAccess();

    return () => {
      disconnect();
    };
  }, [requestMidiAccess, disconnect]);

  return {
    requestMidiAccess,
    getMidiInputs,
    disconnect,
    isConnected: inputs.current.length > 0,
  };
}; 