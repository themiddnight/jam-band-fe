import type { MidiMessage } from '../hooks/useMidiInput';

/**
 * Simple event bus for piano roll recording
 * Allows virtual instruments to send MIDI messages to the piano roll recorder
 */
class PianoRollRecordingBus {
  private listeners: Set<(message: MidiMessage) => void> = new Set();

  subscribe(listener: (message: MidiMessage) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(message: MidiMessage): void {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in piano roll recording listener:', error);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const pianoRollRecordingBus = new PianoRollRecordingBus();
