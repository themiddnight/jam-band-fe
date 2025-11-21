import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

import { InstrumentCategory } from '@/shared/constants/instruments';
import type { MidiNote, SustainEvent } from '../../types/daw';
import { useProjectStore } from '../../stores/projectStore';
import { useTrackStore } from '../../stores/trackStore';
import { usePianoRollStore } from '../../stores/pianoRollStore';
import { useRecordingStore } from '../../stores/recordingStore';
import { playImmediateNote, setSustainPedal, stopImmediateNote } from '../../utils/audioEngine';
import type { MidiMessage } from '../useMidiInput';
import { snapToGrid } from '../../utils/timeUtils';
import { useDAWCollaborationContext } from '../../contexts/useDAWCollaborationContext';

interface RecordedNote extends Omit<MidiNote, 'id'> {
  tempId: number;
}

interface ActiveNote {
  tempId: number;
  startBeat: number;
  velocity: number;
  stopFn: (() => void) | null;
}

interface RecordedSustainEvent extends Omit<SustainEvent, 'id'> {
  tempId: number;
}

const getCurrentBeat = () => Tone.Transport.ticks / Tone.Transport.PPQ;

export const useRecordingEngine = () => {
  const transportState = useProjectStore((state) => state.transportState);
  const gridDivision = useProjectStore((state) => state.gridDivision);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const tracks = useTrackStore((state) => state.tracks);
  const setActiveRegion = usePianoRollStore((state) => state.setActiveRegion);
  const startRecordingPreview = useRecordingStore((state) => state.startRecording);
  const updateRecordingDuration = useRecordingStore((state) => state.updateRecordingDuration);
  const stopRecordingPreview = useRecordingStore((state) => state.stopRecording);
  const { handleRegionAdd } = useDAWCollaborationContext();

  const activeNotesRef = useRef<Map<number, ActiveNote>>(new Map());
  const recordedNotesRef = useRef<RecordedNote[]>([]);
  const recordedSustainEventsRef = useRef<RecordedSustainEvent[]>([]);
  const activeSustainStartBeatRef = useRef<number | null>(null);
  const recordingStartBeatRef = useRef<number | null>(null);
  const recordingTrackIdRef = useRef<string | null>(null);
  const durationUpdateIntervalRef = useRef<number | null>(null);
  const tempIdCounterRef = useRef(0);
  const sustainTempIdCounterRef = useRef(0);
  const [isMidiRecordingActive, setIsMidiRecordingActive] = useState(false);

  // Update duration continuously during MIDI recording
  useEffect(() => {
    if (transportState === 'recording' && isMidiRecordingActive) {
      durationUpdateIntervalRef.current = window.setInterval(() => {
        const currentBeat = getCurrentBeat();
        const duration = currentBeat - recordingStartBeatRef.current!;
        updateRecordingDuration(Math.max(0.25, duration));
      }, 50);
    } else {
      if (durationUpdateIntervalRef.current) {
        clearInterval(durationUpdateIntervalRef.current);
        durationUpdateIntervalRef.current = null;
      }
    }

    return () => {
      if (durationUpdateIntervalRef.current) {
        clearInterval(durationUpdateIntervalRef.current);
      }
    };
  }, [transportState, isMidiRecordingActive, updateRecordingDuration]);

  // When recording stops, create the region with all recorded notes and sustain events
  useEffect(() => {
    if (transportState !== 'recording' && recordingStartBeatRef.current !== null) {
      const trackId = recordingTrackIdRef.current;
      const startBeat = recordingStartBeatRef.current;
      const notes = recordedNotesRef.current;
      const sustainEvents = recordedSustainEventsRef.current;

      // If sustain is still active when recording stops, close it
      if (activeSustainStartBeatRef.current !== null) {
        const currentBeat = getCurrentBeat();
        const relativeBeat = currentBeat - recordingStartBeatRef.current;
        sustainEvents.push({
          tempId: sustainTempIdCounterRef.current++,
          start: activeSustainStartBeatRef.current,
          end: relativeBeat,
        });
        activeSustainStartBeatRef.current = null;
      }

      if (trackId && notes.length > 0) {
        // Calculate region length based on the furthest note or sustain event
        const maxNoteEnd = notes.reduce((max, note) => {
          return Math.max(max, note.start + note.duration);
        }, 0);
        const maxSustainEnd = sustainEvents.reduce((max, event) => {
          return Math.max(max, event.end);
        }, 0);
        const regionLength = Math.max(4, Math.ceil(Math.max(maxNoteEnd, maxSustainEnd)));

        const resolvedNotes: MidiNote[] = notes.map((note) => ({
          id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${note.tempId}`,
          pitch: note.pitch,
          start: note.start,
          duration: note.duration,
          velocity: note.velocity,
        }));

        const resolvedSustainEvents: SustainEvent[] = sustainEvents.map((event) => ({
          id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${event.tempId}`,
          start: event.start,
          end: event.end,
        }));

        // Create region with all recorded data (synced to collaborators)
        const region = handleRegionAdd(trackId, startBeat, regionLength, {
          notes: resolvedNotes,
          sustainEvents: resolvedSustainEvents,
        });

        if (region) {
          // Open in piano roll
          setActiveRegion(region.id);
        }
      }

      // Clean up
      recordingStartBeatRef.current = null;
      recordingTrackIdRef.current = null;
      recordedNotesRef.current = [];
      recordedSustainEventsRef.current = [];
      activeSustainStartBeatRef.current = null;
      activeNotesRef.current.clear();
      setIsMidiRecordingActive(false);
      stopRecordingPreview();
      
      // Reset sustain pedal state
      if (trackId) {
        const track = tracks.find((t) => t.id === trackId);
        if (track) {
          setSustainPedal(track, false).catch(() => {
            // Ignore errors during cleanup
          });
        }
      }
    }
  }, [transportState, handleRegionAdd, setActiveRegion, stopRecordingPreview, tracks]);

  const handleMidiMessage = useCallback(
    (message: MidiMessage) => {
      if (transportState !== 'recording' || !selectedTrackId) {
        return;
      }

      const track = tracks.find((t) => t.id === selectedTrackId);
      if (!track || track.type !== 'midi') {
        return;
      }

      const monitoringHandled = Boolean(message.monitoringHandled);

      // Initialize recording on first note
      if (recordingStartBeatRef.current === null) {
        const startBeat = snapToGrid(getCurrentBeat(), gridDivision);
        recordingStartBeatRef.current = startBeat;
        recordingTrackIdRef.current = selectedTrackId;
        startRecordingPreview(selectedTrackId, startBeat, 'midi');
        setIsMidiRecordingActive(true);
      }

      const regionStartBeat = recordingStartBeatRef.current;

      // Handle sustain pedal (CC#64)
      if (message.type === 'controlchange' && message.control === 64) {
        if (monitoringHandled) {
          return;
        }
        const currentBeat = getCurrentBeat();
        const relativeBeat = currentBeat - regionStartBeat;
        
        // Sustain pedal pressed (value >= 64 means on)
        if (typeof message.value === 'number' && message.value >= 64) {
          setSustainPedal(track, true).catch((error) => {
            console.error('Failed to set sustain pedal:', error);
          });
          
          // If sustain wasn't already active, start a new sustain event
          if (activeSustainStartBeatRef.current === null) {
            activeSustainStartBeatRef.current = relativeBeat;
          }
        } 
        // Sustain pedal released (value < 64 means off)
        else if (typeof message.value === 'number' && message.value < 64) {
          setSustainPedal(track, false).catch((error) => {
            console.error('Failed to release sustain pedal:', error);
          });
          
          // If sustain was active, record the sustain event
          if (activeSustainStartBeatRef.current !== null) {
            recordedSustainEventsRef.current.push({
              tempId: sustainTempIdCounterRef.current++,
              start: activeSustainStartBeatRef.current,
              end: relativeBeat,
            });
            activeSustainStartBeatRef.current = null;
          }
        }
      }

      if (message.type === 'noteon' && typeof message.note === 'number' && message.velocity && message.velocity > 0) {
        const currentBeat = getCurrentBeat();
        const relativeBeat = currentBeat - regionStartBeat;
        const tempId = tempIdCounterRef.current++;
        const velocity = message.velocity;
        const noteNumber = message.note;

        // Store note info (but don't write to recordedNotes yet - wait for note-off)
        activeNotesRef.current.set(noteNumber, {
          tempId,
          startBeat: relativeBeat,
          velocity: velocity,
          stopFn: null,
        });

        // Play the note immediately for monitoring (skip for drums - they're already played by InstrumentEngine)
        if (!monitoringHandled && track.instrumentCategory !== InstrumentCategory.DrumBeat) {
          playImmediateNote(track, noteNumber, velocity).then((stopFn) => {
            const noteInfo = activeNotesRef.current.get(noteNumber);
            if (noteInfo) {
              noteInfo.stopFn = stopFn;
            }
          }).catch((error) => {
            console.error('Failed to play note:', error);
          });
        }
      } else if (
        (message.type === 'noteoff' || (message.type === 'noteon' && message.velocity === 0)) &&
        typeof message.note === 'number'
      ) {
        const noteNumber = message.note;
        const noteInfo = activeNotesRef.current.get(noteNumber);
        if (!noteInfo) {
          return;
        }

        // Stop the note (with sustain handling) - skip for drums
        if (!monitoringHandled && track.instrumentCategory !== InstrumentCategory.DrumBeat) {
          stopImmediateNote(track, noteNumber, noteInfo.stopFn).catch(() => {
            // Ignore errors
          });
        }

        // Calculate duration
        const currentBeat = getCurrentBeat();
        const relativeBeat = currentBeat - regionStartBeat;
        const duration = Math.max(0.25, relativeBeat - noteInfo.startBeat);

        // NOW write the note to buffer (only once, with correct duration)
        recordedNotesRef.current.push({
          tempId: noteInfo.tempId,
          pitch: noteNumber,
          start: noteInfo.startBeat,
          duration: duration,
          velocity: noteInfo.velocity,
        });

        activeNotesRef.current.delete(noteNumber);
      }
    },
    [
      transportState,
      selectedTrackId,
      tracks,
      gridDivision,
      startRecordingPreview,
    ]
  );

  return handleMidiMessage;
};

