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
import { useToneSynthesizer } from "./useToneSynthesizer";
import {
  isSafari,
  createWebKitCompatibleAudioContext,
  handleSafariAudioError,
  getSafariLoadTimeout,
} from "../utils/webkitCompat";
import { useInstrumentPreferencesStore } from "../stores/instrumentPreferencesStore";

export const useInstrument = (
  initialInstrument?: string,
  initialCategory = InstrumentCategory.Melodic
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
        setPreferences(instrumentName, finalCategory);
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
    [currentCategory, getNextInstrumentToTry, setPreferences]
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

  useEffect(() => {
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  const ensureAudioContextAndInstrument = useCallback(async () => {
    try {
      // Check AudioContext state first
      if (!audioContext.current || audioContext.current.state !== "running") {
        await initializeAudioContext();

        // Extra wait for Safari to stabilize AudioContext
        if (isSafari()) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // Verify AudioContext is actually running after initialization
      if (!audioContext.current || audioContext.current.state !== "running") {
        throw new Error("AudioContext failed to start properly");
      }

      // Load instrument if not already loaded
      if (!instrument) {
        await loadInstrument(currentInstrument);
      }
    } catch (error) {
      console.error("Failed to ensure AudioContext and instrument:", error);
      throw error;
    }
  }, [initializeAudioContext, loadInstrument, instrument, currentInstrument]);

  const playNotes = useCallback(
    async (notes: string[], velocity: number, isKeyHeld: boolean = false) => {
      try {
        // Handle synthesizer category with Tone.js
        if (currentCategory === InstrumentCategory.Synthesizer) {
          if (toneSynthesizer.isLoaded) {
            toneSynthesizer.playNotes(notes, velocity);

            // Handle key held notes for synthesizer
            if (isKeyHeld) {
              notes.forEach((note) => keyHeldNotes.current.add(note));
            }
          }
          return;
        }

        // Handle other categories (Soundfont and DrumMachine)
        await ensureAudioContextAndInstrument();

        if (instrument && audioContext.current?.state === "running") {
          notes.forEach((note) => {
            const existingNote = activeNotes.current.get(note);
            if (existingNote) {
              existingNote(); // Call the stop function directly
            }

            const playedNote = instrument.start({
              note: note,
              velocity: velocity * 127, // smplr expects velocity 0-127
              time: audioContext.current!.currentTime,
            });

            activeNotes.current.set(note, playedNote);

            if (isKeyHeld) {
              keyHeldNotes.current.add(note);
            }

            if (!isKeyHeld && sustain) {
              sustainedNotes.current.add(playedNote);
            }

            if (!isKeyHeld && !sustain) {
              setTimeout(() => {
                if (
                  activeNotes.current.has(note) &&
                  !keyHeldNotes.current.has(note)
                ) {
                  if (playedNote) {
                    playedNote(); // Call the stop function directly
                  }
                  activeNotes.current.delete(note);
                }
              }, 300);
            }
          });
        }
      } catch (error) {
        console.error("Error playing notes:", error);
      }
    },
    [
      instrument,
      audioContext,
      sustain,
      ensureAudioContextAndInstrument,
      currentCategory,
      toneSynthesizer,
    ]
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
        return;
      }

      // For other categories, load the instrument if AudioContext is ready
      if (isAudioContextReady) {
        await loadInstrument(instrumentName, targetCategory);
      }
    },
    [isAudioContextReady, loadInstrument, currentCategory]
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

      await playNotes([noteString], velocity, true); // velocity is already normalized to 0-1
    },
    [playNotes]
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
    playNotes,
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
    updateSynthParams: toneSynthesizer.updateSynthParams,
    loadPresetParams: toneSynthesizer.loadPresetParams,
    isSynthesizerLoaded: toneSynthesizer.isLoaded,
  };
};
