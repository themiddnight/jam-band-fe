import { useState, useRef, useEffect, useCallback } from "react";
import { Soundfont, DrumMachine } from "smplr";
import {
  SOUNDFONT_INSTRUMENTS,
  DRUM_MACHINES,
  SYNTHESIZER_INSTRUMENTS,
  InstrumentCategory,
} from "../constants/instruments";
import { ControlType } from "../types";
import { getCachedDrumMachines } from "../utils/drumMachineUtils";
import { useToneSynthesizer, type SynthState } from "./useToneSynthesizer";
import {
  isSafari,
  createWebKitCompatibleAudioContext,
  handleSafariAudioError,
  getSafariLoadTimeout,
} from "../utils/webkitCompat";
import { useInstrumentPreferencesStore } from "../stores/instrumentPreferencesStore";

export const useInstrument = (
  initialInstrument?: string,
  initialCategory = InstrumentCategory.Melodic,
  onSynthParamsChange?: (params: Partial<SynthState>) => void
) => {
  // Get saved preferences
  const { preferences, setPreferences, clearPreferences } = useInstrumentPreferencesStore();
  
  // Use Safari-compatible instrument as default if no instrument specified and Safari is detected
  const getInitialInstrument = (): string => {
    if (initialInstrument) return initialInstrument;
    
    // Validate saved instrument before using it
    if (preferences.instrument) {
      const drumMachines = DRUM_MACHINES.map(dm => dm.value);
      const synthesizers = SYNTHESIZER_INSTRUMENTS.map(s => s.value);
      const soundfonts = SOUNDFONT_INSTRUMENTS.map(s => s.value);
      
      // Check if the saved instrument exists in any category
      if (drumMachines.includes(preferences.instrument) || 
          synthesizers.includes(preferences.instrument) || 
          soundfonts.includes(preferences.instrument)) {
        return preferences.instrument;
      } else {
        // Clear invalid preferences
        clearPreferences();
      }
    }
    
    if (isSafari() && (initialCategory || preferences.category) === InstrumentCategory.Melodic) {
      return "bright_acoustic_piano"; // More Safari-compatible than acoustic_grand_piano
    }
    return "acoustic_grand_piano";
  };
  
  const getInitialCategory = (): InstrumentCategory => {
    if (initialCategory) return initialCategory;
    if (preferences.category) return preferences.category;
    
    // Auto-detect category based on saved instrument name
    if (preferences.instrument) {
      const drumMachines = DRUM_MACHINES.map(dm => dm.value);
      const synthesizers = SYNTHESIZER_INSTRUMENTS.map(s => s.value);
      
      if (drumMachines.includes(preferences.instrument)) {
        return InstrumentCategory.DrumBeat;
      } else if (synthesizers.includes(preferences.instrument)) {
        return InstrumentCategory.Synthesizer;
      }
    }
    
    return InstrumentCategory.Melodic;
  };
  
  const [instrument, setInstrument] = useState<any>(null);
  const [currentInstrument, setCurrentInstrument] = useState<string>(
    getInitialInstrument()
  );
  const [currentCategory, setCurrentCategory] =
    useState<InstrumentCategory>(getInitialCategory());
  const [sustain, setSustain] = useState<boolean>(false);
  const [isLoadingInstrument, setIsLoadingInstrument] =
    useState<boolean>(false);
  const [availableSamples, setAvailableSamples] = useState<string[]>([]);
  const [dynamicDrumMachines, setDynamicDrumMachines] = useState(DRUM_MACHINES);

  const [isAudioContextReady, setIsAudioContextReady] =
    useState<boolean>(false);
  const [audioContextError, setAudioContextError] = useState<string | null>(
    null
  );
  const audioContext = useRef<AudioContext | null>(null);
  const sustainedNotes = useRef<Set<any>>(new Set());
  const activeNotes = useRef<Map<string, any>>(new Map());
  const keyHeldNotes = useRef<Set<string>>(new Set());
  const initRetryCount = useRef<number>(0);
  const maxRetries = 3;
  const failedInstruments = useRef<Set<string>>(new Set());
  const synthStateRef = useRef<SynthState | null>(null);

  // Get the list of instruments for the current category
  const getInstrumentsForCategory = useCallback(
    (category: InstrumentCategory): string[] => {
      switch (category) {
        case InstrumentCategory.DrumBeat:
          return dynamicDrumMachines.map((inst) => inst.value);
        case InstrumentCategory.Synthesizer:
          return SYNTHESIZER_INSTRUMENTS.map((inst) => inst.value);
        default:
          return SOUNDFONT_INSTRUMENTS.map((inst) => inst.value);
      }
    },
    [dynamicDrumMachines]
  );

  // Find the next instrument in the list to try
  const getNextInstrumentToTry = useCallback(
    (currentInst: string, category: InstrumentCategory): string | null => {
      const instruments = getInstrumentsForCategory(category);
      const currentIndex = instruments.indexOf(currentInst);

      if (currentIndex === -1) {
        // If current instrument not found in list, start from beginning
        return instruments[0] || null;
      }

      // Try the next instrument in the list
      const nextIndex = currentIndex + 1;
      if (nextIndex < instruments.length) {
        return instruments[nextIndex];
      }

      // If we've tried all instruments, return null
      return null;
    },
    [getInstrumentsForCategory]
  );

  // Initialize Tone.js synthesizer for synthesizer category
  const toneSynthesizer = useToneSynthesizer(
    currentCategory === InstrumentCategory.Synthesizer ? currentInstrument : ""
  );

  // Update synthStateRef when toneSynthesizer.synthState changes
  useEffect(() => {
    if (toneSynthesizer.synthState) {
      synthStateRef.current = toneSynthesizer.synthState;
    }
  }, [toneSynthesizer.synthState]);

  // Set up callback for synth parameter changes to sync to remote users
  useEffect(() => {
    const setOnParamsChange = toneSynthesizer.setOnParamsChange;
    if (setOnParamsChange && onSynthParamsChange) {
      setOnParamsChange((params) => {
        console.log("🎛️ Synth parameters changed locally, syncing to remote users:", params);
        onSynthParamsChange(params);
      });
    }
  }, [toneSynthesizer.setOnParamsChange, onSynthParamsChange]);

  const initializeAudioContext = useCallback(async () => {
    try {
      setAudioContextError(null);

      if (!audioContext.current) {
        audioContext.current = await createWebKitCompatibleAudioContext();
      }

      // Ensure context is running - critical for Safari
      if (audioContext.current.state === "suspended") {
        await audioContext.current.resume();

        // Wait a bit for Safari to properly initialize
        if (isSafari()) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Verify context is actually running
      if (audioContext.current.state !== "running") {
        throw new Error(
          `AudioContext state is ${audioContext.current.state}, expected 'running'`
        );
      }

      setIsAudioContextReady(true);
      initRetryCount.current = 0;
      return audioContext.current;
    } catch (error) {
      console.error("Failed to initialize AudioContext:", error);
      setAudioContextError(
        error instanceof Error
          ? error.message
          : "AudioContext initialization failed"
      );

      // Retry logic for Safari
      if (initRetryCount.current < maxRetries) {
        initRetryCount.current++;
        setTimeout(() => initializeAudioContext(), 1000);
      }

      throw error;
    }
  }, []);

  const loadInstrument = useCallback(
    async (
      instrumentName: string,
      category: InstrumentCategory = currentCategory
    ) => {
      // Validate that the instrument belongs to the specified category
      const drumMachines = DRUM_MACHINES.map(dm => dm.value);
      const synthesizers = SYNTHESIZER_INSTRUMENTS.map(s => s.value);
      const soundfonts = SOUNDFONT_INSTRUMENTS.map(s => s.value);
      
      let validatedCategory = category;
      if (drumMachines.includes(instrumentName)) {
        validatedCategory = InstrumentCategory.DrumBeat;
      } else if (synthesizers.includes(instrumentName)) {
        validatedCategory = InstrumentCategory.Synthesizer;
      } else if (soundfonts.includes(instrumentName)) {
        validatedCategory = InstrumentCategory.Melodic;
      }
      
      // Use validated category instead of the provided one
      const finalCategory = validatedCategory;
      // Skip loading for synthesizer category - handled by Tone.js
      if (finalCategory === InstrumentCategory.Synthesizer) {
        setCurrentInstrument(instrumentName);
        setCurrentCategory(finalCategory);
        
        // Save preferences when instrument changes
        setPreferences(instrumentName, finalCategory);
        
        // Wait for the synthesizer to be ready, then sync parameters
        // Use a more reliable approach with multiple attempts
        const syncParameters = () => {
          if (onSynthParamsChange && synthStateRef.current) {
            console.log("🎛️ Syncing initial synth parameters for new instrument:", instrumentName);
            onSynthParamsChange(synthStateRef.current);
          } else {
            // If synthStateRef is not ready, try again after a short delay
            setTimeout(syncParameters, 50);
          }
        };
        
        // Start syncing after a short delay to ensure the synthesizer is initialized
        setTimeout(syncParameters, 100);
        
        setIsLoadingInstrument(false);
        return;
      }

      // Don't load if AudioContext isn't ready
      if (!audioContext.current || audioContext.current.state !== "running") {
        return;
      }

      setIsLoadingInstrument(true);
      setAudioContextError(null);

      try {
        let newInstrument: any;

        if (finalCategory === InstrumentCategory.DrumBeat) {
          newInstrument = new DrumMachine(audioContext.current, {
            instrument: instrumentName,
            volume: 127,
          });
        } else {
          // Default to Soundfont for melodic instruments
          newInstrument = new Soundfont(audioContext.current, {
            instrument: instrumentName,
            volume: 127,
          });
        }

        // Safari-specific loading with timeout and better error handling
        const loadTimeout = getSafariLoadTimeout();

        const loadPromise = new Promise<void>((resolve, reject) => {
          // Set up timeout
          const timeoutId = setTimeout(() => {
            reject(
              new Error(`Instrument loading timed out after ${loadTimeout}ms`)
            );
          }, loadTimeout);

          // Wait for the instrument to load
          newInstrument.load
            .then(() => {
              clearTimeout(timeoutId);
              resolve();
            })
            .catch((error: any) => {
              clearTimeout(timeoutId);
              // Use Safari-specific error handling
              reject(handleSafariAudioError(error, instrumentName));
            });
        });

        await loadPromise;

        setInstrument(newInstrument);
        setCurrentInstrument(instrumentName);
        setCurrentCategory(finalCategory);
        
        // Save preferences when instrument changes
        setPreferences(instrumentName, finalCategory);

        // Get available samples for drum machines
        if (
          finalCategory === InstrumentCategory.DrumBeat &&
          newInstrument.getSampleNames
        ) {
          const samples = newInstrument.getSampleNames();
          setAvailableSamples(samples);
        } else {
          setAvailableSamples([]);
        }
      } catch (error) {
        console.error("Failed to load instrument:", error);
        setAudioContextError(
          error instanceof Error ? error.message : "Failed to load instrument"
        );

        // For Safari decoding errors or invalid instrument errors, try the next instrument in the list
        if (
          (isSafari() &&
          error instanceof Error &&
          error.message.includes("decoding")) ||
          (error instanceof Error && 
           (error.message.includes("Invalid MIDI.js Soundfont format") ||
            error.message.includes("404") ||
            error.message.includes("Not Found")))
        ) {
          // Mark this instrument as failed
          failedInstruments.current.add(instrumentName);

          // Try the next instrument in the list
          const nextInstrument = getNextInstrumentToTry(
            instrumentName,
            finalCategory
          );

          if (
            nextInstrument &&
            !failedInstruments.current.has(nextInstrument)
          ) {
            setCurrentInstrument(nextInstrument);
            setAudioContextError(null);

            // Try loading the next instrument
            setTimeout(() => loadInstrument(nextInstrument, category), 500);
          } else {
            console.error(
              "All instruments in this category have failed. Switching to synthesizer mode."
            );
            setAudioContextError(
              "Failed to load the saved instrument. Switching to synthesizer mode for compatibility."
            );
            // Switch to synthesizer category as last resort
            setTimeout(() => {
              setCurrentCategory(InstrumentCategory.Synthesizer);
              setCurrentInstrument("analog_mono");
              setPreferences("analog_mono", InstrumentCategory.Synthesizer);
              // Clear failed instruments cache for next attempt
              failedInstruments.current.clear();
            }, 1000);
          }
        }
      } finally {
        setIsLoadingInstrument(false);
      }
    },
    [currentCategory, getNextInstrumentToTry, setPreferences, onSynthParamsChange]
  );

  // Load dynamic drum machines
  useEffect(() => {
    const loadDrumMachines = async () => {
      try {
        const availableDrumMachines = await getCachedDrumMachines();
        setDynamicDrumMachines(availableDrumMachines);
      } catch (error) {
        console.error("Failed to load dynamic drum machines:", error);
      }
    };

    loadDrumMachines();
  }, []);

  // Auto-initialize audio context when component mounts
  useEffect(() => {
    const autoInitialize = async () => {
      if (!isAudioContextReady && !audioContext.current) {
        try {
          await initializeAudioContext();
        } catch (error) {
          console.error("Auto-initialization failed:", error);
        }
      }
    };
    
    autoInitialize();
  }, [isAudioContextReady, initializeAudioContext]);

  // Load instrument when AudioContext becomes ready
  useEffect(() => {
    if (isAudioContextReady && !instrument) {
      loadInstrument(currentInstrument);
    }
  }, [isAudioContextReady, instrument, currentInstrument, loadInstrument]);

  // Sync sustain state with synthesizer when it becomes loaded
  useEffect(() => {
    if (
      currentCategory === InstrumentCategory.Synthesizer &&
      toneSynthesizer.isLoaded &&
      toneSynthesizer.setSustain
    ) {
      toneSynthesizer.setSustain(sustain);
    }
  }, [
    currentCategory,
    toneSynthesizer.isLoaded,
    toneSynthesizer.setSustain,
    sustain,
    toneSynthesizer,
  ]);

  // Keep synth state ref updated
  useEffect(() => {
    if (toneSynthesizer.synthState) {
      synthStateRef.current = toneSynthesizer.synthState;
    }
  }, [toneSynthesizer.synthState]);

  useEffect(() => {
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  const playNote = useCallback(
    async (notes: string[], velocity: number, isKeyHeld: boolean = false) => {
      if (!audioContext.current || audioContext.current.state !== "running") {
        console.warn("AudioContext not ready for playback");
        return;
      }

      if (!instrument) {
        console.warn("No instrument loaded for playback");
        return;
      }

      try {
        // Handle different instrument categories
        if (currentCategory === InstrumentCategory.Synthesizer) {
          // Use Tone.js synthesizer directly
          const synthState = toneSynthesizer.synthState;
          if (synthState) {
            await toneSynthesizer.playNotes(notes, velocity);
          }
        } else if (currentCategory === InstrumentCategory.DrumBeat) {
          // Optimized drum machine playback with minimal latency
          const currentTime = audioContext.current.currentTime;
          
          notes.forEach((note) => {
            // Stop any existing note to prevent buildup
            const existingNote = activeNotes.current.get(note);
            if (existingNote) {
              try {
                if (typeof existingNote === 'function') {
                  existingNote();
                } else if (existingNote.stop) {
                  existingNote.stop();
                }
              } catch (error) {
                console.warn(`Warning stopping existing drum note:`, error);
              }
              activeNotes.current.delete(note);
            }

            // Use precise timing for drum hits
            const playedNote = instrument.start({
              note,
              velocity: Math.round(Math.max(1, Math.min(127, velocity * 127))),
              time: currentTime + 0.001, // Minimal scheduling ahead for consistency
            });

            if (playedNote) {
              activeNotes.current.set(note, playedNote);
              
              // Auto-cleanup for drum samples after reasonable time
              setTimeout(() => {
                if (activeNotes.current.get(note) === playedNote) {
                  activeNotes.current.delete(note);
                }
              }, 3000);

              if (isKeyHeld) {
                keyHeldNotes.current.add(note);
              }

              if (sustain && !isKeyHeld) {
                sustainedNotes.current.add(playedNote);
              }

              // Auto-stop for non-sustained drum hits
              if (!isKeyHeld && !sustain) {
                setTimeout(() => {
                  if (activeNotes.current.has(note) && !keyHeldNotes.current.has(note)) {
                    try {
                      if (typeof playedNote === 'function') {
                        playedNote();
                      } else if (playedNote.stop) {
                        playedNote.stop();
                      }
                    } catch (error) {
                      console.warn(`Warning auto-stopping drum note:`, error);
                    }
                    activeNotes.current.delete(note);
                  }
                }, 200); // Shorter timeout for drums
              }
            }
          });
        } else {
          // Default handling for soundfont instruments
          notes.forEach((note) => {
            const existingNote = activeNotes.current.get(note);
            if (existingNote) {
              existingNote();
            }

            const playedNote = instrument.start({
              note,
              velocity: Math.round(Math.max(1, Math.min(127, velocity * 127))),
              time: audioContext.current!.currentTime,
            });

            activeNotes.current.set(note, playedNote);

            if (isKeyHeld) {
              keyHeldNotes.current.add(note);
            }

            if (sustain && !isKeyHeld) {
              sustainedNotes.current.add(playedNote);
            }

            if (!isKeyHeld && !sustain) {
              setTimeout(() => {
                if (activeNotes.current.has(note) && !keyHeldNotes.current.has(note)) {
                  if (playedNote) {
                    playedNote();
                  }
                  activeNotes.current.delete(note);
                }
              }, 300);
            }
          });
        }
      } catch (error) {
        console.error("Error playing note:", error);
      }
    },
    [instrument, currentCategory, sustain, toneSynthesizer]
  );

  const stopNotes = (notes: string[]) => {
    // Handle synthesizer category with Tone.js
    if (currentCategory === InstrumentCategory.Synthesizer) {
      if (toneSynthesizer.isLoaded) {
        // Batch note-off events for synthesizers
        toneSynthesizer.stopNotes(notes);
        notes.forEach(note => keyHeldNotes.current.delete(note));
      }
      return;
    }

    // Handle other categories (Soundfont and DrumMachine)
    notes.forEach((note) => {
      const activeNote = activeNotes.current.get(note);
      if (activeNote) {
        activeNote(); // Call the stop function directly
        activeNotes.current.delete(note);
        sustainedNotes.current.delete(activeNote);
      }
      keyHeldNotes.current.delete(note);
    });
  };

  const setSustainState = useCallback(
    (newSustain: boolean) => {
      setSustain(newSustain);

      // Pass sustain state to synthesizer if it's the current category
      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        toneSynthesizer.setSustain
      ) {
        toneSynthesizer.setSustain(newSustain);
      }
    },
    [currentCategory, toneSynthesizer]
  );

  const stopSustainedNotes = useCallback(() => {
    // Handle synthesizer category with Tone.js
    if (currentCategory === InstrumentCategory.Synthesizer) {
      if (toneSynthesizer.isLoaded && toneSynthesizer.stopSustainedNotes) {
        toneSynthesizer.stopSustainedNotes();
      }
      return;
    }

    // Handle other categories (Soundfont and DrumMachine)
    sustainedNotes.current.forEach((note) => {
      if (note) {
        note(); // Call the stop function directly
      }
    });
    sustainedNotes.current.clear();

    activeNotes.current.forEach((note, noteName) => {
      if (!keyHeldNotes.current.has(noteName) && note) {
        note(); // Call the stop function directly
      }
    });

    const notesToRemove: string[] = [];
    activeNotes.current.forEach((_note, noteName) => {
      if (!keyHeldNotes.current.has(noteName)) {
        notesToRemove.push(noteName);
      }
    });
    notesToRemove.forEach((noteName) => activeNotes.current.delete(noteName));
  }, [currentCategory, toneSynthesizer]);

  const releaseKeyHeldNote = useCallback(
    (note: string) => {
      keyHeldNotes.current.delete(note);

      // Handle synthesizer category with Tone.js
      if (currentCategory === InstrumentCategory.Synthesizer) {
        if (toneSynthesizer.isLoaded) {
          // Always process note releases for synthesizers
          // The synthesizer itself will handle sustain behavior
          toneSynthesizer.stopNotes([note]);
        }
        return;
      }

      // Handle other categories (Soundfont and DrumMachine)
      const activeNote = activeNotes.current.get(note);
      if (activeNote) {
        if (!sustain) {
          activeNote(); // Call the stop function directly
          activeNotes.current.delete(note);
        } else {
          sustainedNotes.current.add(activeNote);
        }
      }
    },
    [sustain, currentCategory, toneSynthesizer]
  );

  const handleInstrumentChange = useCallback(
    async (instrumentName: string, category?: InstrumentCategory) => {
      const targetCategory = category || currentCategory;
      setCurrentInstrument(instrumentName);

      // Clear any previous error when manually changing instruments
      setAudioContextError(null);

      if (targetCategory !== currentCategory) {
        setCurrentCategory(targetCategory);
      }

      // For synthesizer category, just update the instrument name - Tone.js hook will handle the rest
      if (targetCategory === InstrumentCategory.Synthesizer) {
        // Save preferences for synthesizer instruments
        setPreferences(instrumentName, targetCategory);
        return;
      }

      // For other categories, load the instrument if AudioContext is ready
      if (isAudioContextReady) {
        await loadInstrument(instrumentName, targetCategory);
      }
    },
    [isAudioContextReady, loadInstrument, currentCategory, setPreferences]
  );

  const handleCategoryChange = useCallback(
    async (category: InstrumentCategory) => {
      setCurrentCategory(category);

      // Clear failed instruments list when changing categories
      failedInstruments.current.clear();
      setAudioContextError(null);

      // Reset to default instrument for the new category
      let defaultInstrument: string;

      switch (category) {
        case InstrumentCategory.DrumBeat:
          defaultInstrument = dynamicDrumMachines[0]?.value || "TR-808";
          break;
        case InstrumentCategory.Synthesizer:
          defaultInstrument =
            SYNTHESIZER_INSTRUMENTS[0]?.value || "analog_mono";
          break;
        default:
          // For Safari, start with a more compatible instrument
          if (isSafari()) {
            const instruments = getInstrumentsForCategory(category);
            defaultInstrument = instruments[0] || "acoustic_grand_piano";
          } else {
            defaultInstrument = "acoustic_grand_piano";
          }
      }

      setCurrentInstrument(defaultInstrument);

      // Save preferences when category changes
      setPreferences(defaultInstrument, category);

      // For synthesizer category, don't load through smplr - Tone.js hook will handle it
      if (category === InstrumentCategory.Synthesizer) {
        return;
      }

      // For other categories, load the instrument if AudioContext is ready
      if (isAudioContextReady) {
        await loadInstrument(defaultInstrument, category);
      }
    },
    [
      isAudioContextReady,
      dynamicDrumMachines,
      getInstrumentsForCategory,
      loadInstrument,
      setPreferences,
    ]
  );

  const getCurrentInstrumentControlType = (): ControlType => {
    if (currentCategory === InstrumentCategory.DrumBeat) {
      const drumData = dynamicDrumMachines.find(
        (inst) => inst.value === currentInstrument
      );
      return drumData?.controlType || ControlType.Drumpad;
    }

    if (currentCategory === InstrumentCategory.Synthesizer) {
      const synthData = SYNTHESIZER_INSTRUMENTS.find(
        (inst) => inst.value === currentInstrument
      );
      return synthData?.controlType || ControlType.Keyboard;
    }

    const instrumentData = SOUNDFONT_INSTRUMENTS.find(
      (inst) => inst.value === currentInstrument
    );
    return instrumentData?.controlType || ControlType.Keyboard;
  };

  const handleMidiNoteOn = useCallback(
    async (note: number, velocity: number) => {
      const noteNames = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
      ];
      const octave = Math.floor(note / 12) - 1;
      const noteName = noteNames[note % 12];
      const noteString = `${noteName}${octave}`;

      await playNote([noteString], velocity, true); // velocity is already normalized to 0-1
    },
    [playNote]
  );

  const handleMidiNoteOff = useCallback(
    (note: number) => {
      const noteNames = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
      ];
      const octave = Math.floor(note / 12) - 1;
      const noteName = noteNames[note % 12];
      const noteString = `${noteName}${octave}`;
      releaseKeyHeldNote(noteString);
    },
    [releaseKeyHeldNote]
  );

  const handleMidiControlChange = useCallback((controller: number) => {
    switch (controller) {
      case 1:
        break;
      case 7:
        break;
      case 10:
        break;
    }
  }, []);

  const handleMidiSustainChange = useCallback(
    (sustain: boolean) => {
      setSustainState(sustain);
      
      // When sustain is turned off, stop all sustained notes immediately
      // This matches the behavior of the spacebar/sustain button
      if (!sustain) {
        stopSustainedNotes();
      }
    },
    [setSustainState, stopSustainedNotes]
  );

  // Enhanced preset loading with remote sync
  const loadPresetParamsWithSync = useCallback((params: SynthState) => {
    // Load preset locally
    toneSynthesizer.loadPresetParams(params);
    
    // Sync to remote users
    if (onSynthParamsChange) {
      console.log("🎛️ Syncing preset parameters to remote users");
      onSynthParamsChange(params);
    }
  }, [toneSynthesizer, onSynthParamsChange]);

  // Wrapper for updateSynthParams that also emits to socket
  const updateSynthParamsWithSocket = useCallback((params: Partial<SynthState>) => {
    // Update local synthesizer
    toneSynthesizer.updateSynthParams(params);
    
    // Emit to socket if callback is provided
    if (onSynthParamsChange) {
      onSynthParamsChange(params);
    }
  }, [toneSynthesizer, onSynthParamsChange]);

  return {
    instrument,
    currentInstrument,
    currentCategory,
    availableSamples,
    dynamicDrumMachines,
    isLoadingInstrument,
    isAudioContextReady,
    audioContextError,
    initializeAudioContext,
    loadInstrument,
    playNote,
    stopNotes,
    stopSustainedNotes,
    releaseKeyHeldNote,
    setSustainState,
    handleInstrumentChange,
    handleCategoryChange,
    getCurrentInstrumentControlType,
    handleMidiNoteOn,
    handleMidiNoteOff,
    handleMidiControlChange,
    handleMidiSustainChange,
    audioContext: audioContext.current,
    // Synthesizer-specific properties
    synthState: toneSynthesizer.synthState,
    updateSynthParams: updateSynthParamsWithSocket,
    loadPresetParams: loadPresetParamsWithSync, // Use the enhanced version
    isSynthesizerLoaded: toneSynthesizer.isLoaded,
  };
};
