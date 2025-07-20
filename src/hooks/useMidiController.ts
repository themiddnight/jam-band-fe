import { useEffect, useRef, useCallback, useState } from "react";

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
  
  // Use ref to store stable handler references
  const handlersRef = useRef({
    onNoteOn,
    onNoteOff,
    onControlChange,
    onPitchBend,
    onSustainChange,
  });
  
  // Add React state for proper reactivity
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  // Update handlers ref when props change - more stable than useEffect
  handlersRef.current = {
    onNoteOn,
    onNoteOff,
    onControlChange,
    onPitchBend,
    onSustainChange,
  };

  // Memoize MIDI message handler to prevent recreation
  const handleMidiMessage = useCallback((event: WebMidi.MIDIMessageEvent) => {
    const [status, data1, data2] = event.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;

    const handlers = handlersRef.current;

    switch (messageType) {
      case 0x90: // Note On
        if (data2 > 0) {
          // Note On with velocity
          handlers.onNoteOn(data1, data2 / 127);
        } else {
          // Note On with velocity 0 = Note Off
          handlers.onNoteOff(data1);
        }
        break;

      case 0x80: // Note Off
        handlers.onNoteOff(data1);
        break;

      case 0xB0: // Control Change
        handlers.onControlChange(data1);
        
        // Handle sustain pedal (CC 64)
        if (data1 === 64) {
          handlers.onSustainChange(data2 >= 64);
        }
        break;

      case 0xE0: { // Pitch Bend
        const pitchValue = ((data2 << 7) | data1) / 16384; // 14-bit value normalized to 0-1
        handlers.onPitchBend(pitchValue, channel);
        break;
      }
    }
  }, []); // Empty dependency array since we use ref

  const cleanupInputs = useCallback(() => {
    inputs.current.forEach(input => {
      input.onmidimessage = null;
    });
    inputs.current = [];
  }, []);

  const updateInputs = useCallback(() => {
    if (midiAccess.current) {
      // Clean up old listeners first
      cleanupInputs();
      
      const newInputs = Array.from(midiAccess.current.inputs.values());
      inputs.current = newInputs;
      
      // Set up event listeners for all inputs
      newInputs.forEach(input => {
        input.onmidimessage = handleMidiMessage;
      });
      
      // Update connection state
      setIsConnected(newInputs.length > 0);
    }
  }, [handleMidiMessage, cleanupInputs]);

  const handleStateChange = useCallback(() => {
    updateInputs();
  }, [updateInputs]);

  const requestMidiAccess = useCallback(async (): Promise<boolean> => {
    if (isRequesting) return false;
    
    setIsRequesting(true);
    setConnectionError(null);
    
    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API not supported');
      }
      
      const access = await navigator.requestMIDIAccess();
      midiAccess.current = access;
      
      // Set up state change listener
      access.onstatechange = handleStateChange;
      
      // Initial input setup
      updateInputs();
      

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to access MIDI';
      setConnectionError(errorMessage);
      console.error('MIDI access error:', errorMessage);
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [isRequesting, handleStateChange, updateInputs]);

  const getMidiInputs = useCallback(() => {
    return inputs.current.map(input => ({
      id: input.id,
      name: input.name || `MIDI Input ${input.id}`,
      manufacturer: input.manufacturer,
      state: input.state,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupInputs();
      if (midiAccess.current) {
        midiAccess.current.onstatechange = null;
      }
    };
  }, [cleanupInputs]);

  return {
    isConnected,
    connectionError,
    isRequesting,
    requestMidiAccess,
    getMidiInputs,
  };
}; 