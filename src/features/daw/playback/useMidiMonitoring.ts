import { useEffect, useRef } from 'react';
import { useTrackStore } from '../stores/trackStore';
import { useProjectStore } from '../stores/projectStore';
import { playImmediateNote, stopImmediateNote, setSustainPedal } from '../utils/audioEngine';
import type { MidiMessage } from '../hooks/useMidiInput';

// Track which notes are currently playing
const activeNotes = new Map<number, (() => void) | null>();

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
      setSustainPedal(track, sustainActive).then((stoppedNotes) => {
        // When sustain is released, remove stopped notes from activeNotes
        if (!sustainActive && stoppedNotes.length > 0) {
          stoppedNotes.forEach((note) => {
            activeNotes.delete(note);
          });
        }
      }).catch((error) => {
        console.error('Failed to set sustain pedal:', error);
      });
    }

    // Note On
    if (type === 'noteon' && note !== undefined && velocity !== undefined && velocity > 0) {
      // Play the note immediately
      playImmediateNote(track, note, velocity).then((stopFn) => {
        activeNotes.set(note, stopFn);
      }).catch((error) => {
        console.error('Failed to play MIDI note:', error);
      });
    }
    // Note Off
    else if ((type === 'noteoff' || (type === 'noteon' && velocity === 0)) && note !== undefined) {
      // Get the stop function for this note
      const stopFn = activeNotes.get(note);
      
      // Use stopImmediateNote which handles sustain logic
      stopImmediateNote(track, note, stopFn).then((isSustained) => {
        // If not sustained, remove from active notes
        if (!isSustained) {
          activeNotes.delete(note);
        }
        // If sustained, keep in activeNotes until sustain is released
      }).catch((error) => {
        console.error('Failed to stop MIDI note:', error);
      });
    }
  }, [message, selectedTrackId, tracks, transportState]);

  // Cleanup: stop all active notes and reset sustain when track changes or component unmounts
  useEffect(() => {
    return () => {
      activeNotes.forEach((stopFn) => {
        if (stopFn) {
          stopFn();
        }
      });
      activeNotes.clear();
      
      // Reset sustain pedal
      if (selectedTrackId) {
        const track = tracks.find((t) => t.id === selectedTrackId);
        if (track) {
          setSustainPedal(track, false).catch(() => {
            // Ignore errors during cleanup
          });
        }
      }
    };
  }, [selectedTrackId, tracks]);
};

