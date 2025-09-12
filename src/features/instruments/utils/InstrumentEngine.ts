import { InstrumentCategory } from "../../../shared/constants/instruments";
import { throttle } from "../../../shared/utils/performanceUtils";
import {
  getSafariLoadTimeout,
  handleSafariAudioError,
  findNextCompatibleInstrument,
} from "../../../shared/utils/webkitCompat";
import { getOptimalAudioConfig } from "../../audio";
import { Soundfont, DrumMachine } from "smplr";
import * as Tone from "tone";

export interface SynthState {
  // Volume control
  volume: number;

  // Amplitude envelope
  ampAttack: number;
  ampDecay: number;
  ampSustain: number;
  ampRelease: number;

  // Analog synth controls
  oscillatorType: string;
  filterFrequency: number;
  filterResonance: number;

  // Filter envelope
  filterAttack: number;
  filterDecay: number;
  filterSustain: number;
  filterRelease: number;

  // FM synth controls
  modulationIndex: number;
  harmonicity: number;
  modAttack: number;
  modDecay: number;
  modSustain: number;
  modRelease: number;
}

const defaultSynthState: SynthState = {
  volume: 0.5,
  ampAttack: 0.01,
  ampDecay: 0.1,
  ampSustain: 0.8,
  ampRelease: 0.3,
  oscillatorType: "sawtooth",
  filterFrequency: 1000,
  filterResonance: 5,
  filterAttack: 0.01,
  filterDecay: 0.1,
  filterSustain: 0.5,
  filterRelease: 0.3,
  modulationIndex: 10,
  harmonicity: 1,
  modAttack: 0.01,
  modDecay: 0.1,
  modSustain: 0.5,
  modRelease: 0.3,
};

export interface InstrumentEngineConfig {
  userId: string;
  username: string;
  instrumentName: string;
  category: InstrumentCategory;
  isLocalUser?: boolean;
  onSynthParamsChange?: (params: Partial<SynthState>) => void;
  onInstrumentFallback?: (
    originalInstrument: string,
    fallbackInstrument: string,
    category: InstrumentCategory,
  ) => void;
}

export class InstrumentEngine {
  private config: InstrumentEngineConfig;
  private audioContext: AudioContext | null = null;

  // Traditional instruments (smplr)
  private instrument: any = null;

  // Synthesizer components (Tone.js)
  private synthRef: any = null;
  private filterRef: Tone.Filter | null = null;
  private filterEnvelopeRef: Tone.FrequencyEnvelope | null = null;
  private gainRef: Tone.Gain | null = null;

  // Audio buffer cache integration (uses shared cache)

  // State management
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<any> | null = null;
  private synthState: SynthState = { ...defaultSynthState };

  // Note tracking with optimized data structures
  private activeNotes = new Map<string, any>();
  private sustainedNotes = new Set<any>();
  private keyHeldNotes = new Set<string>();
  private sustain = false;

  // Synthesizer specific tracking
  private noteStack: string[] = [];
  private currentNote: string | null = null;
  private filterEnvelopeActive = false;
  private pendingReleases = new Map<string, number>();
  private pendingStop = new Map<string, number>();

  // Performance optimizations
  private noteProcessingQueue = new Map<
    string,
    { action: "play" | "stop"; timestamp: number }
  >();
  private readonly PROCESSING_INTERVAL = 4; // Reduced from 8ms to 4ms for better responsiveness
  private processingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isWebRTCOptimized = false; // Track if we're in WebRTC optimization mode

  // Audio performance optimizations (future enhancement)
  // private audioBufferCache = new Map<string, AudioBuffer>();
  // private readonly MAX_CACHE_SIZE = 50;
  // private audioWorkletSupported = false;

  // Throttled parameter updates for better performance
  private throttledParamUpdate = throttle((params: Partial<SynthState>) => {
    this.updateSynthParamsInternal(params);
  }, 8); // Reduced from 16ms to 8ms for better responsiveness

  // Audio buffer cache integration
  private clearAudioBufferCache(): void {
    // Clear shared audio buffer cache
    import("../../audio/utils/audioBufferCache")
      .then(({ clearAudioBufferCache }) => {
        clearAudioBufferCache();
      })
      .catch(() => {
        // Ignore import errors
      });
  }

  // Get cache statistics for monitoring
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  }> {
    try {
      const { getAudioBufferCacheStats } = await import(
        "../../audio/utils/audioBufferCache"
      );
      return getAudioBufferCacheStats();
    } catch {
      return { hits: 0, misses: 0, hitRate: 0, size: 0 };
    }
  }

  constructor(config: InstrumentEngineConfig) {
    this.config = config;
    this.throttledParamUpdate = throttle(
      this.updateSynthParamsInternal.bind(this),
      16,
    );
  }

  // Optimized note processing with better batching
  private processNoteQueue(): void {
    if (this.noteProcessingQueue.size === 0) return;

    const notesToProcess = new Map<
      string,
      { action: "play" | "stop"; timestamp: number }
    >();

    // Collect notes to process with timestamp filtering
    const now = Date.now();
    this.noteProcessingQueue.forEach((value, key) => {
      // Only process notes that aren't too old
      if (now - value.timestamp < 100) {
        notesToProcess.set(key, value);
      }
    });

    // Clear the queue
    this.noteProcessingQueue.clear();

    // Process notes by action type for better efficiency
    const playNotes: string[] = [];
    const stopNotes: string[] = [];

    notesToProcess.forEach((value, note) => {
      if (value.action === "play") {
        playNotes.push(note);
      } else {
        stopNotes.push(note);
      }
    });

    // Batch process play notes with optimized batching
    if (playNotes.length > 0) {
      this.processPlayNotesOptimized(playNotes);
    }

    // Batch process stop notes with optimized batching
    if (stopNotes.length > 0) {
      this.processStopNotesOptimized(stopNotes);
    }

    // Schedule next processing if there are more notes
    if (this.noteProcessingQueue.size > 0) {
      this.scheduleNoteProcessing();
    } else {
      this.processingTimeout = null;
    }
  }

  // Schedule note processing
  private scheduleNoteProcessing(): void {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    this.processingTimeout = setTimeout(
      () => this.processNoteQueue(),
      this.PROCESSING_INTERVAL,
    );
  }

  // Optimized play notes processing
  private processPlayNotesOptimized(notes: string[]): void {
    if (this.config.category === InstrumentCategory.Synthesizer) {
      // For synths, process all notes at once for better performance
      notes.forEach((note) => this.playPolySynthNote(note, 0.7, false));
    } else {
      // For traditional instruments, use larger batches for better performance
      const batchSize = 10; // Increased from 5
      for (let i = 0; i < notes.length; i += batchSize) {
        const batch = notes.slice(i, i + batchSize);
        this.playTraditionalNotesBatchOptimized(batch, 0.7);
      }
    }
  }

  // Optimized stop notes processing
  private processStopNotesOptimized(notes: string[]): void {
    if (this.config.category === InstrumentCategory.Synthesizer) {
      notes.forEach((note) => this.stopSynthNotes([note]));
    } else {
      // For traditional instruments, use larger batches for better performance
      const batchSize = 10; // Increased from 5
      for (let i = 0; i < notes.length; i += batchSize) {
        const batch = notes.slice(i, i + batchSize);
        this.stopTraditionalNotesBatchOptimized(batch);
      }
    }
  }

  // Optimized batch play traditional notes
  private async playTraditionalNotesBatchOptimized(
    notes: string[],
    velocity: number,
  ): Promise<void> {
    if (!this.instrument || !this.isLoaded) return;

    try {
      // Use Promise.allSettled for better error handling
      await Promise.allSettled(
        notes.map((note) =>
          this.instrument.start({ note, velocity, duration: 1 }),
        ),
      );
    } catch (error) {
      console.error("Error playing traditional notes batch:", error);
    }
  }

  // Optimized batch stop traditional notes
  private async stopTraditionalNotesBatchOptimized(
    notes: string[],
  ): Promise<void> {
    if (!this.instrument || !this.isLoaded) return;

    try {
      // Use Promise.allSettled for better error handling
      await Promise.allSettled(
        notes.map((note) => this.instrument.stop({ note })),
      );
    } catch (error) {
      console.error("Error stopping traditional notes batch:", error);
    }
  }

  getKey(): string {
    return `${this.config.userId}-${this.config.instrumentName}-${this.config.category}`;
  }

  getUserId(): string {
    return this.config.userId;
  }

  getUsername(): string {
    return this.config.username;
  }

  getInstrumentName(): string {
    return this.config.instrumentName;
  }

  getCategory(): InstrumentCategory {
    return this.config.category;
  }

  isReady(): boolean {
    return (
      this.isLoaded && (this.instrument !== null || this.synthRef !== null)
    );
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  getSynthState(): SynthState {
    return { ...this.synthState };
  }

  /**
   * Get available samples for drum machines
   */
  getAvailableSamples(): string[] {
    if (
      this.config.category === InstrumentCategory.DrumBeat &&
      this.instrument &&
      this.instrument.getSampleNames
    ) {
      try {
        const samples = this.instrument.getSampleNames();
        // Ensure we have actual samples, not just an empty array
        if (Array.isArray(samples) && samples.length > 0) {
          return samples;
        }
        return [];
      } catch (error) {
        console.warn(`Failed to get samples from drum machine: ${error}`);
        return [];
      }
    }
    return [];
  }

  async waitForSamples(maxWaitTime: number = 5000): Promise<string[]> {
    if (this.config.category !== InstrumentCategory.DrumBeat) {
      return [];
    }

    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const samples = this.getAvailableSamples();
      if (samples.length > 0) {
        return samples;
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.warn(
      `Timeout waiting for drum machine samples after ${maxWaitTime}ms`,
    );
    return [];
  }

  async initialize(audioContext: AudioContext): Promise<void> {
    this.audioContext = audioContext;
    await this.load();
  }

  async load(): Promise<any> {
    if (this.isLoaded && (this.instrument || this.synthRef)) {
      return this.instrument || this.synthRef;
    }

    if (this.isLoading && this.loadPromise) {
      // If already loading, return the existing promise to prevent duplicate requests
      console.log(
        `⏳ Instrument ${this.config.instrumentName} already loading for ${this.config.username}, waiting for existing load...`,
      );
      return this.loadPromise;
    }

    this.isLoading = true;
    console.log(
      `🎵 Starting to load ${this.config.instrumentName} (${this.config.category}) for ${this.config.isLocalUser ? "local" : "remote"} user ${this.config.username}`,
    );

    this.loadPromise = this._loadInstrumentWithFallback();

    try {
      const result = await this.loadPromise;
      this.isLoaded = true;
      console.log(
        `✅ Successfully loaded ${this.config.instrumentName} for ${this.config.username}`,
      );
      return result;
    } catch (error) {
      console.error(
        `❌ Failed to load ${this.config.instrumentName} for ${this.config.username}:`,
        error,
      );
      throw error;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async _loadInstrumentWithFallback(): Promise<any> {
    const failedInstruments = new Set<string>();
    let currentInstrument = this.config.instrumentName;
    const currentCategory = this.config.category;
    let maxAttempts = 5; // Limit the number of fallback attempts

    while (maxAttempts > 0) {
      try {
        console.log(
          `🎵 Attempting to load ${currentInstrument} (${currentCategory}) for ${this.config.username}`,
        );

        // Update the config with the current instrument
        this.config.instrumentName = currentInstrument;
        this.config.category = currentCategory;

        const result = await this._loadInstrument();
        console.log(
          `✅ Successfully loaded ${currentInstrument} for ${this.config.username}`,
        );
        return result;
      } catch (error) {
        maxAttempts--;
        failedInstruments.add(currentInstrument);

        console.warn(
          `⚠️ Failed to load ${currentInstrument} for ${this.config.username}:`,
          error,
        );

        // Check if this is a Safari audio decoding error
        const isSafariError =
          error instanceof Error &&
          (error.message.includes("Safari audio decoding failed") ||
            error.message.includes("Safari audio decoding error") ||
            error.message.includes("EncodingError"));

        if (!isSafariError) {
          // If it's not a Safari-specific error, don't try fallbacks
          throw error;
        }

        // Try to find the next compatible instrument
        const nextInstrument = await findNextCompatibleInstrument(
          currentInstrument,
          currentCategory,
          failedInstruments,
        );

        if (!nextInstrument) {
          console.error(
            `❌ No more compatible instruments available for ${this.config.username} in category ${currentCategory}`,
          );
          throw new Error(
            `No compatible instruments available in category ${currentCategory}`,
          );
        }

        console.log(
          `🔄 Trying next compatible instrument: ${nextInstrument} for ${this.config.username}`,
        );

        // Notify about the fallback if callback is provided
        if (this.config.onInstrumentFallback) {
          this.config.onInstrumentFallback(
            this.config.instrumentName,
            nextInstrument,
            currentCategory,
          );
        }

        currentInstrument = nextInstrument;

        // If we're out of attempts, throw the error
        if (maxAttempts <= 0) {
          throw new Error(
            `Failed to load any compatible instrument after multiple attempts for ${this.config.username}`,
          );
        }
      }
    }

    throw new Error(
      `Failed to load any compatible instrument for ${this.config.username}`,
    );
  }

  private async _loadInstrument(): Promise<any> {
    if (!this.audioContext || this.audioContext.state !== "running") {
      throw new Error("AudioContext not ready");
    }

    try {
      if (this.config.category === InstrumentCategory.Synthesizer) {
        await this.initializeSynthesizer();
        return this.synthRef;
      } else {
        return await this.loadTraditionalInstrument();
      }
    } catch (error) {
      console.error(
        `Failed to load instrument ${this.config.instrumentName} for user ${this.config.username}:`,
        error,
      );
      throw error;
    }
  }

  private async loadTraditionalInstrument(): Promise<any> {
    // Use separate audio context for instruments
    const { AudioContextManager } = await import(
      "../../audio/constants/audioConfig"
    );
    const instrumentContext = await AudioContextManager.getInstrumentContext();

    // Update the audio context reference
    if (this.audioContext !== instrumentContext) {
      this.audioContext = instrumentContext;
    }

    let newInstrument: any;

    if (this.config.category === InstrumentCategory.DrumBeat) {
      newInstrument = new DrumMachine(this.audioContext!, {
        instrument: this.config.instrumentName,
        volume: 127,
      });
    } else {
      newInstrument = new Soundfont(this.audioContext!, {
        instrument: this.config.instrumentName,
        volume: 127,
      });
    }

    const loadTimeout = getSafariLoadTimeout();

    const loadPromise = new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Instrument loading timed out after ${loadTimeout}ms`),
        );
      }, loadTimeout);

      newInstrument.load
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch((error: any) => {
          clearTimeout(timeoutId);
          reject(handleSafariAudioError(error, this.config.instrumentName));
        });
    });

    await loadPromise;
    this.instrument = newInstrument;

    console.log(
      `Loaded ${this.config.category} instrument ${this.config.instrumentName} for ${this.config.isLocalUser ? "local" : "remote"} user ${this.config.username}`,
    );
    return newInstrument;
  }

  private async initializeSynthesizer(): Promise<void> {
    if (this.synthRef) {
      return; // Already initialized
    }

    try {
      // Use separate audio context for instruments
      const { AudioContextManager } = await import(
        "../../audio/constants/audioConfig"
      );
      const instrumentContext =
        await AudioContextManager.getInstrumentContext();

      // Set Tone.js to use the dedicated instrument context
      Tone.setContext(instrumentContext);
      await Tone.start();

      const audioConfig = getOptimalAudioConfig();
      const context = Tone.getContext();
      context.lookAhead = audioConfig.TONE_CONTEXT.lookAhead;

      // Adjust polyphony based on WebRTC state
      const maxPolyphony = AudioContextManager.getMaxPolyphony();
      console.log(
        `🎹 Instrument Engine: Using max polyphony of ${maxPolyphony} (WebRTC active: ${AudioContextManager.isWebRTCActive()})`,
      );

      // Create audio chain: synth -> filter -> gain -> destination
      this.filterRef = new Tone.Filter({
        frequency: this.synthState.filterFrequency,
        Q: this.synthState.filterResonance,
        type: "lowpass",
      });

      this.gainRef = new Tone.Gain(this.synthState.volume);

      // Create filter envelope for analog synthesizers
      if (this.config.instrumentName.startsWith("analog_")) {
        this.filterEnvelopeRef = new Tone.FrequencyEnvelope({
          attack: this.synthState.filterAttack,
          decay: this.synthState.filterDecay,
          sustain: this.synthState.filterSustain,
          release: this.synthState.filterRelease,
          baseFrequency: this.synthState.filterFrequency,
          octaves: 4,
        });

        this.filterEnvelopeRef.connect(this.filterRef.frequency);
      }

      // Create synthesizer based on type
      this.synthRef = this.createSynthesizer();

      // Connect audio chain
      if (this.synthRef && this.filterRef && this.gainRef) {
        this.synthRef.connect(this.filterRef);
        this.filterRef.connect(this.gainRef);
        this.gainRef.toDestination();
      }

      console.log(
        `✅ Initialized Tone.js synthesizer ${this.config.instrumentName} for ${this.config.isLocalUser ? "local" : "remote"} user ${this.config.username} with dedicated audio context`,
      );

      // Ensure all current synth parameters are applied to the new synthesizer
      if (this.synthRef) {
        this.updateSynthParamsInternal(this.synthState);
      }
    } catch (error) {
      console.error(
        `Failed to initialize synthesizer for user ${this.config.username}:`,
        error,
      );
      throw error;
    }
  }

  private createSynthesizer(): any {
    const commonEnvelope = {
      attack: this.synthState.ampAttack,
      decay: this.synthState.ampDecay,
      sustain: this.synthState.ampSustain,
      release: this.synthState.ampRelease,
    };

    const commonOscillator = {
      type: this.synthState.oscillatorType as any,
    };

    switch (this.config.instrumentName) {
      case "analog_mono":
      case "analog_bass":
      case "analog_lead":
        return new Tone.Synth({
          oscillator: commonOscillator,
          envelope: commonEnvelope,
        });

      case "analog_poly":
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: commonOscillator,
          envelope: commonEnvelope,
        });

      case "fm_mono":
        return new Tone.FMSynth({
          harmonicity: this.synthState.harmonicity,
          modulationIndex: this.synthState.modulationIndex,
          envelope: commonEnvelope,
          modulation: { type: "sine" },
          modulationEnvelope: {
            attack: this.synthState.modAttack,
            decay: this.synthState.modDecay,
            sustain: this.synthState.modSustain,
            release: this.synthState.modRelease,
          },
        });

      case "fm_poly":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: this.synthState.harmonicity,
          modulationIndex: this.synthState.modulationIndex,
          envelope: commonEnvelope,
          modulation: { type: "sine" },
          modulationEnvelope: {
            attack: this.synthState.modAttack,
            decay: this.synthState.modDecay,
            sustain: this.synthState.modSustain,
            release: this.synthState.modRelease,
          },
        });

      default:
        return new Tone.Synth({
          envelope: commonEnvelope,
        });
    }
  }

  async updateSynthParams(params: Partial<SynthState>): Promise<void> {
    if (this.config.category !== InstrumentCategory.Synthesizer) {
      console.warn(
        `❌ Attempted to update synth params for non-synthesizer instrument: ${this.config.instrumentName}`,
      );
      return;
    }

    // Update local state
    const prevState = { ...this.synthState };
    this.synthState = { ...this.synthState, ...params };

    // Initialize synthesizer if not already done
    if (!this.synthRef) {
      try {
        await this.initializeSynthesizer();
      } catch (error) {
        console.error(
          `❌ Failed to initialize synthesizer for parameter update:`,
          error,
        );
        this.synthState = prevState;
        return;
      }
    }

    // Apply parameters
    try {
      this.throttledParamUpdate(params);

      // Notify callback for network synchronization (local user only)
      if (this.config.isLocalUser && this.config.onSynthParamsChange) {
        this.config.onSynthParamsChange(params);
      }
    } catch (error) {
      console.error(`❌ Failed to apply synthesizer parameters:`, error);
      this.synthState = prevState;
    }
  }

  private updateSynthParamsInternal(params: Partial<SynthState>): void {
    if (!this.synthRef || !this.filterRef || !this.gainRef) {
      return;
    }

    try {
      const synth = this.synthRef as any;

      // Update volume
      if (params.volume !== undefined) {
        this.gainRef.gain.value = params.volume;
      }

      // Update filter parameters
      if (params.filterFrequency !== undefined) {
        this.filterRef.frequency.value = params.filterFrequency;
        if (this.filterEnvelopeRef) {
          this.filterEnvelopeRef.baseFrequency = params.filterFrequency;
        }
      }
      if (params.filterResonance !== undefined) {
        this.filterRef.Q.value = params.filterResonance;
      }

      // Update filter envelope
      if (this.filterEnvelopeRef) {
        if (params.filterAttack !== undefined)
          this.filterEnvelopeRef.attack = params.filterAttack;
        if (params.filterDecay !== undefined)
          this.filterEnvelopeRef.decay = params.filterDecay;
        if (params.filterSustain !== undefined)
          this.filterEnvelopeRef.sustain = params.filterSustain;
        if (params.filterRelease !== undefined)
          this.filterEnvelopeRef.release = params.filterRelease;
      }

      // Handle PolySynth vs mono synth updates
      if (synth instanceof Tone.PolySynth) {
        this.updatePolySynthParams(synth, params);
      } else {
        this.updateMonoSynthParams(synth, params);
      }
    } catch (error) {
      console.error("Error updating synth parameters:", error);
    }
  }

  private updatePolySynthParams(synth: any, params: Partial<SynthState>): void {
    // Update default options for new voices
    const updates: any = {};

    if (params.oscillatorType) {
      updates.oscillator = { type: params.oscillatorType as any };
    }

    const envelopeParams: any = {};
    if (params.ampAttack !== undefined)
      envelopeParams.attack = params.ampAttack;
    if (params.ampDecay !== undefined) envelopeParams.decay = params.ampDecay;
    if (params.ampSustain !== undefined)
      envelopeParams.sustain = params.ampSustain;
    if (params.ampRelease !== undefined)
      envelopeParams.release = params.ampRelease;

    if (Object.keys(envelopeParams).length > 0) {
      updates.envelope = envelopeParams;
    }

    // FM parameters
    if (params.modulationIndex !== undefined) {
      updates.modulationIndex = params.modulationIndex;
    }
    if (params.harmonicity !== undefined) {
      updates.harmonicity = params.harmonicity;
    }

    const modEnvelopeParams: any = {};
    if (params.modAttack !== undefined)
      modEnvelopeParams.attack = params.modAttack;
    if (params.modDecay !== undefined)
      modEnvelopeParams.decay = params.modDecay;
    if (params.modSustain !== undefined)
      modEnvelopeParams.sustain = params.modSustain;
    if (params.modRelease !== undefined)
      modEnvelopeParams.release = params.modRelease;

    if (Object.keys(modEnvelopeParams).length > 0) {
      updates.modulationEnvelope = modEnvelopeParams;
    }

    if (Object.keys(updates).length > 0) {
      synth.set(updates);
    }

    // Update existing voices
    if (synth.voices && Array.isArray(synth.voices)) {
      synth.voices.forEach((voice: any) => {
        this.updateVoiceParams(voice, params);
      });
    }
  }

  private updateMonoSynthParams(synth: any, params: Partial<SynthState>): void {
    // Update oscillator
    if (params.oscillatorType && synth.oscillator) {
      synth.oscillator.type = params.oscillatorType as any;
    }

    // Update amplitude envelope
    if (synth.envelope) {
      if (params.ampAttack !== undefined)
        synth.envelope.attack = params.ampAttack;
      if (params.ampDecay !== undefined) synth.envelope.decay = params.ampDecay;
      if (params.ampSustain !== undefined)
        synth.envelope.sustain = params.ampSustain;
      if (params.ampRelease !== undefined)
        synth.envelope.release = params.ampRelease;
    }

    // Update FM parameters
    if (params.modulationIndex !== undefined && synth.modulationIndex) {
      synth.modulationIndex.value = params.modulationIndex;
    }
    if (params.harmonicity !== undefined && synth.harmonicity) {
      synth.harmonicity.value = params.harmonicity;
    }

    // Update FM modulation envelope
    if (synth.modulationEnvelope) {
      if (params.modAttack !== undefined)
        synth.modulationEnvelope.attack = params.modAttack;
      if (params.modDecay !== undefined)
        synth.modulationEnvelope.decay = params.modDecay;
      if (params.modSustain !== undefined)
        synth.modulationEnvelope.sustain = params.modSustain;
      if (params.modRelease !== undefined)
        synth.modulationEnvelope.release = params.modRelease;
    }
  }

  private updateVoiceParams(voice: any, params: Partial<SynthState>): void {
    if (params.oscillatorType && voice.oscillator) {
      voice.oscillator.type = params.oscillatorType;
    }
    if (voice.envelope) {
      if (params.ampAttack !== undefined)
        voice.envelope.attack = params.ampAttack;
      if (params.ampDecay !== undefined) voice.envelope.decay = params.ampDecay;
      if (params.ampSustain !== undefined)
        voice.envelope.sustain = params.ampSustain;
      if (params.ampRelease !== undefined)
        voice.envelope.release = params.ampRelease;
    }
    if (params.modulationIndex !== undefined && voice.modulationIndex) {
      voice.modulationIndex.value = params.modulationIndex;
    }
    if (params.harmonicity !== undefined && voice.harmonicity) {
      voice.harmonicity.value = params.harmonicity;
    }
    if (voice.modulationEnvelope) {
      if (params.modAttack !== undefined)
        voice.modulationEnvelope.attack = params.modAttack;
      if (params.modDecay !== undefined)
        voice.modulationEnvelope.decay = params.modDecay;
      if (params.modSustain !== undefined)
        voice.modulationEnvelope.sustain = params.modSustain;
      if (params.modRelease !== undefined)
        voice.modulationEnvelope.release = params.modRelease;
    }
  }

  async playNotes(
    notes: string[],
    velocity: number,
    isKeyHeld: boolean = false,
  ): Promise<void> {
    if (!this.isReady()) {
      await this.load();
    }

    if (this.config.category === InstrumentCategory.Synthesizer) {
      // Filter out drum notes for synthesizers - only allow musical note names
      const musicalNotes = notes.filter(note => this.isMusicalNote(note));
      if (musicalNotes.length !== notes.length) {
        console.log(`🎹 Synthesizer: filtered out ${notes.length - musicalNotes.length} drum notes, playing ${musicalNotes.length} musical notes:`, musicalNotes);
      }
      await this.playSynthNotes(musicalNotes, velocity, isKeyHeld);
    } else {
      await this.playTraditionalNotes(notes, velocity, isKeyHeld);
    }
  }

  private async playSynthNotes(
    notes: string[],
    velocity: number,
    isKeyHeld: boolean,
  ): Promise<void> {
    if (!this.synthRef) return;

    if (!Array.isArray(notes)) {
      console.error("playSynthNotes received non-array notes:", notes);
      notes = [notes as string];
    }

    notes.forEach((note) => {
      // Clear pending releases/stops
      this.clearPendingNote(note);

      if (this.synthRef instanceof Tone.PolySynth) {
        this.playPolySynthNote(note, velocity, isKeyHeld);
      } else {
        this.playMonoSynthNote(note, velocity, isKeyHeld);
      }
    });
  }

  private playPolySynthNote(
    note: string,
    velocity: number,
    isKeyHeld: boolean,
  ): void {
    try {
      // Check polyphony limit
      const maxPolyphony = this.getMaxPolyphony();
      
      // More aggressive cleanup when approaching polyphony limit
      if (this.activeNotes.size >= maxPolyphony) {
        // Stop multiple oldest notes to make room for chords
        const notesToRemove = Math.max(1, Math.ceil(maxPolyphony * 0.2)); // Remove 20% of capacity
        const oldestNotes = Array.from(this.activeNotes.keys()).slice(0, notesToRemove);
        
        oldestNotes.forEach((oldNote) => {
          try {
            this.synthRef.triggerRelease(oldNote, Tone.now());
            this.activeNotes.delete(oldNote);
            this.sustainedNotes.delete(oldNote);
            this.keyHeldNotes.delete(oldNote);
          } catch (error) {
            console.warn(`Failed to release old note ${oldNote}:`, error);
          }
        });
        
        console.log(`🎹 Polyphony cleanup: removed ${notesToRemove} notes, ${this.activeNotes.size} remaining`);
      }

      // Release existing note to avoid stacking - more thorough cleanup
      if (this.activeNotes.has(note)) {
        try {
          this.synthRef.triggerRelease(note, Tone.now());
        } catch (error) {
          console.warn(`Failed to release existing note ${note}:`, error);
        }
        this.activeNotes.delete(note);
        this.sustainedNotes.delete(note);
        this.keyHeldNotes.delete(note);
      }

      // Clear any pending timeouts for this note
      this.clearPendingNote(note);

      // Trigger the new note with additional error handling
      try {
        this.synthRef.triggerAttack(note, Tone.now(), velocity);
      } catch (error) {
        console.warn(`Failed to trigger attack for note ${note}:`, error);
        // If triggerAttack fails, don't continue with tracking
        return;
      }
      
      // Store cleanup function for this note
      this.activeNotes.set(note, () => {
        try {
          if (this.synthRef && this.synthRef instanceof Tone.PolySynth) {
            this.synthRef.triggerRelease(note, Tone.now());
          }
        } catch (error) {
          console.warn(`Failed to release note ${note} in cleanup:`, error);
        }
      });

      // Track notes
      if (isKeyHeld) {
        this.keyHeldNotes.add(note);
      }
      if (this.sustain && !isKeyHeld) {
        this.sustainedNotes.add(note);
      }

      // Trigger filter envelope
      if (
        this.filterEnvelopeRef &&
        this.config.instrumentName.startsWith("analog_")
      ) {
        if (this.filterEnvelopeActive) {
          this.filterEnvelopeRef.triggerRelease(Tone.now());
        }
        setTimeout(() => {
          if (this.filterEnvelopeRef) {
            this.filterEnvelopeRef.triggerAttack(Tone.now(), velocity);
            this.filterEnvelopeActive = true;
          }
        }, 10);
      }

      // Auto-stop non-held notes if sustain is off - with improved cleanup for sequencer
      if (!isKeyHeld && !this.sustain) {
        // Shorter timeout for sequencer-triggered notes to prevent accumulation
        const autoReleaseTime = this.isWebRTCOptimized ? 150 : 250;
        
        const releaseTimeout = setTimeout(() => {
          if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
            try {
              this.synthRef.triggerRelease(note, Tone.now());
              this.activeNotes.delete(note);
              this.sustainedNotes.delete(note);
            } catch (error) {
              console.warn(`Failed to auto-release note ${note}:`, error);
              // Force cleanup even if release fails
              this.activeNotes.delete(note);
              this.sustainedNotes.delete(note);
            }
          }
          this.pendingReleases.delete(note);
        }, autoReleaseTime);
        
        // Store timeout for potential cancellation
        this.pendingReleases.set(note, releaseTimeout as unknown as number);
        
        // Additional emergency cleanup for sequencer-triggered chords
        const emergencyTimeout = autoReleaseTime + 750; // Extra buffer for chords
        setTimeout(() => {
          if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
            console.warn(`🎹 Emergency cleanup: force stopping stuck note ${note}`);
            try {
              this.synthRef.triggerRelease(note, Tone.now());
            } catch (error) {
              console.warn(`Emergency release failed for note ${note}:`, error);
            }
            this.activeNotes.delete(note);
            this.sustainedNotes.delete(note);
            this.clearPendingNote(note);
          }
        }, emergencyTimeout);
      }
    } catch (error) {
      console.warn("Error triggering poly synth note:", error);
      // Force cleanup on error to prevent stuck notes
      this.activeNotes.delete(note);
      this.sustainedNotes.delete(note);
      this.keyHeldNotes.delete(note);
      this.clearPendingNote(note);
    }
  }

  private playMonoSynthNote(
    note: string,
    velocity: number,
    isKeyHeld: boolean,
  ): void {
    try {
      if (isKeyHeld) {
        this.keyHeldNotes.add(note);
      }

      this.addToNoteStack(note);
      const topNote = this.getTopNote();

      if (topNote === note) {
        if (this.currentNote) {
          this.synthRef.setNote(note);
          this.activeNotes.delete(this.currentNote);
        } else {
          this.synthRef.triggerAttack(note, undefined, velocity);
          if (this.filterEnvelopeRef) {
            this.filterEnvelopeRef.triggerAttack();
            this.filterEnvelopeActive = true;
          }
        }

        this.currentNote = note;
        this.activeNotes.set(note, () => this.handleMonoSynthRelease(note));

        if (this.sustain && !isKeyHeld) {
          this.sustainedNotes.add(note);
        }

        if (!isKeyHeld && !this.sustain) {
          setTimeout(() => {
            if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
              this.handleMonoSynthRelease(note);
            }
          }, 300);
        }
      }
    } catch (error) {
      console.warn("Error triggering mono synth note:", error);
    }
  }

  private async playTraditionalNotes(
    notes: string[],
    velocity: number,
    isKeyHeld: boolean,
  ): Promise<void> {
    if (!this.instrument) return;

    if (!Array.isArray(notes)) {
      console.error("playTraditionalNotes received non-array notes:", notes);
      notes = [notes as string];
    }

    notes.forEach((note) => {
      // Stop existing note
      const existingNote = this.activeNotes.get(note);
      if (existingNote) {
        if (typeof existingNote === "function") {
          existingNote();
        } else if (existingNote.stop) {
          existingNote.stop();
        }
        this.activeNotes.delete(note);
      }

      const scaledVelocity = Math.round(
        Math.max(1, Math.min(127, velocity * 127)),
      );

      const playedNote = this.instrument.start({
        note: note,
        velocity: scaledVelocity,
        time: this.audioContext!.currentTime + 0.001,
      });

      if (playedNote) {
        this.activeNotes.set(note, playedNote);

        if (isKeyHeld) {
          this.keyHeldNotes.add(note);
        }
        if (this.sustain && !isKeyHeld) {
          this.sustainedNotes.add(playedNote);
        }

        // Auto cleanup for drums
        if (this.config.category === InstrumentCategory.DrumBeat) {
          setTimeout(() => {
            if (this.activeNotes.get(note) === playedNote) {
              this.activeNotes.delete(note);
            }
          }, 5000);
        }

        // Auto-stop non-held notes
        if (!isKeyHeld && !this.sustain) {
          setTimeout(() => {
            if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
              if (typeof playedNote === "function") {
                playedNote();
              } else if (playedNote.stop) {
                playedNote.stop();
              }
              this.activeNotes.delete(note);
            }
          }, 300);
        }
      }
    });
  }

  // Get all active notes
  getAllActiveNotes(): string[] {
    return Array.from(this.activeNotes.keys());
  }

  // Stop all active notes
  async stopAllNotes(): Promise<void> {
    if (!this.isReady()) return;

    const allNotes = this.getAllActiveNotes();
    if (allNotes.length > 0) {
      await this.stopNotes(allNotes);
    }
  }

  // Emergency cleanup method for stuck sounds - force reset everything
  emergencyCleanup(): void {
    console.warn("🆘 Emergency cleanup triggered - forcing stop of all notes and resetting synthesizer");
    
    try {
      // Clear all tracking
      this.activeNotes.clear();
      this.sustainedNotes.clear();
      this.keyHeldNotes.clear();
      this.pendingReleases.clear();
      this.pendingStop.clear();
      this.noteStack = [];
      this.currentNote = null;
      
      // Force release all notes from synthesizer
      if (this.synthRef && this.config.category === InstrumentCategory.Synthesizer) {
        try {
          if (this.synthRef instanceof Tone.PolySynth) {
            // For PolySynth, release all voices
            this.synthRef.releaseAll();
          } else {
            // For MonoSynth, trigger release
            this.synthRef.triggerRelease();
          }
        } catch (error) {
          console.warn("Failed to release synthesizer notes during emergency cleanup:", error);
        }
        
        // Reset filter envelope
        if (this.filterEnvelopeRef && this.filterEnvelopeActive) {
          try {
            this.filterEnvelopeRef.triggerRelease(Tone.now());
            this.filterEnvelopeActive = false;
          } catch (error) {
            console.warn("Failed to reset filter envelope during emergency cleanup:", error);
          }
        }
      }
      
      console.log("✅ Emergency cleanup completed");
    } catch (error) {
      console.error("Error during emergency cleanup:", error);
      // Even if emergency cleanup fails, clear the tracking
      this.activeNotes.clear();
      this.sustainedNotes.clear();
      this.keyHeldNotes.clear();
      this.pendingReleases.clear();
      this.pendingStop.clear();
    }
  }

  async stopNotes(notes: string[]): Promise<void> {
    if (!this.isReady()) return;

    if (this.config.category === InstrumentCategory.Synthesizer) {
      // Filter out drum notes for synthesizers - only stop musical notes
      const musicalNotes = notes.filter(note => this.isMusicalNote(note));
      await this.stopSynthNotes(musicalNotes);
    } else {
      await this.stopTraditionalNotes(notes);
    }
  }

  private async stopSynthNotes(notes: string[]): Promise<void> {
    if (!Array.isArray(notes)) {
      console.error("stopSynthNotes received non-array notes:", notes);
      notes = [notes as string];
    }

    notes.forEach((note) => {
      const isKeyHeld = this.keyHeldNotes.has(note);

      if (isKeyHeld) {
        this.keyHeldNotes.delete(note);

        if (this.sustain) {
          this.sustainedNotes.add(note);
        } else {
          if (this.synthRef instanceof Tone.PolySynth) {
            this.synthRef.triggerRelease(note, Tone.now());
            this.activeNotes.delete(note);
          } else {
            this.handleMonoSynthRelease(note);
          }
        }
      } else {
        if (this.synthRef instanceof Tone.PolySynth) {
          this.synthRef.triggerRelease(note, Tone.now());
        } else {
          this.handleMonoSynthRelease(note);
        }
        this.sustainedNotes.delete(note);
        this.activeNotes.delete(note);
      }
    });
  }

  private async stopTraditionalNotes(notes: string[]): Promise<void> {
    // Safety check: ensure notes is an array
    if (!Array.isArray(notes)) {
      console.error(
        "stopTraditionalNotes received non-array:",
        notes,
        "Converting to array",
      );
      notes = [notes as string];
    }

    notes.forEach((note) => {
      const activeNote = this.activeNotes.get(note);
      if (activeNote) {
        const isKeyHeld = this.keyHeldNotes.has(note);

        if (isKeyHeld) {
          this.keyHeldNotes.delete(note);

          if (this.sustain) {
            this.sustainedNotes.add(activeNote);
          } else {
            if (typeof activeNote === "function") {
              activeNote();
            }
            this.activeNotes.delete(note);
          }
        } else {
          if (typeof activeNote === "function") {
            activeNote();
          }
          this.activeNotes.delete(note);
          this.sustainedNotes.delete(activeNote);
        }
      }
    });
  }

  setSustain(sustain: boolean): void {
    this.sustain = sustain;

    if (!sustain) {
      this.stopSustainedNotes();
    }
  }

  private stopSustainedNotes(): void {
    if (this.config.category === InstrumentCategory.Synthesizer) {
      this.sustainedNotes.forEach((note) => {
        if (this.synthRef instanceof Tone.PolySynth) {
          this.synthRef.triggerRelease(note, Tone.now());
        } else if (this.keyHeldNotes.size === 0) {
          this.synthRef.triggerRelease();
          if (this.filterEnvelopeRef && this.filterEnvelopeActive) {
            this.filterEnvelopeRef.triggerRelease(Tone.now());
            this.filterEnvelopeActive = false;
          }
        }
      });
    } else {
      this.sustainedNotes.forEach((note) => {
        if (typeof note === "function") {
          note();
        }
      });
    }
    this.sustainedNotes.clear();
  }

  // Helper methods for mono synth note stack management
  private addToNoteStack(note: string): void {
    this.noteStack = this.noteStack.filter((n) => n !== note);
    this.noteStack.push(note);
  }

  private removeFromNoteStack(note: string): void {
    this.noteStack = this.noteStack.filter((n) => n !== note);
  }

  private getTopNote(): string | null {
    return this.noteStack.length > 0
      ? this.noteStack[this.noteStack.length - 1]
      : null;
  }

  private handleMonoSynthRelease(noteToRelease: string): void {
    if (!this.synthRef || this.synthRef instanceof Tone.PolySynth) return;

    this.activeNotes.delete(noteToRelease);
    this.removeFromNoteStack(noteToRelease);

    const wasKeyHeld = this.keyHeldNotes.has(noteToRelease);
    if (wasKeyHeld) {
      this.keyHeldNotes.delete(noteToRelease);
    }

    const remainingHeldKeys = Array.from(this.keyHeldNotes);

    if (remainingHeldKeys.length > 0) {
      const mostRecentHeldKey = remainingHeldKeys[remainingHeldKeys.length - 1];
      try {
        this.synthRef.setNote(mostRecentHeldKey);
        this.currentNote = mostRecentHeldKey;
        this.activeNotes.set(mostRecentHeldKey, () =>
          this.handleMonoSynthRelease(mostRecentHeldKey),
        );

        if (
          this.filterEnvelopeRef &&
          this.config.instrumentName.startsWith("analog_")
        ) {
          this.filterEnvelopeRef.triggerAttack(Tone.now(), 0.7);
        }
      } catch (error) {
        console.warn(
          `Error retriggering held key ${mostRecentHeldKey}:`,
          error,
        );
      }
    } else {
      this.synthRef.triggerRelease();
      this.currentNote = null;

      if (this.filterEnvelopeRef && this.filterEnvelopeActive) {
        this.filterEnvelopeRef.triggerRelease(Tone.now());
        this.filterEnvelopeActive = false;
      }
    }
  }

  private clearPendingNote(note: string): void {
    const releaseTimeout = this.pendingReleases.get(note);
    if (releaseTimeout) {
      clearTimeout(releaseTimeout);
      this.pendingReleases.delete(note);
    }

    const stopTimeout = this.pendingStop.get(note);
    if (stopTimeout) {
      clearTimeout(stopTimeout);
      this.pendingStop.delete(note);
    }
  }

  updateInstrument(instrumentName: string, category: InstrumentCategory): void {
    // Stop all active notes
    this.activeNotes.forEach((stopFunction) => {
      try {
        if (typeof stopFunction === "function") {
          stopFunction();
        }
      } catch (error) {
        console.error("Error stopping active note during update:", error);
      }
    });

    // Store current synth parameters before cleanup (for synthesizers)
    const currentSynthParams =
      category === InstrumentCategory.Synthesizer
        ? { ...this.synthState }
        : null;

    this.cleanup();

    // Update config
    this.config.instrumentName = instrumentName;
    this.config.category = category;

    // Reset state
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;

    // Restore synth parameters after instrument change (for synthesizers)
    if (currentSynthParams && category === InstrumentCategory.Synthesizer) {
      this.synthState = { ...currentSynthParams };
      console.log(
        "🎛️ Preserved synth parameters during instrument change:",
        currentSynthParams,
      );
    }
  }

  private cleanup(): void {
    // Clear all note tracking
    this.activeNotes.clear();
    this.sustainedNotes.clear();
    this.keyHeldNotes.clear();
    this.noteStack = [];
    this.currentNote = null;
    this.filterEnvelopeActive = false;

    // Clear timeouts
    this.pendingReleases.forEach((timeout) => clearTimeout(timeout));
    this.pendingReleases.clear();
    this.pendingStop.forEach((timeout) => clearTimeout(timeout));
    this.pendingStop.clear();

    // Clear audio buffer cache
    this.clearAudioBufferCache();

    // Dispose instruments
    if (this.instrument && this.instrument.disconnect) {
      try {
        this.instrument.disconnect();
      } catch (error) {
        console.error("Error disconnecting traditional instrument:", error);
      }
    }

    if (this.synthRef) {
      try {
        this.synthRef.dispose();
      } catch (error) {
        console.error("Error disposing synthesizer:", error);
      }
    }

    if (this.filterRef) {
      try {
        this.filterRef.dispose();
      } catch (error) {
        console.error("Error disposing filter:", error);
      }
    }

    if (this.filterEnvelopeRef) {
      try {
        this.filterEnvelopeRef.dispose();
      } catch (error) {
        console.error("Error disposing filter envelope:", error);
      }
    }

    if (this.gainRef) {
      try {
        this.gainRef.dispose();
      } catch (error) {
        console.error("Error disposing gain:", error);
      }
    }

    // Reset references
    this.instrument = null;
    this.synthRef = null;
    this.filterRef = null;
    this.filterEnvelopeRef = null;
    this.gainRef = null;
  }

  // WebRTC performance optimization methods
  setWebRTCOptimization(enabled: boolean): void {
    this.isWebRTCOptimized = enabled;

    if (enabled) {
      console.log(
        `🎵 InstrumentEngine: Enabling WebRTC optimization for ${this.config.username}`,
      );
      // Reduce update frequency for better performance
      this.throttledParamUpdate = throttle((params: Partial<SynthState>) => {
        this.updateSynthParamsInternal(params);
      }, 16); // Slower updates when WebRTC is active
    } else {
      console.log(
        `🎵 InstrumentEngine: Disabling WebRTC optimization for ${this.config.username}`,
      );
      // Restore normal update frequency
      this.throttledParamUpdate = throttle((params: Partial<SynthState>) => {
        this.updateSynthParamsInternal(params);
      }, 8); // Normal update speed
    }
  }

  getMaxPolyphony(): number {
    if (this.isWebRTCOptimized) {
      return 16; // Reduced polyphony when WebRTC is active
    }
    return 32; // Normal polyphony
  }

  /**
   * Check if a note string is a valid musical note (not a drum sample)
   * Musical notes have the format: Letter + optional accidental + octave number
   * Examples: C4, F#3, Bb2, etc.
   */
  private isMusicalNote(note: string): boolean {
    // Pattern: Letter (A-G) + optional sharp/flat (# or b) + digit(s)
    const musicalNotePattern = /^[A-Ga-g][#b]?\d+$/;
    return musicalNotePattern.test(note);
  }

  dispose(): void {
    // Clean up processing timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }

    // Clean up note processing queue
    this.noteProcessingQueue.clear();

    this.cleanup();
  }
}
