import { useEffect, useRef } from 'react';
import type { MidiMessage } from '../useMidiInput';
import { useTrackStore } from '../../stores/trackStore';
import { useProjectStore } from '../../stores/projectStore';
import { trackInstrumentRegistry } from '../../utils/trackInstrumentRegistry';
import { midiNumberToNoteName } from '../../utils/midiUtils';

// Track which notes are currently playing
const activeNotes = new Set<number>();

export const useMidiMonitoring = (message: MidiMessage | null) => {
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const tracks = useTrackStore((state) => state.tracks);
  const transportState = useProjectStore((state) => state.transportState);
  const lastMessageTimestampRef = useRef<number>(0);

  useEffect(() => {
    // Only monitor if not recording and a MIDI track is selected
    // Recording engine handles playback during recording
    if (!message || !selectedTrackId || transportState === 'recording') {
      return;
    }

    // Avoid processing the same message twice using raw event timestamp
    const currentTimestamp = message.raw.timeStamp;
    if (currentTimestamp === lastMessageTimestampRef.current) {
      return;
    }
    lastMessageTimestampRef.current = currentTimestamp;

    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track || track.type !== 'midi') {
      return;
    }

    const { type, note, velocity, control, value } = message;

    // Handle sustain pedal (CC#64)
    if (type === 'controlchange' && control === 64 && value !== undefined) {
      // Sustain active when value >= 64
      const sustainActive = value >= 64;
      trackInstrumentRegistry
        .setSustain(track, sustainActive)
        .then((releasedNotes) => {
          if (!sustainActive && releasedNotes.length > 0) {
            releasedNotes.forEach((released) => {
              activeNotes.delete(released);
            });
          }
        })
        .catch((error) => {
          console.error('Failed to set sustain pedal:', error);
        });
    }

    // Note On
    if (type === 'noteon' && note !== undefined && velocity !== undefined && velocity > 0) {
      // Play the note immediately
      const noteName = midiNumberToNoteName(note);
      activeNotes.add(note);
      trackInstrumentRegistry
        .playNotes(track, noteName, {
          velocity,
          isKeyHeld: true,
        })
        .catch((error) => {
          console.error('Failed to play MIDI note:', error);
          activeNotes.delete(note);
        });
    }
    // Note Off
    else if ((type === 'noteoff' || (type === 'noteon' && velocity === 0)) && note !== undefined) {
      activeNotes.delete(note);
      const noteName = midiNumberToNoteName(note);
      trackInstrumentRegistry
        .stopNotes(track, noteName)
        .catch((error) => {
          console.error('Failed to stop MIDI note:', error);
        });
    }
  }, [message, selectedTrackId, tracks, transportState]);

  // Cleanup: stop all active notes and reset sustain when track changes or component unmounts
  useEffect(() => {
    return () => {
      const track = selectedTrackId
        ? tracks.find((t) => t.id === selectedTrackId)
        : null;

      if (track) {
        const noteNames = Array.from(activeNotes).map((active) =>
          midiNumberToNoteName(active),
        );

        if (noteNames.length > 0) {
          trackInstrumentRegistry.stopNotes(track, noteNames).catch(() => {
            // Ignore cleanup errors
          });
        }

        trackInstrumentRegistry.setSustain(track, false).catch(() => {
          // Ignore cleanup errors
        });
      }

      activeNotes.clear();
    };
  }, [selectedTrackId, tracks]);
};
