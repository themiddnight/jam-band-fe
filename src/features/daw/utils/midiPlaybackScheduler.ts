import * as Tone from "tone";

import type { MidiRegion, Track } from "../types/daw";
import { midiNumberToNoteName } from "./midiUtils";
import { trackInstrumentRegistry } from "./trackInstrumentRegistry";

interface ScheduledNoteEvent {
  id: string;
  noteName: string;
  velocity: number;
  startBeat: number;
  endBeat: number;
}

interface SustainSchedule {
  time: number;
  active: boolean;
}

const computeScheduledNotes = (region: MidiRegion): ScheduledNoteEvent[] => {
  const iterations = region.loopEnabled ? region.loopIterations : 1;
  const scheduled: ScheduledNoteEvent[] = [];

  const normalizeVelocity = (velocity: number): number => {
    const scaled = velocity <= 1 ? velocity * 127 : velocity;
    return Math.max(0, Math.min(127, Math.round(scaled)));
  };

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const iterationOffset = region.start + iteration * region.length;

    region.notes.forEach((note) => {
      const noteEnd = note.start + note.duration;

      if (note.start >= region.length || noteEnd <= 0) {
        return;
      }

      const clippedStart = Math.max(0, note.start);
      const clippedEnd = Math.min(region.length, noteEnd);
      const clippedDuration = clippedEnd - clippedStart;

      if (clippedDuration > 0.01) {
        const startBeat = iterationOffset + clippedStart;
        const endBeat = iterationOffset + clippedEnd;

        scheduled.push({
          id: note.id,
          noteName: midiNumberToNoteName(note.pitch),
          velocity: normalizeVelocity(note.velocity),
          startBeat,
          endBeat,
        });
      }
    });
  }

  return scheduled;
};

const computeSustainEvents = (region: MidiRegion): SustainSchedule[] => {
  const iterations = region.loopEnabled ? region.loopIterations : 1;
  const events: SustainSchedule[] = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const iterationOffset = region.start + iteration * region.length;

    region.sustainEvents.forEach((event) => {
      if (event.start >= region.length || event.end <= 0) {
        return;
      }

      const clippedStart = Math.max(0, event.start);
      const clippedEnd = Math.min(region.length, event.end);

      events.push({
        time: iterationOffset + clippedStart,
        active: true,
      });

      events.push({
        time: iterationOffset + clippedEnd,
        active: false,
      });
    });
  }

  return events;
};

export interface ScheduledMidiPlayback {
  cleanup: () => Promise<void>;
}

export interface MidiPlaybackOptions {
  transportBpm?: number;
  anchorBeat?: number;
}

export const scheduleMidiRegionPlayback = async (
  track: Track,
  region: MidiRegion,
  options: MidiPlaybackOptions = {},
): Promise<ScheduledMidiPlayback | null> => {
  const scheduledNotes = computeScheduledNotes(region);

  if (scheduledNotes.length === 0) {
    return null;
  }

  await trackInstrumentRegistry.ensureEngine(track, {
    instrumentId: track.instrumentId,
    instrumentCategory: track.instrumentCategory,
  });

  const sustainEvents = computeSustainEvents(region);
  const sustainEventIds: number[] = [];
  const noteStartIds: number[] = [];
  const noteStopIds: number[] = [];
  const activeNotes = new Set<string>();
  const sustainedNotes = new Set<string>(); // Track notes being held by sustain
  let currentSustainState = false;

  const bpm = options.transportBpm ?? Tone.Transport.bpm.value;
  const secondsPerBeat = bpm > 0 ? 60 / bpm : 60 / 120;
  const anchorBeat = options.anchorBeat ?? 0;
  const scheduleEpsilon = Math.min(Math.max(secondsPerBeat / 64, 0.01), 0.02);

  const beatToSeconds = (beat: number) => beat * secondsPerBeat;
  const toRelativeTime = (seconds: number) => `+${Math.max(0, seconds + scheduleEpsilon)}`;

  const sortedSustainEvents = [...sustainEvents].sort((a, b) => a.time - b.time);

  // Helper to check if a beat is within any sustain event
  const isSustainActiveAtBeat = (beat: number): boolean => {
    return sortedSustainEvents.some((event, index) => {
      if (!event.active || event.time > beat) {
        return false;
      }

      const nextRelease = sortedSustainEvents
        .slice(index + 1)
        .find((nextEvent) => !nextEvent.active);

      if (!nextRelease) {
        return true;
      }

      return nextRelease.time > beat;
    });
  };

  sortedSustainEvents.forEach((event) => {
    const relativeBeat = event.time - anchorBeat;
    if (relativeBeat < -0.001) {
      return;
    }
    const sustainTimeSeconds = beatToSeconds(Math.max(relativeBeat, 0));
    const id = Tone.Transport.scheduleOnce(() => {
      const wasSustained = currentSustainState;
      currentSustainState = event.active;
      
      void trackInstrumentRegistry
        .setSustain(track, event.active)
        .catch((error) => {
          console.error("Failed to toggle sustain during playback", {
            trackId: track.id,
            active: event.active,
            error,
          });
        });

      // When sustain is released, stop all notes that were being sustained
      if (wasSustained && !event.active && sustainedNotes.size > 0) {
        console.log('[MIDI Playback] Releasing sustained notes', {
          trackId: track.id,
          notes: Array.from(sustainedNotes),
        });
        const notesToStop = Array.from(sustainedNotes);
        sustainedNotes.clear();
        void trackInstrumentRegistry.stopNotes(track, notesToStop).catch((error) => {
          console.error("Failed to stop sustained notes", {
            trackId: track.id,
            error,
          });
        });
      }
    }, toRelativeTime(sustainTimeSeconds));

    sustainEventIds.push(id);
  });

  scheduledNotes.forEach((event) => {
    const relativeStartBeat = event.startBeat - anchorBeat;
    const relativeEndBeat = event.endBeat - anchorBeat;

    if (relativeEndBeat < -0.001) {
      return;
    }

    const clampedStartBeat = Math.max(relativeStartBeat, 0);
    const clampedEndBeat = Math.max(relativeEndBeat, clampedStartBeat);

    const startTimeSeconds = beatToSeconds(clampedStartBeat);
    const stopTimeSeconds = beatToSeconds(clampedEndBeat);

    // Check if note should be sustained
    const shouldBeSustained = isSustainActiveAtBeat(event.startBeat);

    const stopId = Tone.Transport.scheduleOnce(() => {
      // When note's natural duration ends
      if (currentSustainState) {
        // If sustain is active, move note from active to sustained set
        // Don't stop it yet - it will be stopped when sustain is released
        activeNotes.delete(event.noteName);
        sustainedNotes.add(event.noteName);
        console.log('[MIDI Playback] Note duration ended but sustain active', {
          trackId: track.id,
          note: event.noteName,
          sustainedNotes: Array.from(sustainedNotes),
        });
      } else {
        // If sustain is not active, stop the note normally
        activeNotes.delete(event.noteName);
        void trackInstrumentRegistry.stopNotes(track, event.noteName).catch((error) => {
          console.error("Failed to stop scheduled MIDI note", {
            trackId: track.id,
            note: event.noteName,
            error,
          });
        });
      }
    }, toRelativeTime(stopTimeSeconds));

    noteStopIds.push(stopId);

    const triggerNote = () => {
      console.log('[MIDI Playback] Trigger note', {
        trackId: track.id,
        note: event.noteName,
        velocity: event.velocity,
        startBeat: event.startBeat,
        endBeat: event.endBeat,
        sustainActive: currentSustainState,
        shouldBeSustained,
        transportTime: Tone.Transport.ticks,
      });
      activeNotes.add(event.noteName);

      // Play note as key-held (not sustained) so it can be managed properly
      // The sustain state is already set on the engine via setSustain calls
      void trackInstrumentRegistry
        .playNotes(track, event.noteName, {
          velocity: event.velocity,
          isKeyHeld: true,
        })
        .catch((error) => {
          console.error("Failed to play scheduled MIDI note", {
            trackId: track.id,
            note: event.noteName,
            error,
          });
        });
    };

    if (relativeStartBeat <= 0) {
      triggerNote();
    } else {
      const startId = Tone.Transport.scheduleOnce(triggerNote, toRelativeTime(startTimeSeconds));
      noteStartIds.push(startId);
    }
  });

  const cleanup = async () => {
    // Clear all scheduled events
    sustainEventIds.forEach((id) => Tone.Transport.clear(id));
    noteStartIds.forEach((id) => Tone.Transport.clear(id));
    noteStopIds.forEach((id) => Tone.Transport.clear(id));

    // Stop all active notes and sustained notes
    const allNotesToStop = new Set([...activeNotes, ...sustainedNotes]);
    if (allNotesToStop.size > 0) {
      try {
        await trackInstrumentRegistry.stopNotes(track, Array.from(allNotesToStop));
      } catch (error) {
        console.error("Failed to stop active notes during cleanup", {
          trackId: track.id,
          error,
        });
      }
      activeNotes.clear();
      sustainedNotes.clear();
    }

    // Reset sustain state and stop any sustained notes
    try {
      await trackInstrumentRegistry.setSustain(track, false);
    } catch (error) {
      console.error("Failed to reset sustain during cleanup", {
        trackId: track.id,
        error,
      });
    }

    // Stop all remaining notes on the track as a final cleanup
    try {
      await trackInstrumentRegistry.stopAllNotes(track);
    } catch (error) {
      console.error("Failed to stop all notes during cleanup", {
        trackId: track.id,
        error,
      });
    }

    currentSustainState = false;
  };

  return { cleanup };
};
