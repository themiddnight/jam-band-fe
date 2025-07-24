import { Soundfont, DrumMachine } from 'smplr';
import * as Tone from 'tone';
import { InstrumentCategory } from '../constants/instruments';
import { getSafariLoadTimeout, handleSafariAudioError } from './webkitCompat';
import type { SynthState } from '../hooks/useToneSynthesizer';

export interface UserInstrumentData {
  userId: string;
  username: string;
  instrumentName: string;
  category: InstrumentCategory;
}

export interface RemoteSynthParams {
  userId: string;
  username: string;
  instrumentName: string;
  category: InstrumentCategory;
  params: Partial<SynthState>;
}

export class UserInstrument {
  private instrument: any = null;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private activeNotes = new Map<string, any>();
  private sustainedNotes = new Set<any>();
  private keyHeldNotes = new Set<string>();
  private sustain = false;

  // Tone.js synthesizer components
  private synthRef: any = null;
  private filterRef: Tone.Filter | null = null;
  private filterEnvelopeRef: Tone.FrequencyEnvelope | null = null;
  private gainRef: Tone.Gain | null = null;
  private synthState: SynthState = {
    // Volume control
    volume: 0.5,
    
    // Amplitude envelope
    ampAttack: 0.01,
    ampDecay: 0.1,
    ampSustain: 0.8,
    ampRelease: 0.3,
    
    // Analog synth controls
    oscillatorType: "sawtooth",
    filterFrequency: 1000,
    filterResonance: 5,
    
    // Filter envelope
    filterAttack: 0.01,
    filterDecay: 0.1,
    filterSustain: 0.5,
    filterRelease: 0.3,
    
    // FM synth controls
    modulationIndex: 10,
    harmonicity: 1,
    modAttack: 0.01,
    modDecay: 0.1,
    modSustain: 0.5,
    modRelease: 0.3,
  };

  constructor(
    private data: UserInstrumentData,
    audioContext: AudioContext
  ) {
    this.audioContext = audioContext;
  }

  getUserId(): string {
    return this.data.userId;
  }

  getUsername(): string {
    return this.data.username;
  }

  getInstrumentName(): string {
    return this.data.instrumentName;
  }

  getCategory(): InstrumentCategory {
    return this.data.category;
  }

  getKey(): string {
    return `${this.data.userId}-${this.data.instrumentName}-${this.data.category}`;
  }

  isReady(): boolean {
    return this.isLoaded && (this.instrument !== null || this.synthRef !== null);
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  // Get current synth state for remote parameter updates
  getSynthState(): SynthState {
    return { ...this.synthState };
  }

  // Initialize synthesizer when needed (deferred initialization)
  private async initializeSynthesizer(): Promise<void> {
    if (this.synthRef) {
      return; // Already initialized
    }

    try {
      // Initialize Tone.js
      await Tone.start();
      
      // Configure Tone.js context for lower latency
      Tone.context.lookAhead = 0.01;
      Tone.Transport.scheduleRepeat(() => {}, 0.01);
      
      // Create filter with current state values
      this.filterRef = new Tone.Filter({
        frequency: this.synthState.filterFrequency,
        Q: this.synthState.filterResonance,
        type: "lowpass",
      });

      // Create gain node for volume control
      this.gainRef = new Tone.Gain(this.synthState.volume);

      // Create filter envelope for analog synthesizers
      if (this.data.instrumentName.startsWith("analog_")) {
        this.filterEnvelopeRef = new Tone.FrequencyEnvelope({
          attack: this.synthState.filterAttack,
          decay: this.synthState.filterDecay,
          sustain: this.synthState.filterSustain,
          release: this.synthState.filterRelease,
          baseFrequency: this.synthState.filterFrequency,
          octaves: 4,
        });
        
        // Connect filter envelope to filter frequency
        this.filterEnvelopeRef.connect(this.filterRef.frequency);
        console.log(`🔊 Created filter envelope for analog synthesizer ${this.data.instrumentName} for user ${this.data.username}`);
      }

      // Create synthesizer based on type
      switch (this.data.instrumentName) {
        case "analog_mono":
          this.synthRef = new Tone.Synth({
            oscillator: { type: this.synthState.oscillatorType as any },
            envelope: {
              attack: this.synthState.ampAttack,
              decay: this.synthState.ampDecay,
              sustain: this.synthState.ampSustain,
              release: this.synthState.ampRelease,
            },
          });
          break;

        case "analog_poly":
          this.synthRef = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: this.synthState.oscillatorType as any },
            envelope: {
              attack: this.synthState.ampAttack,
              decay: this.synthState.ampDecay,
              sustain: this.synthState.ampSustain,
              release: this.synthState.ampRelease,
            },
          });
          break;

        case "analog_bass":
          this.synthRef = new Tone.Synth({
            oscillator: { type: this.synthState.oscillatorType as any },
            envelope: {
              attack: this.synthState.ampAttack,
              decay: this.synthState.ampDecay,
              sustain: this.synthState.ampSustain,
              release: this.synthState.ampRelease,
            },
          });
          break;

        case "analog_lead":
          this.synthRef = new Tone.Synth({
            oscillator: { type: this.synthState.oscillatorType as any },
            envelope: {
              attack: this.synthState.ampAttack,
              decay: this.synthState.ampDecay,
              sustain: this.synthState.ampSustain,
              release: this.synthState.ampRelease,
            },
          });
          break;

        case "fm_mono":
          this.synthRef = new Tone.FMSynth({
            harmonicity: this.synthState.harmonicity,
            modulationIndex: this.synthState.modulationIndex,
            envelope: {
              attack: this.synthState.ampAttack,
              decay: this.synthState.ampDecay,
              sustain: this.synthState.ampSustain,
              release: this.synthState.ampRelease,
            },
            modulation: {
              type: "sine",
            },
            modulationEnvelope: {
              attack: this.synthState.modAttack,
              decay: this.synthState.modDecay,
              sustain: this.synthState.modSustain,
              release: this.synthState.modRelease,
            },
          });
          break;

        case "fm_poly":
          this.synthRef = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: this.synthState.harmonicity,
            modulationIndex: this.synthState.modulationIndex,
            envelope: {
              attack: this.synthState.ampAttack,
              decay: this.synthState.ampDecay,
              sustain: this.synthState.ampSustain,
              release: this.synthState.ampRelease,
            },
            modulation: {
              type: "sine",
            },
            modulationEnvelope: {
              attack: this.synthState.modAttack,
              decay: this.synthState.modDecay,
              sustain: this.synthState.modSustain,
              release: this.synthState.modRelease,
            },
          });
          break;

        default:
          this.synthRef = new Tone.Synth({
            envelope: {
              attack: this.synthState.ampAttack,
              decay: this.synthState.ampDecay,
              sustain: this.synthState.ampSustain,
              release: this.synthState.ampRelease,
            },
          });
      }

      // Connect synthesizer through filter and gain to destination
      if (this.synthRef && this.filterRef && this.gainRef) {
        this.synthRef.connect(this.filterRef);
        this.filterRef.connect(this.gainRef);
        this.gainRef.toDestination();
      }

      console.log(`Initialized Tone.js synthesizer ${this.data.instrumentName} for user ${this.data.username}`);
    } catch (error) {
      console.error(`Failed to initialize synthesizer for user ${this.data.username}:`, error);
      throw error;
    }
  }

  // Update synthesizer parameters (for remote users)
  async updateSynthParams(params: Partial<SynthState>): Promise<void> {
    if (this.data.category !== InstrumentCategory.Synthesizer) {
      console.warn(`❌ Attempted to update synth params for non-synthesizer instrument: ${this.data.instrumentName}`);
      return;
    }

    console.log(`🎛️ Updating synthesizer parameters for user ${this.data.username} (${this.data.instrumentName}):`, params);

    // Initialize synthesizer if not already done
    if (!this.synthRef) {
      console.log(`🏗️ Initializing synthesizer for parameter update for user ${this.data.username}`);
      try {
        await this.initializeSynthesizer();
        console.log(`✅ Successfully initialized synthesizer for user ${this.data.username}`);
      } catch (error) {
        console.error(`❌ Failed to initialize synthesizer for parameter update for user ${this.data.username}:`, error);
        return;
      }
    }

    // Update local state
    const prevState = { ...this.synthState };
    this.synthState = { ...this.synthState, ...params };

    // Apply parameters to Tone.js synthesizer
    try {
      this.applySynthParams(params);
      console.log(`✅ Successfully applied synthesizer parameters for user ${this.data.username}:`, params);
      
      // Log specific parameter types that were updated
      const updatedParams = Object.keys(params);
      if (updatedParams.some(p => p.startsWith('filter'))) {
        console.log(`🔊 Filter parameters updated for ${this.data.username}:`, 
          Object.fromEntries(Object.entries(params).filter(([key]) => key.startsWith('filter'))));
      }
      if (updatedParams.some(p => p.startsWith('mod'))) {
        console.log(`🌊 FM modulation parameters updated for ${this.data.username}:`, 
          Object.fromEntries(Object.entries(params).filter(([key]) => key.startsWith('mod'))));
      }
    } catch (error) {
      console.error(`❌ Failed to apply synthesizer parameters for user ${this.data.username}:`, error);
      // Revert state on error
      this.synthState = prevState;
    }
  }

  private applySynthParams(params: Partial<SynthState>): void {
    if (!this.synthRef || !this.filterRef || !this.gainRef) {
      console.warn(`❌ Cannot apply synth params - missing components for user ${this.data.username}:`, {
        synthRef: !!this.synthRef,
        filterRef: !!this.filterRef,
        gainRef: !!this.gainRef
      });
      return;
    }

    console.log(`🔧 Applying synthesizer parameters for ${this.data.username}:`, params);

    try {
      const synth = this.synthRef as any;
      const filter = this.filterRef;
      const gain = this.gainRef;
      const filterEnvelope = this.filterEnvelopeRef;
      
      // Update volume parameter
      if (params.volume !== undefined) {
        gain.gain.value = params.volume;
      }
      
      // Update filter parameters
      if (params.filterFrequency !== undefined) {
        filter.frequency.value = params.filterFrequency;
        // Update filter envelope base frequency if it exists
        if (filterEnvelope) {
          filterEnvelope.baseFrequency = params.filterFrequency;
        }
      }
      if (params.filterResonance !== undefined) {
        filter.Q.value = params.filterResonance;
      }
      
      // Update filter envelope parameters
      if (filterEnvelope) {
        if (params.filterAttack !== undefined) filterEnvelope.attack = params.filterAttack;
        if (params.filterDecay !== undefined) filterEnvelope.decay = params.filterDecay;
        if (params.filterSustain !== undefined) {
          filterEnvelope.sustain = params.filterSustain;
        }
        if (params.filterRelease !== undefined) filterEnvelope.release = params.filterRelease;
      }
      
      // Handle PolySynth differently from monophonic synths
      if (synth instanceof Tone.PolySynth) {
        
        // Update the default options for new voices
        if (params.oscillatorType) {
          synth.set({ oscillator: { type: params.oscillatorType as any } });
        }
        
        // Update amplitude envelope
        const envelopeParams: any = {};
        if (params.ampAttack !== undefined) envelopeParams.attack = params.ampAttack;
        if (params.ampDecay !== undefined) envelopeParams.decay = params.ampDecay;
        if (params.ampSustain !== undefined) envelopeParams.sustain = params.ampSustain;
        if (params.ampRelease !== undefined) envelopeParams.release = params.ampRelease;
        
        if (Object.keys(envelopeParams).length > 0) {
          synth.set({ envelope: envelopeParams });
        }
        
        // Update FM parameters for PolySynth
        if (params.modulationIndex !== undefined) {
          synth.set({ modulationIndex: params.modulationIndex });
        }
        if (params.harmonicity !== undefined) {
          synth.set({ harmonicity: params.harmonicity });
        }
        
        // Update FM modulation envelope for PolySynth
        const modEnvelopeParams: any = {};
        if (params.modAttack !== undefined) modEnvelopeParams.attack = params.modAttack;
        if (params.modDecay !== undefined) modEnvelopeParams.decay = params.modDecay;
        if (params.modSustain !== undefined) modEnvelopeParams.sustain = params.modSustain;
        if (params.modRelease !== undefined) modEnvelopeParams.release = params.modRelease;
        
        if (Object.keys(modEnvelopeParams).length > 0) {
          synth.set({ modulationEnvelope: modEnvelopeParams });
        }
        
        // Update existing voices if they exist (using any type to access voices)
        const polySynth = synth as any;
        if (polySynth.voices && Array.isArray(polySynth.voices)) {
          polySynth.voices.forEach((voice: any) => {
            if (params.oscillatorType && voice.oscillator) {
              voice.oscillator.type = params.oscillatorType;
            }
            if (voice.envelope) {
              if (params.ampAttack !== undefined) voice.envelope.attack = params.ampAttack;
              if (params.ampDecay !== undefined) voice.envelope.decay = params.ampDecay;
              if (params.ampSustain !== undefined) {
                voice.envelope.sustain = params.ampSustain;
              }
              if (params.ampRelease !== undefined) voice.envelope.release = params.ampRelease;
            }
            // Update FM parameters on existing voices
            if (params.modulationIndex !== undefined && voice.modulationIndex) {
              voice.modulationIndex.value = params.modulationIndex;
            }
            if (params.harmonicity !== undefined && voice.harmonicity) {
              voice.harmonicity.value = params.harmonicity;
            }
            if (voice.modulationEnvelope) {
              if (params.modAttack !== undefined) voice.modulationEnvelope.attack = params.modAttack;
              if (params.modDecay !== undefined) voice.modulationEnvelope.decay = params.modDecay;
              if (params.modSustain !== undefined) {
                voice.modulationEnvelope.sustain = params.modSustain;
              }
              if (params.modRelease !== undefined) voice.modulationEnvelope.release = params.modRelease;
            }
          });
        }
      } else {
        // Handle monophonic synths
        
        // Update oscillator type
        if (params.oscillatorType && synth.oscillator) {
          synth.oscillator.type = params.oscillatorType as any;
        }
        
        // Update amplitude envelope
        if (synth.envelope) {
          if (params.ampAttack !== undefined) {
            synth.envelope.attack = params.ampAttack;
          }
          if (params.ampDecay !== undefined) {
            synth.envelope.decay = params.ampDecay;
          }
          if (params.ampSustain !== undefined) {
            synth.envelope.sustain = params.ampSustain;
          }
          if (params.ampRelease !== undefined) {
            synth.envelope.release = params.ampRelease;
          }
        }
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
        if (params.modSustain !== undefined) {
          synth.modulationEnvelope.sustain = params.modSustain;
        }
        if (params.modRelease !== undefined) synth.modulationEnvelope.release = params.modRelease;
      }
      
      console.log(`✅ Successfully applied all synthesizer parameters for ${this.data.username}`);
    } catch (error) {
      console.error(`❌ Error applying synth parameters for user ${this.data.username}:`, error);
      throw error; // Re-throw to be caught by the calling method
    }
  }

  async load(): Promise<any> {
    if (this.isLoaded && (this.instrument || this.synthRef)) {
      return this.instrument || this.synthRef;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this._loadInstrument();
    
    try {
      const result = await this.loadPromise;
      this.isLoaded = true;
      return result;
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
      let newInstrument: any;

      if (this.data.category === InstrumentCategory.Synthesizer) {
        // For synthesizers, we'll defer Tone.js initialization until first use
        // This prevents AudioContext warnings for remote users
        console.log(`Prepared synthesizer ${this.data.instrumentName} for user ${this.data.username} (deferred initialization)`);
        newInstrument = null; // We'll create the actual synth when needed
      } else if (this.data.category === InstrumentCategory.DrumBeat) {
        newInstrument = new DrumMachine(this.audioContext, {
          instrument: this.data.instrumentName,
          volume: 127,
        });
      } else {
        // Default to Soundfont for melodic instruments
        newInstrument = new Soundfont(this.audioContext, {
          instrument: this.data.instrumentName,
          volume: 127,
        });
      }

      // For non-synthesizer instruments, load them using the existing logic
      if (this.data.category !== InstrumentCategory.Synthesizer) {
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
              reject(handleSafariAudioError(error, this.data.instrumentName));
            });
        });

        await loadPromise;
      }

      this.instrument = newInstrument;
      console.log(`Loaded instrument ${this.data.instrumentName} for user ${this.data.username}`);
      
      return newInstrument;
    } catch (error) {
      console.error(`Failed to load instrument ${this.data.instrumentName} for user ${this.data.username}:`, error);
      throw error;
    }
  }

  async playNotes(notes: string[], velocity: number, isKeyHeld: boolean = false): Promise<void> {
    console.log(`🎵 UserInstrument: Playing notes for ${this.data.username}, ready: ${this.isReady()}`);
    
    if (!this.isReady()) {
      console.log(`📥 Loading instrument for ${this.data.username}`);
      await this.load();
      console.log(`✅ Loaded instrument for ${this.data.username}, ready: ${this.isReady()}`);
    }

    if (this.data.category === InstrumentCategory.Synthesizer) {
      await this.playSynthNotes(notes, velocity, isKeyHeld);
    } else if (!this.instrument) {
      console.warn(`❌ Instrument ${this.data.instrumentName} not available for user ${this.data.username}`);
      return;
    } else {
      await this.playTraditionalNotes(notes, velocity, isKeyHeld);
    }
  }

  private async playSynthNotes(notes: string[], velocity: number, isKeyHeld: boolean = false): Promise<void> {
    // Initialize synthesizer if not already done
    if (!this.synthRef) {
      try {
        await this.initializeSynthesizer();
      } catch (error) {
        console.error(`❌ Failed to initialize synthesizer for user ${this.data.username}:`, error);
        return;
      }
    }

    console.log(`🎹 Playing synthesizer notes for ${this.data.username}:`, notes);

    try {
      notes.forEach(note => {
        // Stop existing note if playing
        const existingNote = this.activeNotes.get(note);
        if (existingNote) {
          existingNote(); // Call the stop function
        }
        
        if (this.synthRef instanceof Tone.PolySynth) {
          // Handle polyphonic synthesizers
          try {
            // If the note is already playing, release it first to avoid stacking
            if (this.activeNotes.has(note)) {
              this.synthRef.triggerRelease(note, Tone.now());
              this.activeNotes.delete(note);
            }
            
            this.synthRef.triggerAttack(note, Tone.now(), velocity);
            this.activeNotes.set(note, () => {
              this.synthRef.triggerRelease(note, Tone.now());
            });
            
            // Trigger filter envelope for analog synthesizers
            if (this.filterEnvelopeRef && this.data.instrumentName.startsWith("analog_")) {
              this.filterEnvelopeRef.triggerAttack(Tone.now(), velocity);
              console.log(`🔊 Triggered filter envelope for analog synth note ${note} for user ${this.data.username}`);
            }
            
            // Track key-held notes
            if (isKeyHeld) {
              this.keyHeldNotes.add(note);
            }
            
            // Only add to sustained notes if sustain is on AND note is not key-held
            if (this.sustain && !isKeyHeld) {
              this.sustainedNotes.add(note);
            }
            
            // Auto-stop non-key-held notes after timeout if sustain is off
            if (!isKeyHeld && !this.sustain) {
              setTimeout(() => {
                if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
                  this.synthRef.triggerRelease(note, Tone.now());
                  this.activeNotes.delete(note);
                }
              }, 300);
            }
          } catch (error) {
            console.warn("Error triggering synth note attack:", error);
            this.activeNotes.delete(note);
          }
        } else {
          // Handle monophonic synthesizers - use note priority stack like local synths
          try {
            // Track key-held notes BEFORE triggering attack
            if (isKeyHeld) {
              this.keyHeldNotes.add(note);
            }
            
            // Get current note that's playing (if any)
            const currentPlayingNote = this.activeNotes.size > 0 ? Array.from(this.activeNotes.keys())[0] : null;
            
            if (!currentPlayingNote) {
              // No note currently playing, trigger attack for the first note
              this.synthRef.triggerAttack(note, undefined, velocity);
              console.log(`🎹 Triggered attack for first mono note: ${note} for user ${this.data.username}`);
            } else {
              // Use setNote for legato transition to new note
              this.synthRef.setNote(note);
              console.log(`🎹 Set note for mono legato transition: ${note} for user ${this.data.username}`);
            }
            
            // Clear previous active note tracking and set new one
            this.activeNotes.clear();
            this.activeNotes.set(note, () => {
              this.handleMonoSynthRelease(note);
            });
            
            // Trigger filter envelope for analog synthesizers
            if (this.filterEnvelopeRef && this.data.instrumentName.startsWith("analog_")) {
              this.filterEnvelopeRef.triggerAttack(Tone.now(), velocity);
              console.log(`🔊 Triggered filter envelope for mono analog synth note ${note} for user ${this.data.username}`);
            }
            
            // Only add to sustained notes if sustain is on AND note is not key-held
            if (this.sustain && !isKeyHeld) {
              this.sustainedNotes.add(note);
            }
            
            // Auto-stop non-key-held notes after timeout if sustain is off
            if (!isKeyHeld && !this.sustain) {
              setTimeout(() => {
                if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
                  this.handleMonoSynthRelease(note);
                  this.activeNotes.delete(note);
                }
              }, 300);
            }
          } catch (error) {
            console.warn("Error triggering mono synth note attack:", error);
            this.activeNotes.delete(note);
          }
        }
      });
      
      console.log(`✅ Successfully played synthesizer notes for ${this.data.username}`);
    } catch (error) {
      console.error(`❌ Error playing synthesizer notes for user ${this.data.username}:`, error);
    }
  }

  // Handle mono synth note release with proper key tracking
  private handleMonoSynthRelease(noteToRelease: string): void {
    if (!this.synthRef || this.synthRef instanceof Tone.PolySynth) {
      return; // Only for mono synths
    }

    console.log(`🎹 Handling mono synth release for note ${noteToRelease}, held keys:`, Array.from(this.keyHeldNotes));
    
    // Remove the note from active notes
    this.activeNotes.delete(noteToRelease);
    
    // If this was a key-held note, remove it from held keys
    const wasKeyHeld = this.keyHeldNotes.has(noteToRelease);
    if (wasKeyHeld) {
      this.keyHeldNotes.delete(noteToRelease);
    }
    
    // Check if there are other keys still being held
    const remainingHeldKeys = Array.from(this.keyHeldNotes);
    
    if (remainingHeldKeys.length > 0) {
      // Retrigger the most recently held key
      const mostRecentHeldKey = remainingHeldKeys[remainingHeldKeys.length - 1];
      console.log(`🔄 Retriggering most recent held key: ${mostRecentHeldKey}`);
      
      try {
        // For mono synths, use setNote for legato transition to the held key
        this.synthRef.setNote(mostRecentHeldKey);
        console.log(`🎹 Set note for mono retrigger to held key: ${mostRecentHeldKey} for user ${this.data.username}`);
        
        // Update active notes to track this retriggered note
        this.activeNotes.set(mostRecentHeldKey, () => {
          this.handleMonoSynthRelease(mostRecentHeldKey);
        });
        
        // Trigger filter envelope for analog synthesizers
        if (this.filterEnvelopeRef && this.data.instrumentName.startsWith("analog_")) {
          this.filterEnvelopeRef.triggerAttack(Tone.now(), 0.7);
          console.log(`🔊 Retriggered filter envelope for held key ${mostRecentHeldKey} for user ${this.data.username}`);
        }
      } catch (error) {
        console.warn(`Error retriggering held key ${mostRecentHeldKey}:`, error);
      }
    } else {
      // No more held keys, release the synth
      console.log(`🛑 No more held keys, releasing mono synth for user ${this.data.username}`);
      this.synthRef.triggerRelease();
      
      // Release filter envelope for analog synthesizers
      if (this.filterEnvelopeRef && this.data.instrumentName.startsWith("analog_")) {
        this.filterEnvelopeRef.triggerRelease(Tone.now());
        console.log(`🔊 Released filter envelope for mono synth for user ${this.data.username}`);
      }
    }
  }

  private async playTraditionalNotes(notes: string[], velocity: number, isKeyHeld: boolean = false): Promise<void> {
    console.log(`🎹 Playing traditional notes for ${this.data.username}:`, notes);

    try {
      if (this.data.category === InstrumentCategory.DrumBeat && this.instrument.start) {
        // For drum machines, play samples
        console.log(`🥁 Playing drum samples:`, notes);
        notes.forEach(note => {
          // Use more precise velocity scaling for drum machines
          const scaledVelocity = Math.round(Math.max(1, Math.min(127, velocity * 127)));
          console.log(`🥁 Starting drum note:`, note, `with velocity:`, scaledVelocity, `(from ${velocity})`);
          
          // For drum machines, stop existing note immediately to prevent buildup
          const existingNote = this.activeNotes.get(note);
          if (existingNote) {
            try {
              if (typeof existingNote === 'function') {
                existingNote(); // Call the stop function
              } else if (existingNote.stop) {
                existingNote.stop(); // Call stop method if available
              }
            } catch (error) {
              console.warn(`Warning stopping existing drum note ${note}:`, error);
            }
            this.activeNotes.delete(note);
          }
          
          const playedNote = this.instrument.start({
            note: note,
            velocity: scaledVelocity,
            time: this.audioContext!.currentTime + 0.001, // Add tiny offset for better timing
          });
          
          // Store the note for later stopping
          if (playedNote) {
            this.activeNotes.set(note, playedNote);
            
            // For drum machines, automatically clean up after a reasonable time
            // to prevent memory leaks from one-shot samples
            setTimeout(() => {
              if (this.activeNotes.get(note) === playedNote) {
                this.activeNotes.delete(note);
              }
            }, 5000); // Clean up after 5 seconds
          }
          
          // Track key-held notes
          if (isKeyHeld) {
            this.keyHeldNotes.add(note);
          }
          
          // Only add to sustained notes if sustain is on AND note is not key-held
          if (this.sustain && !isKeyHeld && playedNote) {
            this.sustainedNotes.add(playedNote);
          }
          
          // Auto-stop non-key-held notes after timeout if sustain is off
          if (!isKeyHeld && !this.sustain && playedNote) {
            setTimeout(() => {
              if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
                try {
                  if (typeof playedNote === 'function') {
                    playedNote();
                  } else if (playedNote.stop) {
                    playedNote.stop();
                  }
                } catch (error) {
                  console.warn(`Warning auto-stopping drum note ${note}:`, error);
                }
                this.activeNotes.delete(note);
              }
            }, 300);
          }
        });
      } else if (this.instrument.start) {
        // For soundfont instruments
        console.log(`🎼 Playing soundfont notes:`, notes);
        notes.forEach(note => {
          // Use more precise velocity scaling for soundfont instruments too
          const scaledVelocity = Math.round(Math.max(1, Math.min(127, velocity * 127)));
          console.log(`🎼 Starting soundfont note:`, note, `with velocity:`, scaledVelocity, `(from ${velocity})`);
          
          // Stop existing note if playing
          const existingNote = this.activeNotes.get(note);
          if (existingNote) {
            existingNote(); // Call the stop function
          }
          
          const playedNote = this.instrument.start({
            note: note,
            velocity: scaledVelocity,
            time: this.audioContext!.currentTime + 0.001, // Add tiny offset for better timing
          });
          
          // Store the note for later stopping
          this.activeNotes.set(note, playedNote);
          
          // Track key-held notes
          if (isKeyHeld) {
            this.keyHeldNotes.add(note);
          }
          
          // Only add to sustained notes if sustain is on AND note is not key-held
          if (this.sustain && !isKeyHeld) {
            this.sustainedNotes.add(playedNote);
          }
          
          // Auto-stop non-key-held notes after timeout if sustain is off
          if (!isKeyHeld && !this.sustain) {
            setTimeout(() => {
              if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
                if (playedNote) {
                  playedNote();
                }
                this.activeNotes.delete(note);
              }
            }, 300);
          }
        });
      } else {
        console.warn(`❌ Instrument doesn't have a start method:`, this.instrument);
      }
      console.log(`✅ Successfully played all notes for ${this.data.username}`);
    } catch (error) {
      console.error(`❌ Error playing note for user ${this.data.username}:`, error);
    }
  }

  setSustain(sustain: boolean): void {
    this.sustain = sustain;
    
    // If sustain is turned off, stop all sustained notes
    if (!sustain) {
      this.stopSustainedNotes();
    }
  }

  private stopSustainedNotes(): void {
    if (this.data.category === InstrumentCategory.Synthesizer) {
      // For synthesizers, release sustained notes
      this.sustainedNotes.forEach(note => {
        if (this.synthRef instanceof Tone.PolySynth) {
          this.synthRef.triggerRelease(note, Tone.now());
        } else {
          // For mono synths, only release if no keys are currently held
          if (this.keyHeldNotes.size === 0) {
            this.synthRef.triggerRelease();
            
            // Release filter envelope for analog synthesizers
            if (this.filterEnvelopeRef && this.data.instrumentName.startsWith("analog_")) {
              this.filterEnvelopeRef.triggerRelease(Tone.now());
              console.log(`🔊 Released filter envelope for sustained notes for user ${this.data.username}`);
            }
          }
        }
      });
      this.sustainedNotes.clear();
    } else {
      // For traditional instruments
      this.sustainedNotes.forEach(note => {
        if (note) {
          note(); // Call the stop function
        }
      });
      this.sustainedNotes.clear();
    }
  }

  async stopNotes(notes: string[]): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    console.log(`🛑 UserInstrument: Stopping notes for ${this.data.username}:`, notes, `sustain: ${this.sustain}`);

    try {
      if (this.data.category === InstrumentCategory.Synthesizer) {
        await this.stopSynthNotes(notes);
      } else {
        await this.stopTraditionalNotes(notes);
      }
    } catch (error) {
      console.error(`❌ Error stopping note for user ${this.data.username}:`, error);
    }
  }

  private async stopSynthNotes(notes: string[]): Promise<void> {
    if (!this.synthRef) return;

    notes.forEach(note => {
      const isKeyHeld = this.keyHeldNotes.has(note);
      
      if (isKeyHeld) {
        if (this.sustain) {
          // If sustain is on, move key-held note to sustained notes
          console.log(`🎛️ Moving key-held note to sustained:`, note);
          this.sustainedNotes.add(note);
          this.keyHeldNotes.delete(note);
          this.activeNotes.delete(note);
        } else {
          // If sustain is off, stop the key-held note immediately
          console.log(`🛑 Stopping key-held note:`, note);
          if (this.synthRef instanceof Tone.PolySynth) {
            this.synthRef.triggerRelease(note, Tone.now());
            this.activeNotes.delete(note);
            this.sustainedNotes.delete(note);
          } else {
            // For mono synths, use the special release handling
            this.handleMonoSynthRelease(note);
          }
        }
      } else {
        // Non-key-held notes should already be handled by sustain logic
        // Just clean up if they're still active
        console.log(`🛑 Stopping non-key-held note:`, note);
        if (this.synthRef instanceof Tone.PolySynth) {
          this.synthRef.triggerRelease(note, Tone.now());
        } else {
          // For mono synths, use the special release handling
          this.handleMonoSynthRelease(note);
        }
        
        this.sustainedNotes.delete(note);
      }
    });
  }

  private async stopTraditionalNotes(notes: string[]): Promise<void> {
    if (!this.instrument) return;

    notes.forEach(note => {
      const activeNote = this.activeNotes.get(note);
      if (activeNote) {
        const isKeyHeld = this.keyHeldNotes.has(note);
        
        if (isKeyHeld) {
          // Remove from key-held notes
          this.keyHeldNotes.delete(note);
          
          if (this.sustain) {
            // If sustain is on, move key-held note to sustained notes
            console.log(`🎛️ Moving key-held note to sustained:`, note);
            this.sustainedNotes.add(activeNote);
            this.activeNotes.delete(note);
          } else {
            // If sustain is off, stop the key-held note immediately
            console.log(`🛑 Stopping key-held note:`, note);
            activeNote(); // Call the stop function directly
            this.activeNotes.delete(note);
            this.sustainedNotes.delete(activeNote);
          }
        } else {
          // Non-key-held notes should already be handled by sustain logic
          // Just clean up if they're still active
          console.log(`🛑 Stopping non-key-held note:`, note);
          activeNote(); // Call the stop function directly
          this.activeNotes.delete(note);
          this.sustainedNotes.delete(activeNote);
        }
      } else {
        console.log(`⚠️ No active note found for:`, note);
      }
    });
  }

  updateInstrument(instrumentName: string, category: InstrumentCategory): void {
    // Stop all active notes first
    this.activeNotes.forEach((stopFunction) => {
      try {
        stopFunction();
      } catch (error) {
        console.error('Error stopping active note during update:', error);
      }
    });
    this.activeNotes.clear();
    this.sustainedNotes.clear();
    this.keyHeldNotes.clear();

    // Dispose of old instrument
    if (this.instrument && this.instrument.disconnect) {
      try {
        this.instrument.disconnect();
      } catch (error) {
        console.error('Error disconnecting instrument during update:', error);
      }
    }

    // Dispose of old synthesizer
    if (this.synthRef) {
      try {
        this.synthRef.dispose();
      } catch (error) {
        console.error('Error disposing synthesizer during update:', error);
      }
    }
    
    if (this.filterRef) {
      try {
        this.filterRef.dispose();
      } catch (error) {
        console.error('Error disposing filter during update:', error);
      }
    }
    
    if (this.filterEnvelopeRef) {
      try {
        this.filterEnvelopeRef.dispose();
      } catch (error) {
        console.error('Error disposing filter envelope during update:', error);
      }
    }
    
    if (this.gainRef) {
      try {
        this.gainRef.dispose();
      } catch (error) {
        console.error('Error disposing gain during update:', error);
      }
    }
    
    // Update data
    this.data.instrumentName = instrumentName;
    this.data.category = category;
    
    // Reset state
    this.instrument = null;
    this.synthRef = null;
    this.filterRef = null;
    this.filterEnvelopeRef = null;
    this.gainRef = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
  }

  dispose(): void {
    // Stop all active notes
    this.activeNotes.forEach((stopFunction) => {
      try {
        stopFunction();
      } catch (error) {
        console.error('Error stopping active note during dispose:', error);
      }
    });
    this.activeNotes.clear();
    this.sustainedNotes.clear();
    this.keyHeldNotes.clear();

    if (this.instrument && this.instrument.disconnect) {
      try {
        this.instrument.disconnect();
      } catch (error) {
        console.error('Error disconnecting instrument:', error);
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
    
    this.instrument = null;
    this.synthRef = null;
    this.filterRef = null;
    this.filterEnvelopeRef = null;
    this.gainRef = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
  }
} 