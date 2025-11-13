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

  const bpm = options.transportBpm ?? Tone.Transport.bpm.value;
  const secondsPerBeat = bpm > 0 ? 60 / bpm : 60 / 120;
  const anchorBeat = options.anchorBeat ?? 0;
  const scheduleEpsilon = Math.min(Math.max(secondsPerBeat / 64, 0.01), 0.02);

  const beatToSeconds = (beat: number) => beat * secondsPerBeat;
  const toRelativeTime = (seconds: number) => `+${Math.max(0, seconds + scheduleEpsilon)}`;

  sustainEvents.forEach((event) => {
    const relativeBeat = event.time - anchorBeat;
    if (relativeBeat < -0.001) {
      return;
    }
    const sustainTimeSeconds = beatToSeconds(Math.max(relativeBeat, 0));
    const id = Tone.Transport.scheduleOnce(() => {
      void trackInstrumentRegistry
        .setSustain(track, event.active)
        .catch((error) => {
          console.error("Failed to toggle sustain during playback", {
            trackId: track.id,
            active: event.active,
            error,
          });
        });
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

    const stopId = Tone.Transport.scheduleOnce(() => {
      activeNotes.delete(event.noteName);
      void trackInstrumentRegistry.stopNotes(track, event.noteName).catch((error) => {
        console.error("Failed to stop scheduled MIDI note", {
          trackId: track.id,
          note: event.noteName,
          error,
        });
      });
    }, toRelativeTime(stopTimeSeconds));

    noteStopIds.push(stopId);

    const triggerNote = () => {
      console.log('[MIDI Playback] Trigger note', {
        trackId: track.id,
        note: event.noteName,
        velocity: event.velocity,
        startBeat: event.startBeat,
        endBeat: event.endBeat,
        transportTime: Tone.Transport.ticks,
      });
      activeNotes.add(event.noteName);

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
    sustainEventIds.forEach((id) => Tone.Transport.clear(id));
    noteStartIds.forEach((id) => Tone.Transport.clear(id));
    noteStopIds.forEach((id) => Tone.Transport.clear(id));

    if (activeNotes.size > 0) {
      try {
        await trackInstrumentRegistry.stopNotes(track, Array.from(activeNotes));
      } catch (error) {
        console.error("Failed to stop active notes during cleanup", {
          trackId: track.id,
          error,
        });
      }
      activeNotes.clear();
    }

    try {
      await trackInstrumentRegistry.setSustain(track, false);
    } catch (error) {
      console.error("Failed to reset sustain during cleanup", {
        trackId: track.id,
        error,
      });
    }
  };

  return { cleanup };
};
