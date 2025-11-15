import type { SynthState } from "@/features/instruments";
import { gmNoteMapper, InstrumentEngine } from "@/features/instruments";
import { AudioContextManager } from "@/features/audio/constants/audioConfig";
import {
  getGlobalMixer,
  getOrCreateGlobalMixer,
} from "@/features/audio/utils/effectsArchitecture";
import { InstrumentCategory } from "@/shared/constants/instruments";
import type { Track } from "../types/daw";
import { DEFAULT_INSTRUMENT_ID } from "../types/daw";
import { midiNumberToNoteName, noteNameToMidi } from "./midiUtils";

type TrackId = Track["id"];

export interface TrackInstrumentState {
  engine: InstrumentEngine;
  isReady: boolean;
  isLoading: boolean;
  username: string;
}

interface RegistryEntry {
  engine: InstrumentEngine;
  username: string;
}

interface EnsureEngineOptions {
  instrumentId?: string;
  instrumentCategory?: InstrumentCategory;
  onSynthParamsChange?: (params: Partial<SynthState>) => void;
}

interface ChannelMixerSettings {
  volume: number;
  pan: number;
}

interface UpdateTrackOptions {
  instrumentId: string;
  instrumentCategory: InstrumentCategory;
}

type NoteInput = number | string;
type NoteInputList = NoteInput | NoteInput[];

interface PlayNotesOptions extends EnsureEngineOptions {
  velocity?: number;
  isKeyHeld?: boolean;
  sampleNotes?: string[];
}

const registry = new Map<TrackId, RegistryEntry>();
const mixerSettings = new Map<TrackId, ChannelMixerSettings>();
const pendingLoads = new Map<TrackId, Promise<RegistryEntry>>();

const toArray = <T>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value];

const normalizeVelocity = (velocity?: number): number => {
  if (velocity === undefined || Number.isNaN(velocity)) {
    return 100 / 127; // fall back to a musical default
  }
  const clamped = Math.max(0, Math.min(velocity, 127));
  return clamped / 127;
};

const toNoteNames = (values: NoteInputList): string[] =>
  toArray(values)
    .map((value) => {
      if (typeof value === "number") {
        try {
          return midiNumberToNoteName(value);
        } catch (error) {
          console.warn(
            `Failed to convert MIDI value ${value} to note name`,
            error,
          );
          return null;
        }
      }
      return value;
    })
    .filter((noteName): noteName is string => Boolean(noteName));

const toMidiNumbers = (notes: string[]): number[] =>
  notes
    .map((note) => noteNameToMidi(note))
    .filter((value): value is number => value !== null);

const hydrateTrack = (
  track: Track,
  instrumentId: string,
  instrumentCategory: InstrumentCategory,
): Track => ({
  ...track,
  instrumentId,
  instrumentCategory,
});

const resolveInstrumentId = (track: Track, override?: string): string => {
  return override ?? track.instrumentId ?? DEFAULT_INSTRUMENT_ID;
};

const resolveInstrumentCategory = (
  track: Track,
  override?: InstrumentCategory,
): InstrumentCategory => {
  return override ?? track.instrumentCategory ?? InstrumentCategory.Melodic;
};

const resolveUsername = (track: Track): string => {
  const name = track.name?.trim();
  if (name) {
    return name;
  }
  return `Track ${track.id.slice(0, 6)}`;
};

const instantiateEngine = async (
  track: Track,
  options: EnsureEngineOptions,
): Promise<RegistryEntry> => {
  const instrumentName = resolveInstrumentId(track, options.instrumentId);
  const category = resolveInstrumentCategory(
    track,
    options.instrumentCategory,
  );
  const username = resolveUsername(track);

  const mixer = await getOrCreateGlobalMixer();
  if (!mixer.getChannel(track.id)) {
    mixer.createUserChannel(track.id, username);
  }

  const engine = new InstrumentEngine({
    userId: track.id,
    username,
    instrumentName,
    category,
    isLocalUser: true,
    onSynthParamsChange: options.onSynthParamsChange,
  });

  const context = await AudioContextManager.getInstrumentContext();
  
  // Try to resume context if suspended
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch (err) {
      console.warn('Failed to resume AudioContext (may require user interaction):', err);
    }
  }
  
  // Initialize engine - this may fail if AudioContext isn't running
  await engine.initialize(context);

  if (category === InstrumentCategory.DrumBeat) {
    const samples = engine.getAvailableSamples();
    if (samples.length > 0) {
      gmNoteMapper.initialize(samples);
    }
  }

  const settings = mixerSettings.get(track.id);
  if (settings) {
    await applyMixerSettings(track.id, settings);
  }

  return { engine, username };
};

const applyMixerSettings = async (trackId: TrackId, settings: ChannelMixerSettings) => {
  mixerSettings.set(trackId, settings);

  try {
    const mixer = await getOrCreateGlobalMixer();
    let channel = mixer.getChannel(trackId);
    if (!channel) {
      const entry = registry.get(trackId);
      if (!entry) {
        return;
      }
      channel = mixer.createUserChannel(trackId, entry.username);
    }

    mixer.setUserVolume(trackId, settings.volume);
    if (channel?.toneChannel) {
      channel.toneChannel.pan.setValueAtTime(settings.pan, mixer.getAudioContext().currentTime);
    }
  } catch (error) {
    console.warn("Failed to apply mixer settings", { trackId, error });
  }
};

export const trackInstrumentRegistry = {
  async ensureEngine(
    track: Track,
    options: EnsureEngineOptions = {},
  ): Promise<TrackInstrumentState> {
    const existing = registry.get(track.id);
    if (existing) {
      return {
        engine: existing.engine,
        isReady: existing.engine.isReady(),
        isLoading: existing.engine.getIsLoading(),
        username: existing.username,
      };
    }

    const pending = pendingLoads.get(track.id);
    if (pending) {
      const entry = await pending;
      return {
        engine: entry.engine,
        isReady: entry.engine.isReady(),
        isLoading: entry.engine.getIsLoading(),
        username: entry.username,
      };
    }

    const loadPromise = instantiateEngine(track, options).then((entry) => {
      registry.set(track.id, entry);
      pendingLoads.delete(track.id);
      return entry;
    });

    pendingLoads.set(track.id, loadPromise);

    const entry = await loadPromise;
    return {
      engine: entry.engine,
      isReady: entry.engine.isReady(),
      isLoading: entry.engine.getIsLoading(),
      username: entry.username,
    };
  },

  async updateChannelMix(track: Track, settings: ChannelMixerSettings): Promise<void> {
    await applyMixerSettings(track.id, settings);
  },

  async playNotes(
    track: Track,
    notes: NoteInputList,
    options: PlayNotesOptions = {},
  ): Promise<void> {
    const instrumentId = resolveInstrumentId(track, options.instrumentId);
    const instrumentCategory = resolveInstrumentCategory(
      track,
      options.instrumentCategory,
    );
    const hydratedTrack = hydrateTrack(track, instrumentId, instrumentCategory);

    const resolvedNotes = toNoteNames(notes);
    if (resolvedNotes.length === 0) {
      return;
    }

    const { engine } = await this.ensureEngine(hydratedTrack, {
      instrumentId,
      instrumentCategory,
      onSynthParamsChange: options.onSynthParamsChange,
    });

    const velocity = normalizeVelocity(options.velocity ?? 100);
    await engine.playNotes(resolvedNotes, velocity, options.isKeyHeld ?? false, {
      sampleNotes: options.sampleNotes,
    });
  },

  async stopNotes(
    track: Track,
    notes: NoteInputList,
    options: EnsureEngineOptions = {},
  ): Promise<void> {
    const instrumentId = resolveInstrumentId(track, options.instrumentId);
    const instrumentCategory = resolveInstrumentCategory(
      track,
      options.instrumentCategory,
    );
    const hydratedTrack = hydrateTrack(track, instrumentId, instrumentCategory);

    const resolvedNotes = toNoteNames(notes);
    if (resolvedNotes.length === 0) {
      return;
    }

    const engine = (await this.ensureEngine(hydratedTrack, {
      instrumentId,
      instrumentCategory,
      onSynthParamsChange: options.onSynthParamsChange,
    })).engine;

    await engine.stopNotes(resolvedNotes);
  },

  async stopAllNotes(track: Track): Promise<void> {
    const engine = this.getEngine(track.id);
    if (!engine) {
      return;
    }
    await engine.stopAllNotes();
  },

  async setSustain(
    track: Track,
    sustain: boolean,
    options: EnsureEngineOptions = {},
  ): Promise<number[]> {
    const instrumentId = resolveInstrumentId(track, options.instrumentId);
    const instrumentCategory = resolveInstrumentCategory(
      track,
      options.instrumentCategory,
    );
    const hydratedTrack = hydrateTrack(track, instrumentId, instrumentCategory);

    const { engine } = await this.ensureEngine(hydratedTrack, {
      instrumentId,
      instrumentCategory,
      onSynthParamsChange: options.onSynthParamsChange,
    });

    if (sustain) {
      engine.setSustain(true);
      return [];
    }

    const activeBefore = engine.getAllActiveNotes();
    engine.setSustain(false);
    const activeAfter = engine.getAllActiveNotes();
    const released = activeBefore.filter(
      (note) => !activeAfter.includes(note),
    );
    return toMidiNumbers(released);
  },

  getEngine(trackId: TrackId): InstrumentEngine | null {
    return registry.get(trackId)?.engine ?? null;
  },

  async updateTrackConfig(
    track: Track,
    options: UpdateTrackOptions,
  ): Promise<void> {
    const entry = registry.get(track.id);
    if (!entry) {
      await this.ensureEngine(track, options);
      return;
    }

    entry.engine.updateInstrument(options.instrumentId, options.instrumentCategory);
    await entry.engine.load();

    if (options.instrumentCategory === InstrumentCategory.DrumBeat) {
      const samples = entry.engine.getAvailableSamples();
      if (samples.length > 0) {
        gmNoteMapper.initialize(samples);
      }
    }
  },

  async disposeTrack(trackId: TrackId): Promise<void> {
    const entry = registry.get(trackId);
    if (!entry) {
      return;
    }

    entry.engine.dispose();
    registry.delete(trackId);
    pendingLoads.delete(trackId);
    mixerSettings.delete(trackId);

    const mixer = getGlobalMixer();
    mixer?.removeUserChannel(trackId);
  },

  async disposeAll(): Promise<void> {
    await Promise.all(
      [...registry.entries()].map(async ([trackId, entry]) => {
        entry.engine.dispose();
        const mixer = getGlobalMixer();
        mixer?.removeUserChannel(trackId);
      }),
    );

    registry.clear();
    pendingLoads.clear();
  },
};
