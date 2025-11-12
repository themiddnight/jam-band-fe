import * as Tone from 'tone';
import { Soundfont } from 'smplr';

import type { MidiNote, MidiRegion, NoteId, Track } from '../types/daw';

type LoadedInstrument = {
  trackId: string;
  instrumentId: string;
  soundfont: Soundfont;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  isLoaded: boolean;
  sustainActive: boolean;
  sustainedNotes: Map<number, (() => void) | null>; // notes held by sustain pedal
};

const instruments = new Map<string, LoadedInstrument>();
let isContextConfigured = false;

const ensureToneConfigured = () => {
  if (isContextConfigured) {
    return;
  }
  try {
    // lookAhead is settable
    Tone.context.lookAhead = 0.1;
    isContextConfigured = true;
  } catch (error) {
    console.warn('Could not configure Tone.js context:', error);
  }
};

export const initializeAudioEngine = async () => {
  ensureToneConfigured();
  if (Tone.context.state !== 'running') {
    await Tone.start();
  }
  return Tone.getContext().rawContext as AudioContext;
};

export const getAudioContext = (): AudioContext => {
  ensureToneConfigured();
  return Tone.getContext().rawContext as AudioContext;
};

const createInstrument = (trackId: string, instrumentId: string): LoadedInstrument => {
  const context = getAudioContext();
  
  // Create gain and pan nodes for volume/pan control
  const gainNode = context.createGain();
  const panNode = context.createStereoPanner();
  
  // Connect: soundfont -> gain -> pan -> destination
  gainNode.connect(panNode);
  panNode.connect(context.destination);
  
  const soundfont = new Soundfont(context, {
    instrument: instrumentId,
    destination: gainNode, // Connect to gain node instead of destination
  });
  
  const loadedInstrument: LoadedInstrument = {
    trackId,
    instrumentId,
    soundfont,
    gainNode,
    panNode,
    isLoaded: false,
    sustainActive: false,
    sustainedNotes: new Map(),
  };
  soundfont.load
    .then(() => {
      loadedInstrument.isLoaded = true;
    })
    .catch((error) => {
      console.error(`Failed to load instrument ${instrumentId} for track ${trackId}`, error);
      instruments.delete(trackId);
    });
  return loadedInstrument;
};

export const updateTrackAudioParams = (track: Track) => {
  const instrument = instruments.get(track.id);
  if (!instrument) {
    return;
  }
  
  // Update gain (volume)
  instrument.gainNode.gain.value = track.volume;
  
  // Update pan
  instrument.panNode.pan.value = track.pan;
};

export const loadInstrumentForTrack = async (track: Track) => {
  // Audio tracks don't have instruments
  if (track.type === 'audio' || !track.instrumentId) {
    return null;
  }
  
  const cached = instruments.get(track.id);
  
  // If instrument changed, dispose old one and create new
  if (cached && cached.instrumentId !== track.instrumentId) {
    try {
      cached.soundfont.disconnect();
    } catch (error) {
      console.warn('Failed to disconnect old instrument', error);
    }
    instruments.delete(track.id);
  }
  
  const existing = instruments.get(track.id);
  if (existing?.isLoaded) {
    // Update audio params in case they changed
    updateTrackAudioParams(track);
    return existing.soundfont;
  }
  
  const instrument = existing ?? createInstrument(track.id, track.instrumentId);
  instruments.set(track.id, instrument);
  await instrument.soundfont.load;
  instrument.isLoaded = true;
  
  // Set initial gain and pan
  updateTrackAudioParams(track);
  
  return instrument.soundfont;
};

export const playImmediateNote = async (
  track: Track,
  note: number,
  velocity = 100
) => {
  const instrument = await loadInstrumentForTrack(track);
  if (!instrument) {
    return null;
  }
  const stopFn = instrument.start({
    note,
    velocity,
  });
  return stopFn;
};

export const stopImmediateNote = async (
  track: Track,
  note: number,
  stopFn?: (() => void) | null
) => {
  const instrumentData = instruments.get(track.id);
  if (!instrumentData) {
    return false;
  }
  
  // If sustain pedal is active, don't stop the note - add it to sustained notes
  if (instrumentData.sustainActive) {
    // Store the stop function to call later when sustain is released
    instrumentData.sustainedNotes.set(note, stopFn ?? null);
    return true; // Return true to indicate note is being sustained
  }
  
  // Otherwise, stop the note immediately
  if (stopFn) {
    stopFn();
  } else {
    instrumentData.soundfont.stop(note);
  }
  return false; // Return false to indicate note was stopped
};

export const setSustainPedal = async (
  track: Track,
  active: boolean
): Promise<number[]> => {
  const instrumentData = instruments.get(track.id);
  if (!instrumentData) {
    return [];
  }
  
  instrumentData.sustainActive = active;
  
  // If pedal is released, stop all sustained notes
  const stoppedNotes: number[] = [];
  if (!active && instrumentData.sustainedNotes.size > 0) {
    instrumentData.sustainedNotes.forEach((stopFn, note) => {
      if (stopFn) {
        stopFn();
      } else {
        instrumentData.soundfont.stop(note);
      }
      stoppedNotes.push(note);
    });
    instrumentData.sustainedNotes.clear();
  }
  
  return stoppedNotes;
};

export const stopAllInstruments = () => {
  instruments.forEach((instrument) => {
    try {
      instrument.soundfont.stop();
      // Reset sustain state
      instrument.sustainActive = false;
      instrument.sustainedNotes.clear();
    } catch (error) {
      console.warn('Failed to stop instrument', instrument.trackId, error);
    }
  });
};

export interface ScheduledMidiNote extends MidiNote {
  time: number;
}

export interface ScheduledNote {
  id: NoteId;
  time: number;
  pitch: number;
  velocity: number;
  duration: number;
}

const beatsToTicks = (beats: number) => beats * Tone.Transport.PPQ;

const computeScheduledNotes = (region: MidiRegion): ScheduledNote[] => {
  const iterations = region.loopEnabled ? region.loopIterations : 1;
  const scheduled: ScheduledNote[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const iterationOffset = region.start + iteration * region.length;
    region.notes.forEach((note) => {
      // Only schedule notes that fall within the visible region bounds
      // This handles head/tail trimming for MIDI regions
      const noteEnd = note.start + note.duration;
      
      // Skip notes that are completely outside the region
      if (note.start >= region.length || noteEnd <= 0) {
        return;
      }
      
      // Clip notes that start before region bounds
      const clippedStart = Math.max(0, note.start);
      const clippedEnd = Math.min(region.length, noteEnd);
      const clippedDuration = clippedEnd - clippedStart;
      
      // Only schedule if there's audible duration
      if (clippedDuration > 0.01) {
        scheduled.push({
          id: note.id,
          time: iterationOffset + clippedStart,
          pitch: note.pitch,
          velocity: note.velocity,
          duration: clippedDuration,
        });
      }
    });
  }
  return scheduled;
};

export const scheduleRegionPlayback = async (track: Track, region: MidiRegion) => {
  const instrumentData = instruments.get(track.id);
  if (!instrumentData) {
    return null;
  }
  
  const instrument = await loadInstrumentForTrack(track);
  if (!instrument) {
    return null;
  }
  const scheduledNotes = computeScheduledNotes(region);

  // Schedule sustain events
  const iterations = region.loopEnabled ? region.loopIterations : 1;
  const sustainEvents: Array<{ time: number; active: boolean }> = [];
  
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const iterationOffset = region.start + iteration * region.length;
    region.sustainEvents.forEach((event) => {
      // Skip events outside the region bounds (for head/tail trimming)
      if (event.start >= region.length || event.end <= 0) {
        return;
      }
      
      const clippedStart = Math.max(0, event.start);
      const clippedEnd = Math.min(region.length, event.end);
      
      // Schedule sustain on
      sustainEvents.push({
        time: iterationOffset + clippedStart,
        active: true,
      });
      
      // Schedule sustain off
      sustainEvents.push({
        time: iterationOffset + clippedEnd,
        active: false,
      });
    });
  }
  
  // Schedule sustain events in Tone.js Transport
  sustainEvents.forEach((event) => {
    Tone.Transport.schedule(() => {
      instrumentData.sustainActive = event.active;
      
      // If pedal is released, stop all sustained notes
      if (!event.active && instrumentData.sustainedNotes.size > 0) {
        instrumentData.sustainedNotes.forEach((stopFn, note) => {
          if (stopFn) {
            stopFn();
          } else {
            instrumentData.soundfont.stop(note);
          }
        });
        instrumentData.sustainedNotes.clear();
      }
    }, Tone.Ticks(beatsToTicks(event.time)));
  });

  const part = new Tone.Part((time, event) => {
    const note = event as ScheduledNote;
    const secondsPerBeat = 60 / Tone.Transport.bpm.value;
    const noteDuration = note.duration * secondsPerBeat;
    
    // Check if sustain will be active when note should end
    const noteEndBeat = note.time + note.duration;
    const sustainActiveAtEnd = sustainEvents.some(
      (se) => se.active && se.time <= noteEndBeat && 
      (sustainEvents.find((se2) => !se2.active && se2.time > se.time)?.time ?? Infinity) > noteEndBeat
    );
    
    // If sustain will be active, use a very long duration; otherwise use the note's duration
    const playDuration = sustainActiveAtEnd ? 60 : noteDuration;
    
    // Start the note
    const stopFn = instrument.start({
      note: note.pitch,
      velocity: note.velocity,
      time,
      duration: playDuration,
    });
    
    // If using long duration, schedule manual stop at the right time
    if (!sustainActiveAtEnd) {
      // Note will stop naturally
    } else {
      // Store stop function for when sustain is released
      const noteOffTime = time + noteDuration;
      Tone.Transport.schedule(() => {
        if (instrumentData.sustainActive) {
          // Add to sustained notes to stop later
          instrumentData.sustainedNotes.set(note.pitch, () => {
            if (stopFn) {
              stopFn();
            }
          });
        }
      }, noteOffTime);
    }
  }, scheduledNotes.map((event) => [Tone.Ticks(beatsToTicks(event.time)), event]));

  part.start(0);
  return part;
};

export const disposeAudioEngine = () => {
  stopAllInstruments();
  instruments.forEach((instrument) => {
    instrument.soundfont.disconnect();
  });
  instruments.clear();
  Tone.Transport.stop();
};

