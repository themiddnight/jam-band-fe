import { useState, useRef, useEffect, useCallback } from "react";
import { Soundfont, DrumMachine } from "smplr";
import { SOUNDFONT_INSTRUMENTS, DRUM_MACHINES, SYNTHESIZER_INSTRUMENTS, InstrumentCategory } from "../constants/instruments";
import { ControlType } from "../types";
import { getCachedDrumMachines } from "../utils/drumMachineUtils";
import { useToneSynthesizer } from "./useToneSynthesizer";

export const useInstrument = (
  initialInstrument = "acoustic_grand_piano",
  initialCategory = InstrumentCategory.Melodic
) => {
  const [instrument, setInstrument] = useState<any>(null);
  const [currentInstrument, setCurrentInstrument] =
    useState<string>(initialInstrument);
  const [currentCategory, setCurrentCategory] = 
    useState<InstrumentCategory>(initialCategory);
  const [sustain, setSustain] = useState<boolean>(false);
  const [isLoadingInstrument, setIsLoadingInstrument] =
    useState<boolean>(false);
  const [availableSamples, setAvailableSamples] = useState<string[]>([]);
  const [dynamicDrumMachines, setDynamicDrumMachines] = useState(DRUM_MACHINES);

  const [isAudioContextReady, setIsAudioContextReady] = useState<boolean>(false);
  const audioContext = useRef<AudioContext | null>(null);
  const sustainedNotes = useRef<Set<any>>(new Set());
  const activeNotes = useRef<Map<string, any>>(new Map());
  const keyHeldNotes = useRef<Set<string>>(new Set());

  // Initialize Tone.js synthesizer for synthesizer category
  const toneSynthesizer = useToneSynthesizer(
    currentCategory === InstrumentCategory.Synthesizer ? currentInstrument : ""
  );

  const initializeAudioContext = useCallback(async () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    if (audioContext.current.state === "suspended") {
      await audioContext.current.resume();
    }

    setIsAudioContextReady(true);
    return audioContext.current;
  }, []);

  const loadInstrument = useCallback(async (instrumentName: string, category: InstrumentCategory = currentCategory) => {
    // Skip loading for synthesizer category - handled by Tone.js
    if (category === InstrumentCategory.Synthesizer) {
      setCurrentInstrument(instrumentName);
      setCurrentCategory(category);
      setIsLoadingInstrument(false);
      return;
    }

    // Don't load if AudioContext isn't ready
    if (!audioContext.current || audioContext.current.state !== "running") {
      console.log("AudioContext not ready, will load instrument later");
      return;
    }

    setIsLoadingInstrument(true);
    try {
      let newInstrument: any;
      
      if (category === InstrumentCategory.DrumBeat) {
        newInstrument = new DrumMachine(
          audioContext.current,
          { instrument: instrumentName, volume: 127 }
        );
      } else {
        // Default to Soundfont for melodic instruments
        newInstrument = new Soundfont(
          audioContext.current,
          { instrument: instrumentName, volume: 127 }
        );
      }
      
      // Wait for the instrument to load
      await newInstrument.load;
      setInstrument(newInstrument);
      setCurrentInstrument(instrumentName);
      setCurrentCategory(category);
      
      // Get available samples for drum machines
      if (category === InstrumentCategory.DrumBeat && newInstrument.getSampleNames) {
        const samples = newInstrument.getSampleNames();
        setAvailableSamples(samples);
        console.log(`Available samples for ${instrumentName}:`, samples);
      } else {
        setAvailableSamples([]);
      }
      
      console.log(`Loaded ${category} instrument: ${instrumentName}`);
    } catch (error) {
      console.error("Failed to load instrument:", error);
    } finally {
      setIsLoadingInstrument(false);
    }
  }, [currentCategory]);

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

  // Load instrument when AudioContext becomes ready
  useEffect(() => {
    if (isAudioContextReady && !instrument) {
      loadInstrument(currentInstrument);
    }
  }, [isAudioContextReady, instrument, currentInstrument, loadInstrument]);

  // Sync sustain state with synthesizer when it becomes loaded
  useEffect(() => {
    if (currentCategory === InstrumentCategory.Synthesizer && toneSynthesizer.isLoaded && toneSynthesizer.setSustain) {
      toneSynthesizer.setSustain(sustain);
    }
  }, [currentCategory, toneSynthesizer.isLoaded, toneSynthesizer.setSustain, sustain, toneSynthesizer]);

  useEffect(() => {
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  const ensureAudioContextAndInstrument = useCallback(async () => {
    if (!audioContext.current || audioContext.current.state !== "running") {
      await initializeAudioContext();
    }

    if (!instrument) {
      await loadInstrument(currentInstrument);
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
              notes.forEach(note => keyHeldNotes.current.add(note));
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

            const playedNote = instrument.start(
              { 
                note: note, 
                velocity: velocity * 127, // smplr expects velocity 0-127
                time: audioContext.current!.currentTime,
              }
            );

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
    [instrument, audioContext, sustain, ensureAudioContextAndInstrument, currentCategory, toneSynthesizer]
  );

  const stopNotes = (notes: string[]) => {
    // Handle synthesizer category with Tone.js
    if (currentCategory === InstrumentCategory.Synthesizer) {
      if (toneSynthesizer.isLoaded) {
        notes.forEach((note) => {
          // Always process note releases for synthesizers
          // The synthesizer itself will handle sustain behavior
          toneSynthesizer.stopNotes([note]);
          keyHeldNotes.current.delete(note);
        });
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

  const setSustainState = useCallback((newSustain: boolean) => {
    setSustain(newSustain);
    
    // Pass sustain state to synthesizer if it's the current category
    if (currentCategory === InstrumentCategory.Synthesizer && toneSynthesizer.setSustain) {
      toneSynthesizer.setSustain(newSustain);
    }
  }, [currentCategory, toneSynthesizer]);

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

  const handleInstrumentChange = useCallback(async (instrumentName: string, category?: InstrumentCategory) => {
    const targetCategory = category || currentCategory;
    setCurrentInstrument(instrumentName);
    
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
  }, [isAudioContextReady, loadInstrument, currentCategory]);

  const handleCategoryChange = useCallback(async (category: InstrumentCategory) => {
    setCurrentCategory(category);
    // Reset to default instrument for the new category
    let defaultInstrument: string;
    
    switch (category) {
      case InstrumentCategory.DrumBeat:
        defaultInstrument = dynamicDrumMachines[0]?.value || "TR-808";
        break;
      case InstrumentCategory.Synthesizer:
        defaultInstrument = SYNTHESIZER_INSTRUMENTS[0]?.value || "analog_mono";
        break;
      default:
        defaultInstrument = "acoustic_grand_piano";
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
  }, [isAudioContextReady, loadInstrument, dynamicDrumMachines]);

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

      await playNotes([noteString], velocity, true); // velocity is already normalized to 0-1
    },
    [playNotes]
  );

  const handleMidiNoteOff = useCallback(
    (note: number) => {
      const noteNames = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
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
    },
    [setSustainState]
  );

  return {
    instrument,
    currentInstrument,
    currentCategory,
    availableSamples,
    dynamicDrumMachines,
    isLoadingInstrument,
    isAudioContextReady,
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