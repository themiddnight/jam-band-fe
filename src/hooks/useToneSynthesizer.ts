import { useState, useRef, useEffect, useCallback } from "react";
import * as Tone from "tone";
import { getOptimalAudioConfig } from "../constants/audioConfig";

export interface SynthParams {
  // Analog Synth Parameters
  oscillatorType?: OscillatorType;
  filterFrequency?: number;
  filterResonance?: number;
  filterEnvelope?: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  };
  envelope?: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  };
  
  // FM Synth Parameters
  modulationIndex?: number;
  harmonicity?: number;
  modulationEnvelope?: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  };
}

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

export const useToneSynthesizer = (synthType: string) => {
  const [synthState, setSynthState] = useState<SynthState>(defaultSynthState);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [sustainEnabled, setSustainEnabled] = useState<boolean>(false);
  
  const synthRef = useRef<any>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const filterEnvelopeRef = useRef<Tone.FrequencyEnvelope | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);
  const activeNotes = useRef<Map<string, Tone.Unit.Time>>(new Map());
  const pendingReleases = useRef<Map<string, number>>(new Map());
  const filterEnvelopeActive = useRef<boolean>(false);
  const sustainedNotes = useRef<Set<string>>(new Set());
  
  // Note priority stack for monophonic synthesizers
  const noteStack = useRef<string[]>([]);
  const currentNote = useRef<string | null>(null);

  // Clear any pending releases for a note
  const clearPendingRelease = useCallback((note: string) => {
    const timeout = pendingReleases.current.get(note);
    if (timeout) {
      clearTimeout(timeout);
      pendingReleases.current.delete(note);
    }
  }, []);

  // Get the top note from the stack (most recent)
  const getTopNote = useCallback(() => {
    return noteStack.current.length > 0 ? noteStack.current[noteStack.current.length - 1] : null;
  }, []);

  // Add note to stack
  const addToNoteStack = useCallback((note: string) => {
    // Remove note if it already exists (avoid duplicates)
    noteStack.current = noteStack.current.filter(n => n !== note);
    // Add to end (most recent)
    noteStack.current.push(note);
  }, []);

  // Remove note from stack
  const removeFromNoteStack = useCallback((note: string) => {
    noteStack.current = noteStack.current.filter(n => n !== note);
  }, []);

  // Play a specific note on monophonic synth
  const playMonophonicNote = useCallback((note: string, velocity: number) => {
    if (!synthRef.current) return;
    
    try {
      const time = Tone.now();
      
      // If there's a current note playing, release it first
      if (currentNote.current) {
        synthRef.current.triggerRelease(time);
        // Remove previous note from active notes
        activeNotes.current.delete(currentNote.current);
      }
      
      // Play the new note
      synthRef.current.triggerAttack(note, time, velocity);
      currentNote.current = note;
      // Add note to active notes map for proper tracking
      activeNotes.current.set(note, time);
      
      // Trigger filter envelope for analog synthesizers (only if not already active)
      if (filterEnvelopeRef.current && !filterEnvelopeActive.current) {
        filterEnvelopeRef.current.triggerAttack(time, velocity);
        filterEnvelopeActive.current = true;
      }
      console.log(`Playing monophonic note: ${note}`);
    } catch (error) {
      console.warn("Error playing monophonic note:", error);
    }
  }, []);

  // Initialize synthesizer based on type
  const initializeSynth = useCallback(async () => {
    try {
      await Tone.start();
      
      // Get optimal audio configuration for this device
      const audioConfig = getOptimalAudioConfig();
      
      // Configure Tone.js context for lower latency
      Tone.context.lookAhead = audioConfig.TONE_CONTEXT.lookAhead;
      Tone.Transport.scheduleRepeat(() => {}, audioConfig.TONE_CONTEXT.updateInterval);
      
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      
      if (filterRef.current) {
        filterRef.current.dispose();
      }
      
      if (filterEnvelopeRef.current) {
        filterEnvelopeRef.current.dispose();
      }

      if (gainRef.current) {
        gainRef.current.dispose();
      }

      // Create filter
      filterRef.current = new Tone.Filter({
        frequency: defaultSynthState.filterFrequency,
        Q: defaultSynthState.filterResonance,
        type: "lowpass",
      });

      // Create gain node for volume control
      gainRef.current = new Tone.Gain(defaultSynthState.volume);

      // Create filter envelope for analog synthesizers
      if (synthType.startsWith("analog_")) {
        filterEnvelopeRef.current = new Tone.FrequencyEnvelope({
          attack: defaultSynthState.filterAttack,
          decay: defaultSynthState.filterDecay,
          sustain: defaultSynthState.filterSustain,
          release: defaultSynthState.filterRelease,
          baseFrequency: defaultSynthState.filterFrequency,
          octaves: 4,
        });
        
        // Connect filter envelope to filter frequency
        filterEnvelopeRef.current.connect(filterRef.current.frequency);
      }

      switch (synthType) {
        case "analog_mono":
          synthRef.current = new Tone.Synth({
            oscillator: { type: "sawtooth" },
            envelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.8,
              release: 0.3,
            },
          });
          break;

        case "analog_poly":
          synthRef.current = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sawtooth" },
            envelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.8,
              release: 0.3,
            },
          });
          break;

        case "analog_bass":
          synthRef.current = new Tone.Synth({
            oscillator: { type: "sawtooth" },
            envelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.8,
              release: 0.1,
            },
          });
          break;

        case "analog_lead":
          synthRef.current = new Tone.Synth({
            oscillator: { type: "square" },
            envelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.9,
              release: 0.3,
            },
          });
          break;

        case "fm_mono":
          synthRef.current = new Tone.FMSynth({
            harmonicity: 1,
            modulationIndex: 10,
            envelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.8,
              release: 0.3,
            },
            modulation: {
              type: "sine",
            },
            modulationEnvelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.5,
              release: 0.3,
            },
          });
          break;

        case "fm_poly":
          synthRef.current = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1,
            modulationIndex: 10,
            envelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.8,
              release: 0.3,
            },
            modulation: {
              type: "sine",
            },
            modulationEnvelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.5,
              release: 0.3,
            },
          });
          break;

        default:
          synthRef.current = new Tone.Synth({
            envelope: {
              attack: Math.max(0.01, audioConfig.SYNTHESIZER.envelopeAttackMin),
              decay: 0.1,
              sustain: 0.8,
              release: 0.3,
            },
          });
      }

      // Connect synthesizer through filter and gain to destination
      if (synthRef.current && filterRef.current && gainRef.current) {
        synthRef.current.connect(filterRef.current);
        filterRef.current.connect(gainRef.current);
        gainRef.current.toDestination();
      }

      setIsLoaded(true);
      console.log(`Initialized ${synthType} synthesizer with filter and low latency settings`);
      console.log('Audio config:', audioConfig);
    } catch (error) {
      console.error("Failed to initialize synthesizer:", error);
    }
  }, [synthType]); // Remove synthState dependency

  // Update synthesizer parameters
  const updateSynthParams = useCallback((params: Partial<SynthState>) => {
    setSynthState(prev => ({ ...prev, ...params }));
    
    if (synthRef.current && filterRef.current && gainRef.current) {
      try {
        const synth = synthRef.current as any;
        const filter = filterRef.current;
        const gain = gainRef.current;
        const filterEnvelope = filterEnvelopeRef.current;
        console.log("Updating synth parameters:", params);
        console.log("Synth type:", synth.constructor.name);
        
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
          if (params.filterSustain !== undefined) filterEnvelope.sustain = params.filterSustain;
          if (params.filterRelease !== undefined) filterEnvelope.release = params.filterRelease;
        }
        
        // Handle PolySynth differently from monophonic synths
        if (synth instanceof Tone.PolySynth) {
          console.log("Updating PolySynth parameters");
          
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
                if (params.ampSustain !== undefined) voice.envelope.sustain = params.ampSustain;
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
                if (params.modSustain !== undefined) voice.modulationEnvelope.sustain = params.modSustain;
                if (params.modRelease !== undefined) voice.modulationEnvelope.release = params.modRelease;
              }
            });
          }
        } else {
          // Handle monophonic synths
          console.log("Updating monophonic synth parameters");
          
          // Update oscillator type
          if (params.oscillatorType && synth.oscillator) {
            synth.oscillator.type = params.oscillatorType as any;
            console.log("Updated oscillator type to:", params.oscillatorType);
          }
          
          // Update amplitude envelope
          if (synth.envelope) {
            if (params.ampAttack !== undefined) {
              synth.envelope.attack = params.ampAttack;
              console.log("Updated amp attack to:", params.ampAttack);
            }
            if (params.ampDecay !== undefined) {
              synth.envelope.decay = params.ampDecay;
              console.log("Updated amp decay to:", params.ampDecay);
            }
            if (params.ampSustain !== undefined) {
              synth.envelope.sustain = params.ampSustain;
              console.log("Updated amp sustain to:", params.ampSustain);
            }
            if (params.ampRelease !== undefined) {
              synth.envelope.release = params.ampRelease;
              console.log("Updated amp release to:", params.ampRelease);
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
          if (params.modSustain !== undefined) synth.modulationEnvelope.sustain = params.modSustain;
          if (params.modRelease !== undefined) synth.modulationEnvelope.release = params.modRelease;
        }
        console.log("Parameters updated successfully");
      } catch (error) {
        console.error("Error updating synth parameters:", error);
      }
    }
  }, []);

  // Play notes
  const playNotes = useCallback((notes: string[], velocity: number) => {
    if (!synthRef.current || !isLoaded) return;

    // Get optimal audio configuration for this device
    const audioConfig = getOptimalAudioConfig();

    notes.forEach(note => {
      const time = Tone.now();
      
      // Clear any pending releases for this note
      clearPendingRelease(note);
      
      if (synthRef.current instanceof Tone.PolySynth) {
        // Handle polyphonic synthesizers
        try {
          // If note is already playing, release it first to avoid stuck notes
          if (activeNotes.current.has(note)) {
            synthRef.current.triggerRelease(note, time);
            activeNotes.current.delete(note);
            
            // Use configurable delay for cleaner transition
            const playDelay = audioConfig.SYNTHESIZER.noteRetriggerDelay;
            setTimeout(() => {
              if (synthRef.current && synthRef.current instanceof Tone.PolySynth) {
                try {
                  synthRef.current.triggerAttack(note, Tone.now(), velocity);
                  activeNotes.current.set(note, Tone.now());
                  
                  // Trigger filter envelope for analog synthesizers (only if not already active)
                  if (filterEnvelopeRef.current && !filterEnvelopeActive.current) {
                    filterEnvelopeRef.current.triggerAttack(Tone.now(), velocity);
                    filterEnvelopeActive.current = true;
                  }
                } catch (error) {
                  console.warn("Error in delayed note attack:", error);
                }
              }
            }, playDelay);
          } else {
            // Note is not playing, trigger it immediately
            synthRef.current.triggerAttack(note, time, velocity);
            activeNotes.current.set(note, time);
            
            // Trigger filter envelope for analog synthesizers (only if not already active)
            if (filterEnvelopeRef.current && !filterEnvelopeActive.current) {
              filterEnvelopeRef.current.triggerAttack(time, velocity);
              filterEnvelopeActive.current = true;
            }
          }
        } catch (error) {
          console.warn("Error triggering note attack:", error);
          // Remove from active notes if attack failed
          activeNotes.current.delete(note);
        }
      } else {
        // Handle monophonic synthesizers with note priority stack
        addToNoteStack(note);
        const topNote = getTopNote();
        
        if (topNote === note) {
          // This is the new top note, play it
          playMonophonicNote(note, velocity);
        }
        console.log(`Note stack: [${noteStack.current.join(', ')}], playing: ${currentNote.current}`);
      }
    });
  }, [isLoaded, clearPendingRelease, addToNoteStack, getTopNote, playMonophonicNote]);

  // Stop notes
  const stopNotes = useCallback((notes: string[]) => {
    if (!synthRef.current || !isLoaded) return;

    notes.forEach(note => {
      // Clear any pending releases
      clearPendingRelease(note);
      
      try {
        const time = Tone.now();
        
        if (synthRef.current instanceof Tone.PolySynth) {
          // Handle polyphonic synthesizers - only process if note is actually active
          if (activeNotes.current.has(note)) {
            // If sustain is enabled, add to sustained notes instead of releasing
            if (sustainEnabled) {
              sustainedNotes.current.add(note);
              console.log(`Note ${note} sustained`);
            } else {
              try {
                synthRef.current.triggerRelease(note, time);
                activeNotes.current.delete(note);
                sustainedNotes.current.delete(note);
                
                // Only release filter envelope if no more notes are playing
                if (filterEnvelopeRef.current && activeNotes.current.size === 0 && filterEnvelopeActive.current) {
                  filterEnvelopeRef.current.triggerRelease(time);
                  filterEnvelopeActive.current = false;
                }
              } catch (error) {
                console.warn("Error releasing polyphonic note:", error);
                // Force cleanup on error
                activeNotes.current.delete(note);
                sustainedNotes.current.delete(note);
                
                // Fallback: try to release all notes if individual release fails
                if (synthRef.current instanceof Tone.PolySynth) {
                  try {
                    synthRef.current.releaseAll();
                    activeNotes.current.clear();
                    sustainedNotes.current.clear();
                  } catch (fallbackError) {
                    console.warn("Error in fallback releaseAll:", fallbackError);
                  }
                }
              }
            }
          }
        } else {
          // Handle monophonic synthesizers with note priority stack
          removeFromNoteStack(note);
          
          // If this was the current playing note or if it's in the active notes
          if (currentNote.current === note || activeNotes.current.has(note)) {
            // If sustain is enabled, add to sustained notes
            if (sustainEnabled) {
              sustainedNotes.current.add(note);
              console.log(`Monophonic note ${note} sustained`);
            } else {
              // Release the current note
              synthRef.current.triggerRelease(time);
              activeNotes.current.delete(note);
              sustainedNotes.current.delete(note);
              currentNote.current = null;
              
              // Check if there's another note in the stack to play
              const nextNote = getTopNote();
              if (nextNote) {
                // Play the next note in the stack (most recent held note)
                playMonophonicNote(nextNote, 0.8); // Use default velocity
                console.log(`Switched to previous note: ${nextNote}`);
              } else {
                // No more notes in stack, release filter envelope
                if (filterEnvelopeRef.current && filterEnvelopeActive.current) {
                  filterEnvelopeRef.current.triggerRelease(time);
                  filterEnvelopeActive.current = false;
                }
              }
            }
          }
          console.log(`Note stack after release: [${noteStack.current.join(', ')}], playing: ${currentNote.current}`);
        }
      } catch (error) {
        console.warn("Error triggering note release:", error);
        // Force cleanup on error
        activeNotes.current.delete(note);
        sustainedNotes.current.delete(note);
      }
    });
  }, [isLoaded, clearPendingRelease, removeFromNoteStack, getTopNote, playMonophonicNote, sustainEnabled]);

  // Force release all notes (emergency cleanup)
  const releaseAllNotes = useCallback(() => {
    if (!synthRef.current) return;
    
    try {
      // Clear all pending releases
      pendingReleases.current.forEach((timeout) => clearTimeout(timeout));
      pendingReleases.current.clear();
      
      // For polyphonic synths, use releaseAll for better cleanup
      if (synthRef.current instanceof Tone.PolySynth) {
        synthRef.current.releaseAll();
      } else {
        // For monophonic synths, force release current note
        if (currentNote.current) {
          synthRef.current.triggerRelease();
        }
      }
      
      // Clear active notes map
      activeNotes.current.clear();
      
      // Clear monophonic note stack and current note
      noteStack.current = [];
      currentNote.current = null;
      
      // Clear sustained notes
      sustainedNotes.current.clear();
      
      // Force release filter envelope
      if (filterEnvelopeRef.current && filterEnvelopeActive.current) {
        filterEnvelopeRef.current.triggerRelease();
        filterEnvelopeActive.current = false;
      }
      console.log("All notes released");
    } catch (error) {
      console.warn("Error releasing all notes:", error);
    }
  }, []);

  // Set sustain state
  const setSustain = useCallback((sustain: boolean) => {
    setSustainEnabled(sustain);
    
    // If sustain is turned off, release all sustained notes
    if (!sustain && sustainedNotes.current.size > 0) {
      const notesToRelease = Array.from(sustainedNotes.current);
      sustainedNotes.current.clear();
      
      // Release sustained notes that are not currently being held
      notesToRelease.forEach(note => {
        if (activeNotes.current.has(note)) {
          try {
            const time = Tone.now();
            if (synthRef.current instanceof Tone.PolySynth) {
              synthRef.current.triggerRelease(note, time);
            } else {
              // For monophonic synths, only release if it's the current note
              if (currentNote.current === note) {
                synthRef.current.triggerRelease(time);
                currentNote.current = null;
              }
            }
            activeNotes.current.delete(note);
          } catch (error) {
            console.warn("Error releasing sustained note:", error);
          }
        }
      });
    }
  }, []);

  // Stop all sustained notes (for sustain toggle functionality)
  const stopSustainedNotes = useCallback(() => {
    if (sustainedNotes.current.size > 0) {
      const notesToRelease = Array.from(sustainedNotes.current);
      sustainedNotes.current.clear();
      
      notesToRelease.forEach(note => {
        if (activeNotes.current.has(note)) {
          try {
            const time = Tone.now();
            if (synthRef.current instanceof Tone.PolySynth) {
              synthRef.current.triggerRelease(note, time);
            } else {
              // For monophonic synths, only release if it's the current note
              if (currentNote.current === note) {
                synthRef.current.triggerRelease(time);
                currentNote.current = null;
              }
            }
            activeNotes.current.delete(note);
          } catch (error) {
            console.warn("Error stopping sustained note:", error);
          }
        }
      });
    }
  }, []);

  // Initialize on mount and when synthType changes
  useEffect(() => {
    initializeSynth();
    
    // Copy ref values to avoid stale closure warning
    const pendingReleasesMap = pendingReleases.current;
    const activeNotesMap = activeNotes.current;
    const noteStackArray = noteStack.current;
    
    // Set up periodic cleanup to prevent stuck notes
    const cleanupInterval = setInterval(() => {
      if (synthRef.current instanceof Tone.PolySynth && activeNotes.current.size > 0) {
        // Check if any notes have been playing for too long (over 30 seconds)
        const now = Tone.now();
        const stuckNotes: string[] = [];
        
        activeNotes.current.forEach((startTime, note) => {
          if (typeof startTime === 'number' && now - startTime > 30) {
            stuckNotes.push(note);
          }
        });
        
        // Release stuck notes
        stuckNotes.forEach(note => {
          console.warn(`Releasing stuck note: ${note}`);
          try {
            if (synthRef.current instanceof Tone.PolySynth) {
              synthRef.current.triggerRelease(note);
            }
            activeNotes.current.delete(note);
          } catch (error) {
            console.warn("Error releasing stuck note:", error);
          }
        });
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      clearInterval(cleanupInterval);
      
      // Clear all pending releases
      pendingReleasesMap.forEach((timeout) => clearTimeout(timeout));
      pendingReleasesMap.clear();
      
      // Clear active notes
      activeNotesMap.clear();
      
      // Reset monophonic note stack and current note
      noteStackArray.length = 0;
      currentNote.current = null;
      
      // Reset filter envelope state
      filterEnvelopeActive.current = false;
      
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      if (filterRef.current) {
        filterRef.current.dispose();
      }
      if (filterEnvelopeRef.current) {
        filterEnvelopeRef.current.dispose();
      }
    };
  }, [initializeSynth]);

  const loadPresetParams = useCallback((presetParams: SynthState) => {
    setSynthState(presetParams);
    // Apply the preset parameters to the synthesizer
    updateSynthParams(presetParams);
  }, [updateSynthParams]);

  return {
    synthState,
    isLoaded,
    updateSynthParams,
    loadPresetParams,
    playNotes,
    stopNotes,
    releaseAllNotes,
    setSustain,
    stopSustainedNotes,
    synth: synthRef.current,
  };
}; 