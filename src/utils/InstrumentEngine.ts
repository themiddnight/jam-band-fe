import { Soundfont, DrumMachine } from 'smplr';
import * as Tone from 'tone';
import { InstrumentCategory } from '../constants/instruments';
import { getSafariLoadTimeout, handleSafariAudioError } from './webkitCompat';
import { getOptimalAudioConfig } from '../constants/audioConfig';
import { throttle } from './performanceUtils';

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
  private noteProcessingQueue = new Map<string, { action: 'play' | 'stop'; timestamp: number }>();
  private readonly PROCESSING_INTERVAL = 8; // ~120fps for audio processing
  private processingTimeout: ReturnType<typeof setTimeout> | null = null;

  // Throttled parameter updates for better performance
  private throttledParamUpdate = throttle((params: Partial<SynthState>) => {
    this.updateSynthParamsInternal(params);
  }, 16); // ~60fps
  
  constructor(config: InstrumentEngineConfig) {
    this.config = config;
    this.throttledParamUpdate = throttle(this.updateSynthParamsInternal.bind(this), 16);
  }

  // Process note queue for better performance
  private processNoteQueue(): void {
    if (this.noteProcessingQueue.size === 0) return;

    const notesToProcess = new Map<string, { action: 'play' | 'stop'; timestamp: number }>();

    // Collect notes to process
    this.noteProcessingQueue.forEach((value, key) => {
      notesToProcess.set(key, value);
    });

    // Clear the queue
    this.noteProcessingQueue.clear();

    // Process notes by action type for better efficiency
    const playNotes: string[] = [];
    const stopNotes: string[] = [];

    notesToProcess.forEach((value, note) => {
      if (value.action === 'play') {
        playNotes.push(note);
      } else {
        stopNotes.push(note);
      }
    });

    // Batch process play notes
    if (playNotes.length > 0) {
      this.processPlayNotes(playNotes);
    }

    // Batch process stop notes
    if (stopNotes.length > 0) {
      this.processStopNotes(stopNotes);
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
    this.processingTimeout = setTimeout(() => this.processNoteQueue(), this.PROCESSING_INTERVAL);
  }

  // Process multiple play notes efficiently
  private processPlayNotes(notes: string[]): void {
    if (this.config.category === InstrumentCategory.Synthesizer) {
      notes.forEach(note => this.playPolySynthNote(note, 0.7, false));
    } else {
      // For traditional instruments, process in smaller batches
      const batchSize = 5;
      for (let i = 0; i < notes.length; i += batchSize) {
        const batch = notes.slice(i, i + batchSize);
        this.playTraditionalNotesBatch(batch, 0.7);
      }
    }
  }

  // Process multiple stop notes efficiently
  private processStopNotes(notes: string[]): void {
    if (this.config.category === InstrumentCategory.Synthesizer) {
      notes.forEach(note => this.stopSynthNotes([note]));
    } else {
      // For traditional instruments, process in smaller batches
      const batchSize = 5;
      for (let i = 0; i < notes.length; i += batchSize) {
        const batch = notes.slice(i, i + batchSize);
        this.stopTraditionalNotesBatch(batch);
      }
    }
  }

  // Batch play traditional notes
  private async playTraditionalNotesBatch(notes: string[], velocity: number): Promise<void> {
    if (!this.instrument || !this.isLoaded) return;

    try {
      await Promise.all(notes.map(note => 
        this.instrument.start({ note, velocity, duration: 1 })
      ));
    } catch (error) {
      console.error('Error playing traditional notes batch:', error);
    }
  }

  // Batch stop traditional notes
  private async stopTraditionalNotesBatch(notes: string[]): Promise<void> {
    if (!this.instrument || !this.isLoaded) return;

    try {
      await Promise.all(notes.map(note => 
        this.instrument.stop({ note })
      ));
    } catch (error) {
      console.error('Error stopping traditional notes batch:', error);
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
    return this.isLoaded && (this.instrument !== null || this.synthRef !== null);
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
    if (this.config.category === InstrumentCategory.DrumBeat && this.instrument && this.instrument.getSampleNames) {
      try {
        return this.instrument.getSampleNames();
      } catch (error) {
        console.warn(`Failed to get samples from drum machine: ${error}`);
        return [];
      }
    }
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
      console.log(`⏳ Instrument ${this.config.instrumentName} already loading for ${this.config.username}, waiting for existing load...`);
      return this.loadPromise;
    }

    this.isLoading = true;
    console.log(`🎵 Starting to load ${this.config.instrumentName} (${this.config.category}) for ${this.config.isLocalUser ? 'local' : 'remote'} user ${this.config.username}`);
    
    this.loadPromise = this._loadInstrument();
    
    try {
      const result = await this.loadPromise;
      this.isLoaded = true;
      console.log(`✅ Successfully loaded ${this.config.instrumentName} for ${this.config.username}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to load ${this.config.instrumentName} for ${this.config.username}:`, error);
      throw error;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async _loadInstrument(): Promise<any> {
    if (!this.audioContext || this.audioContext.state !== 'running') {
      throw new Error('AudioContext not ready');
    }

    try {
      if (this.config.category === InstrumentCategory.Synthesizer) {
        await this.initializeSynthesizer();
        return this.synthRef;
      } else {
        return await this.loadTraditionalInstrument();
      }
    } catch (error) {
      console.error(`Failed to load instrument ${this.config.instrumentName} for user ${this.config.username}:`, error);
      throw error;
    }
  }

  private async loadTraditionalInstrument(): Promise<any> {
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
        reject(new Error(`Instrument loading timed out after ${loadTimeout}ms`));
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
    
    console.log(`Loaded ${this.config.category} instrument ${this.config.instrumentName} for ${this.config.isLocalUser ? 'local' : 'remote'} user ${this.config.username}`);
    return newInstrument;
  }

  private async initializeSynthesizer(): Promise<void> {
    if (this.synthRef) {
      return; // Already initialized
    }

    try {
      await Tone.start();
      
      const audioConfig = getOptimalAudioConfig();
      Tone.context.lookAhead = audioConfig.TONE_CONTEXT.lookAhead;
      Tone.Transport.scheduleRepeat(() => {}, audioConfig.TONE_CONTEXT.updateInterval);
      
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

      console.log(`Initialized Tone.js synthesizer ${this.config.instrumentName} for ${this.config.isLocalUser ? 'local' : 'remote'} user ${this.config.username}`);
      
      // Ensure all current synth parameters are applied to the new synthesizer
      if (this.synthRef) {
        this.updateSynthParamsInternal(this.synthState);
      }
    } catch (error) {
      console.error(`Failed to initialize synthesizer for user ${this.config.username}:`, error);
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
      type: this.synthState.oscillatorType as any 
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
      console.warn(`❌ Attempted to update synth params for non-synthesizer instrument: ${this.config.instrumentName}`);
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
        console.error(`❌ Failed to initialize synthesizer for parameter update:`, error);
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
        if (params.filterAttack !== undefined) this.filterEnvelopeRef.attack = params.filterAttack;
        if (params.filterDecay !== undefined) this.filterEnvelopeRef.decay = params.filterDecay;
        if (params.filterSustain !== undefined) this.filterEnvelopeRef.sustain = params.filterSustain;
        if (params.filterRelease !== undefined) this.filterEnvelopeRef.release = params.filterRelease;
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
    if (params.ampAttack !== undefined) envelopeParams.attack = params.ampAttack;
    if (params.ampDecay !== undefined) envelopeParams.decay = params.ampDecay;
    if (params.ampSustain !== undefined) envelopeParams.sustain = params.ampSustain;
    if (params.ampRelease !== undefined) envelopeParams.release = params.ampRelease;
    
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
    if (params.modAttack !== undefined) modEnvelopeParams.attack = params.modAttack;
    if (params.modDecay !== undefined) modEnvelopeParams.decay = params.modDecay;
    if (params.modSustain !== undefined) modEnvelopeParams.sustain = params.modSustain;
    if (params.modRelease !== undefined) modEnvelopeParams.release = params.modRelease;
    
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
      if (params.ampAttack !== undefined) synth.envelope.attack = params.ampAttack;
      if (params.ampDecay !== undefined) synth.envelope.decay = params.ampDecay;
      if (params.ampSustain !== undefined) synth.envelope.sustain = params.ampSustain;
      if (params.ampRelease !== undefined) synth.envelope.release = params.ampRelease;
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
      if (params.modAttack !== undefined) synth.modulationEnvelope.attack = params.modAttack;
      if (params.modDecay !== undefined) synth.modulationEnvelope.decay = params.modDecay;
      if (params.modSustain !== undefined) synth.modulationEnvelope.sustain = params.modSustain;
      if (params.modRelease !== undefined) synth.modulationEnvelope.release = params.modRelease;
    }
  }

  private updateVoiceParams(voice: any, params: Partial<SynthState>): void {
    if (params.oscillatorType && voice.oscillator) {
      voice.oscillator.type = params.oscillatorType;
    }
    if (voice.envelope) {
      if (params.ampAttack !== undefined) voice.envelope.attack = params.ampAttack;
      if (params.ampDecay !== undefined) voice.envelope.decay = params.ampDecay;
      if (params.ampSustain !== undefined) voice.envelope.sustain = params.ampSustain;
      if (params.ampRelease !== undefined) voice.envelope.release = params.ampRelease;
    }
    if (params.modulationIndex !== undefined && voice.modulationIndex) {
      voice.modulationIndex.value = params.modulationIndex;
    }
    if (params.harmonicity !== undefined && voice.harmonicity) {
      voice.harmonicity.value = params.harmonicity;
    }
    if (voice.modulationEnvelope) {
      if (params.modAttack !== undefined) voice.modulationEnvelope.attack = params.modAttack;
      if (params.modDecay !== undefined) voice.modulationEnvelope.decay = params.modDecay;
      if (params.modSustain !== undefined) voice.modulationEnvelope.sustain = params.modSustain;
      if (params.modRelease !== undefined) voice.modulationEnvelope.release = params.modRelease;
    }
  }

  async playNotes(notes: string[], velocity: number, isKeyHeld: boolean = false): Promise<void> {
    if (!this.isReady()) {
      await this.load();
    }

    if (this.config.category === InstrumentCategory.Synthesizer) {
      await this.playSynthNotes(notes, velocity, isKeyHeld);
    } else {
      await this.playTraditionalNotes(notes, velocity, isKeyHeld);
    }
  }

  private async playSynthNotes(notes: string[], velocity: number, isKeyHeld: boolean): Promise<void> {
    if (!this.synthRef) return;

    notes.forEach(note => {
      // Clear pending releases/stops
      this.clearPendingNote(note);
      
      if (this.synthRef instanceof Tone.PolySynth) {
        this.playPolySynthNote(note, velocity, isKeyHeld);
      } else {
        this.playMonoSynthNote(note, velocity, isKeyHeld);
      }
    });
  }

  private playPolySynthNote(note: string, velocity: number, isKeyHeld: boolean): void {
    try {
      // Release existing note to avoid stacking
      if (this.activeNotes.has(note)) {
        this.synthRef.triggerRelease(note, Tone.now());
        this.activeNotes.delete(note);
        this.sustainedNotes.delete(note);
      }
      
      this.synthRef.triggerAttack(note, Tone.now(), velocity);
      this.activeNotes.set(note, () => {
        this.synthRef.triggerRelease(note, Tone.now());
      });
      
      // Track notes
      if (isKeyHeld) {
        this.keyHeldNotes.add(note);
      }
      if (this.sustain && !isKeyHeld) {
        this.sustainedNotes.add(note);
      }
      
      // Trigger filter envelope
      if (this.filterEnvelopeRef && this.config.instrumentName.startsWith("analog_")) {
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
      
      // Auto-stop non-held notes if sustain is off
      if (!isKeyHeld && !this.sustain) {
        setTimeout(() => {
          if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
            this.synthRef.triggerRelease(note, Tone.now());
            this.activeNotes.delete(note);
          }
        }, 300);
      }
    } catch (error) {
      console.warn("Error triggering poly synth note:", error);
    }
  }

  private playMonoSynthNote(note: string, velocity: number, isKeyHeld: boolean): void {
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

  private async playTraditionalNotes(notes: string[], velocity: number, isKeyHeld: boolean): Promise<void> {
    if (!this.instrument) return;

    notes.forEach(note => {
      // Stop existing note
      const existingNote = this.activeNotes.get(note);
      if (existingNote) {
        if (typeof existingNote === 'function') {
          existingNote();
        } else if (existingNote.stop) {
          existingNote.stop();
        }
        this.activeNotes.delete(note);
      }
      
      const scaledVelocity = Math.round(Math.max(1, Math.min(127, velocity * 127)));
      
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
              if (typeof playedNote === 'function') {
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

  async stopNotes(notes: string[]): Promise<void> {
    if (!this.isReady()) return;

    if (this.config.category === InstrumentCategory.Synthesizer) {
      await this.stopSynthNotes(notes);
    } else {
      await this.stopTraditionalNotes(notes);
    }
  }

  private async stopSynthNotes(notes: string[]): Promise<void> {
    notes.forEach(note => {
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
    notes.forEach(note => {
      const activeNote = this.activeNotes.get(note);
      if (activeNote) {
        const isKeyHeld = this.keyHeldNotes.has(note);
        
        if (isKeyHeld) {
          this.keyHeldNotes.delete(note);
          
          if (this.sustain) {
            this.sustainedNotes.add(activeNote);
          } else {
            if (typeof activeNote === 'function') {
              activeNote();
            }
            this.activeNotes.delete(note);
          }
        } else {
          if (typeof activeNote === 'function') {
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
      this.sustainedNotes.forEach(note => {
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
      this.sustainedNotes.forEach(note => {
        if (typeof note === 'function') {
          note();
        }
      });
    }
    this.sustainedNotes.clear();
  }

  // Helper methods for mono synth note stack management
  private addToNoteStack(note: string): void {
    this.noteStack = this.noteStack.filter(n => n !== note);
    this.noteStack.push(note);
  }

  private removeFromNoteStack(note: string): void {
    this.noteStack = this.noteStack.filter(n => n !== note);
  }

  private getTopNote(): string | null {
    return this.noteStack.length > 0 ? this.noteStack[this.noteStack.length - 1] : null;
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
        this.activeNotes.set(mostRecentHeldKey, () => this.handleMonoSynthRelease(mostRecentHeldKey));
        
        if (this.filterEnvelopeRef && this.config.instrumentName.startsWith("analog_")) {
          this.filterEnvelopeRef.triggerAttack(Tone.now(), 0.7);
        }
      } catch (error) {
        console.warn(`Error retriggering held key ${mostRecentHeldKey}:`, error);
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
        if (typeof stopFunction === 'function') {
          stopFunction();
        }
      } catch (error) {
        console.error('Error stopping active note during update:', error);
      }
    });
    
    // Store current synth parameters before cleanup (for synthesizers)
    const currentSynthParams = category === InstrumentCategory.Synthesizer ? { ...this.synthState } : null;
    
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
      console.log("🎛️ Preserved synth parameters during instrument change:", currentSynthParams);
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
    this.pendingReleases.forEach(timeout => clearTimeout(timeout));
    this.pendingReleases.clear();
    this.pendingStop.forEach(timeout => clearTimeout(timeout));
    this.pendingStop.clear();
    
    // Dispose instruments
    if (this.instrument && this.instrument.disconnect) {
      try {
        this.instrument.disconnect();
      } catch (error) {
        console.error('Error disconnecting traditional instrument:', error);
      }
    }
    
    if (this.synthRef) {
      try {
        this.synthRef.dispose();
      } catch (error) {
        console.error('Error disposing synthesizer:', error);
      }
    }
    
    if (this.filterRef) {
      try {
        this.filterRef.dispose();
      } catch (error) {
        console.error('Error disposing filter:', error);
      }
    }
    
    if (this.filterEnvelopeRef) {
      try {
        this.filterEnvelopeRef.dispose();
      } catch (error) {
        console.error('Error disposing filter envelope:', error);
      }
    }
    
    if (this.gainRef) {
      try {
        this.gainRef.dispose();
      } catch (error) {
        console.error('Error disposing gain:', error);
      }
    }
    
    // Reset references
    this.instrument = null;
    this.synthRef = null;
    this.filterRef = null;
    this.filterEnvelopeRef = null;
    this.gainRef = null;
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