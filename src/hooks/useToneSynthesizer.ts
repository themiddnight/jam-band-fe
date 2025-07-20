import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as Tone from "tone";
import { getOptimalAudioConfig } from "../constants/audioConfig";
import { throttle } from "../utils/performanceUtils";

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
  const pendingStop = useRef<Map<string, number>>(new Map());
  const filterEnvelopeActive = useRef<boolean>(false);
  const sustainedNotes = useRef<Set<string>>(new Set());
  const heldNotes = useRef<Set<string>>(new Set()); // Track notes currently being held down
  
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

      // Create filter with current state values (fallback to defaults if needed)
      filterRef.current = new Tone.Filter({
        frequency: synthState.filterFrequency !== undefined ? synthState.filterFrequency : defaultSynthState.filterFrequency,
        Q: synthState.filterResonance !== undefined ? synthState.filterResonance : defaultSynthState.filterResonance,
        type: "lowpass",
      });

      // Create gain node for volume control with current state (fallback to defaults if needed)
      gainRef.current = new Tone.Gain(synthState.volume !== undefined ? synthState.volume : defaultSynthState.volume);

      // Create filter envelope for analog synthesizers with current state
      if (synthType.startsWith("analog_")) {
        filterEnvelopeRef.current = new Tone.FrequencyEnvelope({
          attack: synthState.filterAttack !== undefined ? synthState.filterAttack : defaultSynthState.filterAttack,
          decay: synthState.filterDecay !== undefined ? synthState.filterDecay : defaultSynthState.filterDecay,
          sustain: synthState.filterSustain !== undefined ? synthState.filterSustain : defaultSynthState.filterSustain,
          release: synthState.filterRelease !== undefined ? synthState.filterRelease : defaultSynthState.filterRelease,
          baseFrequency: synthState.filterFrequency !== undefined ? synthState.filterFrequency : defaultSynthState.filterFrequency,
          octaves: 4,
        });
        
        // Connect filter envelope to filter frequency
        filterEnvelopeRef.current.connect(filterRef.current.frequency);
      }

      switch (synthType) {
        case "analog_mono":
          synthRef.current = new Tone.Synth({
            oscillator: { type: (synthState.oscillatorType !== undefined ? synthState.oscillatorType : defaultSynthState.oscillatorType) as any },
            envelope: {
              attack: synthState.ampAttack !== undefined ? synthState.ampAttack : defaultSynthState.ampAttack,
              decay: synthState.ampDecay !== undefined ? synthState.ampDecay : defaultSynthState.ampDecay,
              sustain: synthState.ampSustain !== undefined ? synthState.ampSustain : defaultSynthState.ampSustain,
              release: synthState.ampRelease !== undefined ? synthState.ampRelease : defaultSynthState.ampRelease,
            },
          });
          break;

        case "analog_poly":
          synthRef.current = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: (synthState.oscillatorType !== undefined ? synthState.oscillatorType : defaultSynthState.oscillatorType) as any },
            envelope: {
              attack: synthState.ampAttack !== undefined ? synthState.ampAttack : defaultSynthState.ampAttack,
              decay: synthState.ampDecay !== undefined ? synthState.ampDecay : defaultSynthState.ampDecay,
              sustain: synthState.ampSustain !== undefined ? synthState.ampSustain : defaultSynthState.ampSustain,
              release: synthState.ampRelease !== undefined ? synthState.ampRelease : defaultSynthState.ampRelease,
            },
          });
          break;

        case "analog_bass":
          synthRef.current = new Tone.Synth({
            oscillator: { type: (synthState.oscillatorType !== undefined ? synthState.oscillatorType : defaultSynthState.oscillatorType) as any },
            envelope: {
              attack: synthState.ampAttack !== undefined ? synthState.ampAttack : defaultSynthState.ampAttack,
              decay: synthState.ampDecay !== undefined ? synthState.ampDecay : defaultSynthState.ampDecay,
              sustain: synthState.ampSustain !== undefined ? synthState.ampSustain : defaultSynthState.ampSustain,
              release: synthState.ampRelease !== undefined ? synthState.ampRelease : defaultSynthState.ampRelease,
            },
          });
          break;

        case "analog_lead":
          synthRef.current = new Tone.Synth({
            oscillator: { type: (synthState.oscillatorType !== undefined ? synthState.oscillatorType : defaultSynthState.oscillatorType) as any },
            envelope: {
              attack: synthState.ampAttack !== undefined ? synthState.ampAttack : defaultSynthState.ampAttack,
              decay: synthState.ampDecay !== undefined ? synthState.ampDecay : defaultSynthState.ampDecay,
              sustain: synthState.ampSustain !== undefined ? synthState.ampSustain : defaultSynthState.ampSustain,
              release: synthState.ampRelease !== undefined ? synthState.ampRelease : defaultSynthState.ampRelease,
            },
          });
          break;

        case "fm_mono":
          synthRef.current = new Tone.FMSynth({
            harmonicity: synthState.harmonicity !== undefined ? synthState.harmonicity : defaultSynthState.harmonicity,
            modulationIndex: synthState.modulationIndex !== undefined ? synthState.modulationIndex : defaultSynthState.modulationIndex,
            envelope: {
              attack: synthState.ampAttack !== undefined ? synthState.ampAttack : defaultSynthState.ampAttack,
              decay: synthState.ampDecay !== undefined ? synthState.ampDecay : defaultSynthState.ampDecay,
              sustain: synthState.ampSustain !== undefined ? synthState.ampSustain : defaultSynthState.ampSustain,
              release: synthState.ampRelease !== undefined ? synthState.ampRelease : defaultSynthState.ampRelease,
            },
            modulation: {
              type: "sine",
            },
            modulationEnvelope: {
              attack: synthState.modAttack !== undefined ? synthState.modAttack : defaultSynthState.modAttack,
              decay: synthState.modDecay !== undefined ? synthState.modDecay : defaultSynthState.modDecay,
              sustain: synthState.modSustain !== undefined ? synthState.modSustain : defaultSynthState.modSustain,
              release: synthState.modRelease !== undefined ? synthState.modRelease : defaultSynthState.modRelease,
            },
          });
          break;

        case "fm_poly":
          synthRef.current = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: synthState.harmonicity !== undefined ? synthState.harmonicity : defaultSynthState.harmonicity,
            modulationIndex: synthState.modulationIndex !== undefined ? synthState.modulationIndex : defaultSynthState.modulationIndex,
            envelope: {
              attack: synthState.ampAttack !== undefined ? synthState.ampAttack : defaultSynthState.ampAttack,
              decay: synthState.ampDecay !== undefined ? synthState.ampDecay : defaultSynthState.ampDecay,
              sustain: synthState.ampSustain !== undefined ? synthState.ampSustain : defaultSynthState.ampSustain,
              release: synthState.ampRelease !== undefined ? synthState.ampRelease : defaultSynthState.ampRelease,
            },
            modulation: {
              type: "sine",
            },
            modulationEnvelope: {
              attack: synthState.modAttack !== undefined ? synthState.modAttack : defaultSynthState.modAttack,
              decay: synthState.modDecay !== undefined ? synthState.modDecay : defaultSynthState.modDecay,
              sustain: synthState.modSustain !== undefined ? synthState.modSustain : defaultSynthState.modSustain,
              release: synthState.modRelease !== undefined ? synthState.modRelease : defaultSynthState.modRelease,
            },
          });
          break;

        default:
          synthRef.current = new Tone.Synth({
            envelope: {
              attack: synthState.ampAttack !== undefined ? synthState.ampAttack : defaultSynthState.ampAttack,
              decay: synthState.ampDecay !== undefined ? synthState.ampDecay : defaultSynthState.ampDecay,
              sustain: synthState.ampSustain !== undefined ? synthState.ampSustain : defaultSynthState.ampSustain,
              release: synthState.ampRelease !== undefined ? synthState.ampRelease : defaultSynthState.ampRelease,
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
    } catch (error) {
      console.error("Failed to initialize synthesizer:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synthType]); // Remove synthState dependency to prevent re-initialization on param changes

  // Create a throttled version of the actual parameter update function
  const updateSynthParamsInternal = useCallback((params: Partial<SynthState>) => {
    if (synthRef.current && filterRef.current && gainRef.current) {
      try {
        const synth = synthRef.current as any;
        const filter = filterRef.current;
        const gain = gainRef.current;
        const filterEnvelope = filterEnvelopeRef.current;
        
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
      } catch (error) {
        console.error("Error updating synth parameters:", error);
      }
    }
  }, []);

  // Create throttled version for frequent updates (like knob adjustments)
  const throttledUpdateParams = useMemo(
    () => throttle(updateSynthParamsInternal, 16), // ~60fps
    [updateSynthParamsInternal]
  );

  // Update synthesizer parameters - handles both state and audio parameters
  const updateSynthParams = useCallback((params: Partial<SynthState>) => {
    // Always update state immediately for UI responsiveness
    setSynthState(prev => ({ ...prev, ...params }));
    
    // Use throttled update for audio parameters to prevent audio glitches
    throttledUpdateParams(params);
  }, [throttledUpdateParams]);

  // Play notes
  const playNotes = useCallback((notes: string[], velocity: number) => {
    if (!synthRef.current || !isLoaded) return;

    notes.forEach(note => {
      // Clear any pending stop timeouts for this note
      if (pendingStop.current.has(note)) {
        clearTimeout(pendingStop.current.get(note));
        pendingStop.current.delete(note);
      }
      
      // Clear any pending releases for this note
      clearPendingRelease(note);
      
      if (synthRef.current instanceof Tone.PolySynth) {
        // Handle polyphonic synthesizers
        try {
          // If the note is already playing, release it first to avoid stacking
          if (activeNotes.current.has(note)) {
            synthRef.current.triggerRelease(note, Tone.now());
            activeNotes.current.delete(note);
            sustainedNotes.current.delete(note);
          }
          
          // Tone.js handles re-triggering notes gracefully, so we can just call triggerAttack.
          // This avoids race conditions with rapid note on/off events.
          synthRef.current.triggerAttack(note, Tone.now(), velocity);
          activeNotes.current.set(note, Tone.now());
          heldNotes.current.add(note); // Mark as currently held

          // Trigger filter envelope for analog synthesizers (always reset on new keystroke)
          if (filterEnvelopeRef.current) {
            // Release filter envelope first to ensure reset
            if (filterEnvelopeActive.current) {
              filterEnvelopeRef.current.triggerRelease(Tone.now());
              filterEnvelopeActive.current = false;
            }
            // Small delay before triggering new filter envelope
            setTimeout(() => {
              if (filterEnvelopeRef.current) {
                filterEnvelopeRef.current.triggerAttack(Tone.now(), velocity);
                filterEnvelopeActive.current = true;
              }
            }, 10);
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
        
        if (topNote === note) { // Is this a new highest priority note?
          // If a note is already sounding, change its pitch
          if (currentNote.current) {
            synthRef.current.setNote(note);
            // Update which note is sounding
            if (currentNote.current) {
              activeNotes.current.delete(currentNote.current);
            }
          } else {
            // If synth is silent, trigger attack
            synthRef.current.triggerAttack(note, undefined, velocity);
            
            // Trigger filter envelope if it exists
            if (filterEnvelopeRef.current) {
                filterEnvelopeRef.current.triggerAttack();
                filterEnvelopeActive.current = true;
            }
          }
          
          currentNote.current = note;
          activeNotes.current.set(note, Tone.now());
        }
      }
    });
  }, [isLoaded, clearPendingRelease, addToNoteStack, getTopNote]);

  // Stop notes
  const stopNotes = useCallback((notes: string[]) => {
    if (!synthRef.current || !isLoaded) return;

    const now = Tone.now();
    const releaseTime = now + 0.01; // Add a small delay to avoid clicks

    notes.forEach(note => {
      // If a note is played again very quickly, we want to cancel a pending stop
      if (pendingStop.current.has(note)) {
        clearTimeout(pendingStop.current.get(note));
        pendingStop.current.delete(note);
      }

      const timeoutId = window.setTimeout(() => {
        if (!synthRef.current) return;
        
        try {
          if (synthRef.current instanceof Tone.PolySynth) {
            if (activeNotes.current.has(note)) {
              heldNotes.current.delete(note); // Remove from held notes
              
              if (sustainEnabled) {
                sustainedNotes.current.add(note);
              } else {
                synthRef.current.triggerRelease(note, releaseTime);
                activeNotes.current.delete(note);
                sustainedNotes.current.delete(note);
                if (filterEnvelopeRef.current && activeNotes.current.size === 0 && filterEnvelopeActive.current) {
                  filterEnvelopeRef.current.triggerRelease(releaseTime);
                  filterEnvelopeActive.current = false;
                }
              }
            }
          } else {
            // Handle monophonic synthesizers with note priority stack
            removeFromNoteStack(note);
            
            // Was the released note the one that was sounding?
            if (currentNote.current === note) {
              const nextNote = getTopNote();
          
              if (sustainEnabled) {
                sustainedNotes.current.add(note);
                return; // Don't change note or release if sustain is on
              }
          
              if (nextNote) {
                // Another note is held, switch to it (legato)
                synthRef.current.setNote(nextNote);
                currentNote.current = nextNote;
                activeNotes.current.delete(note);
                activeNotes.current.set(nextNote, Tone.now());
              } else {
                // No other notes held, so release the envelope
                synthRef.current.triggerRelease();
                currentNote.current = null;
                activeNotes.current.delete(note);
          
                // Release filter envelope if it exists
                if (filterEnvelopeRef.current && filterEnvelopeActive.current) {
                  filterEnvelopeRef.current.triggerRelease();
                  filterEnvelopeActive.current = false;
                }
              }
            }
          }
        } catch (error) {
          console.warn("Error triggering note release:", error);
          activeNotes.current.delete(note);
          sustainedNotes.current.delete(note);
        } finally {
          pendingStop.current.delete(note);
        }
      }, 5); // 5ms delay to allow for rapid re-triggering

      pendingStop.current.set(note, timeoutId);
    });
  }, [isLoaded, removeFromNoteStack, getTopNote, sustainEnabled]);

  // Force release all notes (emergency cleanup)
  const releaseAllNotes = useCallback(() => {
    if (!synthRef.current) return;
    
    try {
      // Clear all pending releases
      pendingReleases.current.forEach((timeout) => clearTimeout(timeout));
      pendingReleases.current.clear();
      
      // Clear all pending stop timeouts
      pendingStop.current.forEach(timeout => clearTimeout(timeout));
      pendingStop.current.clear();
      
      if (synthRef.current instanceof Tone.PolySynth) {
        // Only release notes that are sustained but not currently held
        try {
          sustainedNotes.current.forEach(note => {
            if (!heldNotes.current.has(note)) {
              synthRef.current.triggerRelease(note);
              activeNotes.current.delete(note);
            }
          });
          
          // Re-trigger currently held notes to ensure they continue playing
          heldNotes.current.forEach(note => {
            if (!activeNotes.current.has(note)) {
              synthRef.current.triggerAttack(note, Tone.now(), 0.8);
              activeNotes.current.set(note, Tone.now());
            }
          });
        } catch (error) {
          console.warn("Error releasing sustained notes:", error);
        }
        
        // Release filter envelope only if no notes are playing
        if (filterEnvelopeRef.current && activeNotes.current.size === 0 && filterEnvelopeActive.current) {
          filterEnvelopeRef.current.triggerRelease();
          filterEnvelopeActive.current = false;
        }
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
    } catch (error) {
      console.warn("Error releasing all notes:", error);
    }
  }, []);

  // Set sustain state
  const setSustain = useCallback((sustain: boolean) => {
    setSustainEnabled(sustain);
    
    // If sustain is turned off, release all sustained notes
    if (!sustain && sustainedNotes.current.size > 0) {
      if (synthRef.current instanceof Tone.PolySynth) {
        // Only release sustained notes that aren't currently being held
        try {
          sustainedNotes.current.forEach(note => {
            if (!heldNotes.current.has(note)) {
              synthRef.current.triggerRelease(note);
              activeNotes.current.delete(note);
            }
          });
        } catch (error) {
          console.warn("Error releasing sustained notes:", error);
        }
        
        // Release filter envelope only if no notes are playing
        if (filterEnvelopeRef.current && activeNotes.current.size === 0 && filterEnvelopeActive.current) {
          filterEnvelopeRef.current.triggerRelease();
          filterEnvelopeActive.current = false;
        }
      } else {
        // For mono synths, if no keys are currently held, release the note.
        if (noteStack.current.length === 0 && currentNote.current) {
          synthRef.current.triggerRelease();
          activeNotes.current.delete(currentNote.current);
          currentNote.current = null;

          if (filterEnvelopeRef.current && filterEnvelopeActive.current) {
            filterEnvelopeRef.current.triggerRelease();
            filterEnvelopeActive.current = false;
          }
        }
      }
      
      // Clear sustained notes after processing
      sustainedNotes.current.clear();
    }
  }, []);

  // Stop sustained notes when sustain is released
  const stopSustainedNotes = useCallback(() => {
    if (sustainedNotes.current.size > 0) {
      if (synthRef.current instanceof Tone.PolySynth) {
        // Only release sustained notes that aren't currently being held
        try {
          sustainedNotes.current.forEach(note => {
            if (!heldNotes.current.has(note)) {
              synthRef.current.triggerRelease(note);
              activeNotes.current.delete(note);
            }
          });
        } catch (error) {
          console.warn("Error releasing sustained notes:", error);
        }
        
        // Release filter envelope only if no notes are playing
        if (filterEnvelopeRef.current && activeNotes.current.size === 0 && filterEnvelopeActive.current) {
          filterEnvelopeRef.current.triggerRelease();
          filterEnvelopeActive.current = false;
        }
      } else {
        // For mono synths, if no keys are currently held, release the note.
        if (noteStack.current.length === 0 && currentNote.current) {
          synthRef.current.triggerRelease();
          activeNotes.current.delete(currentNote.current);
          currentNote.current = null;
          
          if (filterEnvelopeRef.current && filterEnvelopeActive.current) {
            filterEnvelopeRef.current.triggerRelease();
            filterEnvelopeActive.current = false;
          }
        }
      }
      
      // Clear sustained notes after processing
      sustainedNotes.current.clear();
    }
  }, []);

  // Load preset parameters
  const loadPresetParams = useCallback((params: SynthState) => {
    // The preset already contains SynthState, so we can use it directly
    setSynthState(params);
    // Apply the preset parameters to the synthesizer
    updateSynthParams(params);
  }, [updateSynthParams]);

  // Initialize on mount and when synthType changes
  useEffect(() => {
    if (synthType) {
      initializeSynth();
    } else {
      // Cleanup when no synth is selected
      if (synthRef.current) {
        releaseAllNotes();
        synthRef.current.dispose();
        synthRef.current = null;
        setIsLoaded(false);
      }
    }
  }, [synthType, initializeSynth, releaseAllNotes]);

  return {
    isLoaded,
    synthState,
    updateSynthParams,
    playNotes,
    stopNotes,
    setSustain,
    stopSustainedNotes,
    loadPresetParams,
    synth: synthRef.current,
  };
}; 