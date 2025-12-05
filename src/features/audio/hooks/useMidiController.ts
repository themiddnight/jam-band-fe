import { useEffect, useRef, useCallback, useState, useMemo } from "react";

export interface MidiControllerProps {
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
  onControlChange: (controller: number) => void;
  onPitchBend: (value: number, channel: number) => void;
  onSustainChange: (sustain: boolean) => void;
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string | null;
  state: string;
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
  const isInitialized = useRef<boolean>(false);

  // Use ref to store stable handler references
  const handlersRef = useRef({
    onNoteOn,
    onNoteOff,
    onControlChange,
    onPitchBend,
    onSustainChange,
  });

  // React state for proper reactivity
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
    const data = Array.from(event.data ?? []);
    const status = data[0] ?? 0;
    const data1 = data[1] ?? 0;
    const data2 = data[2] ?? 0;
    const channel = status & 0x0f;
    const messageType = status & 0xf0;

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

      case 0xb0: // Control Change
        handlers.onControlChange(data1);

        // Handle sustain pedal (CC 64)
        if (data1 === 64) {
          handlers.onSustainChange(data2 >= 64);
        }
        break;

      case 0xe0: {
        // Pitch Bend
        const pitchValue = ((data2 << 7) | data1) / 16384; // 14-bit value normalized to 0-1
        handlers.onPitchBend(pitchValue, channel);
        break;
      }
    }
  }, []); // Empty dependency array since we use ref

  const cleanupInputs = useCallback(() => {
    inputs.current.forEach((input) => {
      input.onmidimessage = null;
    });
    inputs.current = [];
  }, []);

  const refreshMidiDevices = useCallback(() => {
    if (midiAccess.current) {
      // Clean up old listeners first
      cleanupInputs();

      const newInputs = Array.from(midiAccess.current.inputs.values());
      inputs.current = newInputs;

      // Set up event listeners for all inputs
      newInputs.forEach((input) => {
        input.onmidimessage = handleMidiMessage;
      });

      // Update connection state
      const hasActiveDevices = newInputs.length > 0;
      setIsConnected(hasActiveDevices);

      console.log(
        `MIDI devices refreshed: ${newInputs.length} device(s) found`,
      );

      return hasActiveDevices;
    }
    return false;
  }, [handleMidiMessage, cleanupInputs]);

  const handleStateChange = useCallback(() => {
    refreshMidiDevices();
  }, [refreshMidiDevices]);

  const requestMidiAccess = useCallback(async (): Promise<boolean> => {
    if (isRequesting) return false;

    setIsRequesting(true);
    setConnectionError(null);

    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error("Web MIDI API not supported");
      }

      const access = await navigator.requestMIDIAccess();
      midiAccess.current = access;
      isInitialized.current = true;

      // Set up state change listener
      access.onstatechange = handleStateChange;

      // Initial device refresh
      const hasDevices = refreshMidiDevices();

      return hasDevices;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to access MIDI";
      setConnectionError(errorMessage);
      console.error("MIDI access error:", errorMessage);
      isInitialized.current = false;
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [isRequesting, handleStateChange, refreshMidiDevices]);

  const getMidiInputs = useCallback((): MidiDevice[] => {
    return inputs.current.map((input) => ({
      id: input.id,
      name: input.name || `MIDI Input ${input.id}`,
      manufacturer: input.manufacturer,
      state: input.state,
    }));
  }, []);

  // Handle window focus/visibility to refresh MIDI devices
  const handleWindowFocus = useCallback(() => {
    if (isInitialized.current && midiAccess.current) {
      // Only refresh if we detect a state change in MIDI devices
      const currentInputs = Array.from(midiAccess.current.inputs.values());
      const hasStateChange =
        currentInputs.length !== inputs.current.length ||
        currentInputs.some(
          (input, index) =>
            !inputs.current[index] ||
            input.id !== inputs.current[index].id ||
            input.state !== inputs.current[index].state,
        );

      if (hasStateChange) {
        
        refreshMidiDevices();
      }
    }
  }, [refreshMidiDevices]);

  const handleVisibilityChange = useCallback(() => {
    if (!document.hidden && isInitialized.current && midiAccess.current) {
      // Only refresh if we detect a state change in MIDI devices
      const currentInputs = Array.from(midiAccess.current.inputs.values());
      const hasStateChange =
        currentInputs.length !== inputs.current.length ||
        currentInputs.some(
          (input, index) =>
            !inputs.current[index] ||
            input.id !== inputs.current[index].id ||
            input.state !== inputs.current[index].state,
        );

      if (hasStateChange) {
        
        refreshMidiDevices();
      }
    }
  }, [refreshMidiDevices]);

  // Set up window focus and visibility listeners
  useEffect(() => {
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleWindowFocus, handleVisibilityChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupInputs();
      if (midiAccess.current) {
        midiAccess.current.onstatechange = null;
        midiAccess.current = null;
      }
      isInitialized.current = false;
    };
  }, [cleanupInputs]);

  return useMemo(() => ({
    isConnected,
    connectionError,
    isRequesting,
    requestMidiAccess,
    getMidiInputs,
    refreshMidiDevices,
  }), [
    isConnected,
    connectionError,
    isRequesting,
    requestMidiAccess,
    getMidiInputs,
    refreshMidiDevices
  ]);
};
