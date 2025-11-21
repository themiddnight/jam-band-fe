import { useEffect, useRef, useCallback } from 'react';
import { useMidiInput, type MidiMessage } from './useMidiInput';
import { usePianoRollStore } from '../stores/pianoRollStore';
import { useProjectStore } from '../stores/projectStore';
import { useRegionStore } from '../stores/regionStore';
import type { MidiNote } from '../types/daw';
import { pianoRollRecordingBus } from '../utils/pianoRollRecordingBus';

interface UsePianoRollRecordingOptions {
  onNoteAdd: (note: Omit<MidiNote, 'id'>) => MidiNote | null;
  onRegionExtend?: (regionId: string, newLength: number) => void;
  enabled: boolean;
}

interface ActiveNote {
  pitch: number;
  startBeat: number;
  velocity: number;
}

/**
 * Hook to handle MIDI recording in the piano roll
 * Captures MIDI input (from devices and virtual instruments) and writes notes at the playhead position
 */
export const usePianoRollRecording = ({
  onNoteAdd,
  onRegionExtend,
  enabled,
}: UsePianoRollRecordingOptions) => {
  const activeRegionId = usePianoRollStore((state) => state.activeRegionId);
  const playhead = useProjectStore((state) => state.playhead);
  
  // Track active notes (notes that are currently being held down)
  const activeNotesRef = useRef<Map<number, ActiveNote>>(new Map());

  const handleMidiMessage = useCallback(
    (message: MidiMessage) => {
      if (!enabled || !activeRegionId) {
        return;
      }

      const region = useRegionStore.getState().regions.find((r) => r.id === activeRegionId);
      if (!region || region.type !== 'midi') {
        return;
      }

      // Note On
      if (message.type === 'noteon' && message.note !== undefined && message.velocity !== undefined) {
        const pitch = message.note;
        const velocity = message.velocity;

        // Calculate relative position within the region
        const relativeStart = playhead - region.start;
        
        // Don't record if playhead is before the region start
        if (relativeStart < 0) {
          return;
        }

        // Store the active note (don't extend on note-on, wait for note-off to know full duration)
        activeNotesRef.current.set(pitch, {
          pitch,
          startBeat: relativeStart,
          velocity,
        });
      }

      // Note Off
      if (message.type === 'noteoff' && message.note !== undefined) {
        const pitch = message.note;
        const activeNote = activeNotesRef.current.get(pitch);

        if (!activeNote) {
          return;
        }

        // Calculate duration
        const relativeEnd = playhead - region.start;
        const duration = Math.max(0.25, relativeEnd - activeNote.startBeat);

        // Get current region state
        const currentRegion = useRegionStore.getState().regions.find((r) => r.id === activeRegionId);
        if (!currentRegion || currentRegion.type !== 'midi') {
          activeNotesRef.current.delete(pitch);
          return;
        }

        // Calculate where the note will end
        const noteEnd = activeNote.startBeat + duration;
        
        // If note end is beyond region, extend the region to exactly fit the note
        if (noteEnd > currentRegion.length && onRegionExtend) {
          // Round up to nearest quarter beat for cleaner region lengths
          const newLength = Math.ceil(noteEnd * 4) / 4;
          onRegionExtend(currentRegion.id, newLength);
        }

        // Create the note
        onNoteAdd({
          pitch: activeNote.pitch,
          start: activeNote.startBeat,
          duration,
          velocity: activeNote.velocity,
        });

        // Remove from active notes
        activeNotesRef.current.delete(pitch);
      }
    },
    [enabled, activeRegionId, playhead, onNoteAdd, onRegionExtend]
  );

  // Initialize MIDI input from devices
  useMidiInput({
    autoConnect: true,
    onMessage: handleMidiMessage,
  });

  // Subscribe to virtual instrument MIDI messages
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unsubscribe = pianoRollRecordingBus.subscribe(handleMidiMessage);
    return unsubscribe;
  }, [enabled, handleMidiMessage]);

  // Clean up active notes when recording is disabled
  useEffect(() => {
    if (!enabled) {
      activeNotesRef.current.clear();
    }
  }, [enabled]);

  return {
    activeNotes: activeNotesRef.current,
  };
};
