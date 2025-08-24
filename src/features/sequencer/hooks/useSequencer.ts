import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { debounce } from "lodash";
import { useSequencerStore } from "../stores/sequencerStore";
import { SequencerService } from "../services/SequencerService";
import { MetronomeSocketService } from "@/features/metronome/services/MetronomeSocketService";
import { getSequencerWorker } from "../services/SequencerWorkerService";
import type { SequencerSpeed, BankMode, DisplayMode } from "../types";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import type { SequencerStep } from "../types";

interface UseSequencerProps {
  socket: Socket | null;
  currentCategory: string;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
}

export const useSequencer = ({
  socket,
  currentCategory,
  onPlayNotes,
  onStopNotes,
}: UseSequencerProps) => {
  const sequencerStore = useSequencerStore();
  const sequencerServiceRef = useRef<SequencerService | null>(null);
  const metronomeServiceRef = useRef<MetronomeSocketService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentBPM, setCurrentBPM] = useState(120);
  
  // Use refs to store current values for service callbacks
  const onPlayNotesRef = useRef(onPlayNotes);
  const onStopNotesRef = useRef(onStopNotes);
  const sequencerStoreRef = useRef(sequencerStore);
  const currentBPMRef = useRef(currentBPM);
  const hasStartedPlayingRef = useRef(false);
  const currentlyPlayingNotesRef = useRef<Set<string>>(new Set()); // Track playing notes for hard-stop
  
  // Debounced service update functions to prevent excessive calls with Lodash
  const debouncedServiceUpdate = useRef(
    debounce((bpm: number, speed: SequencerSpeed, length: number) => {
      if (sequencerServiceRef.current && bpm > 0) {
        sequencerServiceRef.current.updateSettings(bpm, speed, length);
      }
    }, 100, { 
      leading: false,  // Don't call on leading edge
      trailing: true,  // Call on trailing edge (default)
      maxWait: 300     // Maximum wait time to ensure updates don't get stuck
    })
  );

  // Update refs when values change
  useEffect(() => {
    onPlayNotesRef.current = onPlayNotes;
  }, [onPlayNotes]);
  
  useEffect(() => {
    onStopNotesRef.current = onStopNotes;
  }, [onStopNotes]);
  
  useEffect(() => {
    sequencerStoreRef.current = sequencerStore;
  }, [sequencerStore]);
  
  useEffect(() => {
    currentBPMRef.current = currentBPM;
  }, [currentBPM]);

  // Initialize services - only once
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize sequencer service
        sequencerServiceRef.current = new SequencerService({
          onBeatChange: (beat) => {
            console.log(`🎵 onBeatChange called for beat ${beat}`);
            sequencerStoreRef.current.setCurrentBeat(beat);
            
            // Track that we've started playing (after the first beat)
            if (beat > 0) {
              hasStartedPlayingRef.current = true;
            }
            
            // Check for soft-stop at the last beat of the sequence
            const isLastBeat = beat === (sequencerStoreRef.current.settings.length - 1);
            if (isLastBeat && sequencerStoreRef.current.softStopRequested && hasStartedPlayingRef.current) {
              console.log(`🎵 Soft-stop requested: at last beat ${beat} - will stop after notes finish playing according to their gate values`);
              // Continue processing to let onPlayStep handle the final beat and set up completion logic
              // Don't return early - we need the final beat to be processed
            }
            
            // Handle bank switching when looping back to beat 0
            if (beat === 0 && hasStartedPlayingRef.current) {
              // Check soft-stop request FIRST to prevent bank switching after soft-stop
              if (sequencerStoreRef.current.softStopRequested) {
                console.log(`🎵 Soft-stop requested: stopping at beat 0 - soft-stop should have been handled at the last beat`);
                // This should not happen anymore since we handle soft-stop at the last beat
                // But if we reach here, it means the completion logic didn't work, so stop immediately
                sequencerStoreRef.current.stop(); // Clean stop without cutting notes
                if (sequencerServiceRef.current) {
                  sequencerServiceRef.current.stopPlayback();
                }
                return; // Exit early to prevent further processing
              }
              
              console.log(`🎵 Processing bank switching logic for beat 0`);
              
              // Priority 1: Handle queued bank changes (both single and continuous modes)
              if (sequencerStoreRef.current.waitingBankChange) {
                const waitingBank = sequencerStoreRef.current.waitingBankChange;
                console.log(`🎵 Executing queued bank change to ${waitingBank} at beat 0`);
                
                // Bank isolation: Stop all playing notes when changing banks
                const playingNotes = Array.from(currentlyPlayingNotesRef.current);
                if (playingNotes.length > 0) {
                  console.log(`🎵 Bank change: stopping ${playingNotes.length} playing notes for clean bank transition:`, playingNotes);
                  onStopNotesRef.current(playingNotes);
                  currentlyPlayingNotesRef.current.clear();
                }
                
                // Clear the waiting state and switch to the queued bank
                sequencerStoreRef.current.setWaitingBankChange(null);
                sequencerStoreRef.current.switchBank(waitingBank);
                
                // Update the sequencer service with the new bank's steps
                const newBank = sequencerStoreRef.current.banks[waitingBank];
                if (newBank && sequencerServiceRef.current) {
                  sequencerServiceRef.current.setSteps(newBank.steps);
                }
              }
              // Priority 2: Handle automatic continuous mode progression (only if no queued change)
              else if (sequencerStoreRef.current.settings.bankMode === "continuous") {
                const nextBank = sequencerStoreRef.current.getNextEnabledBank();
                if (nextBank && nextBank !== sequencerStoreRef.current.currentBank) {
                  console.log(`🎵 Continuous mode: switching from ${sequencerStoreRef.current.currentBank} to ${nextBank} at beat 0`);
                  
                  // Bank isolation: Stop all playing notes when changing banks
                  const playingNotes = Array.from(currentlyPlayingNotesRef.current);
                  if (playingNotes.length > 0) {
                    console.log(`🎵 Continuous mode bank change: stopping ${playingNotes.length} playing notes for clean bank transition:`, playingNotes);
                    onStopNotesRef.current(playingNotes);
                    currentlyPlayingNotesRef.current.clear();
                  }
                  
                  sequencerStoreRef.current.switchBank(nextBank);
                  
                  // Update the sequencer service with the new bank's steps
                  const newBank = sequencerStoreRef.current.banks[nextBank];
                  if (newBank && sequencerServiceRef.current) {
                    console.log(`🎵 Setting sequencer service steps for bank ${nextBank}:`, newBank.steps.length, 'steps');
                    sequencerServiceRef.current.setSteps(newBank.steps);
                  }
                }
              }
            }
            console.log(`🎵 onBeatChange completed for beat ${beat}`);
          },
          onPlayStep: (steps: SequencerStep[]) => {
            const currentBank = sequencerStoreRef.current.currentBank;
            const currentBeat = sequencerStoreRef.current.currentBeat;
            const actualBeat = steps.length > 0 ? steps[0].beat : currentBeat; // Use the actual beat being processed
            const isLastBeat = actualBeat === (sequencerStoreRef.current.settings.length - 1);
            const isSoftStopRequested = sequencerStoreRef.current.softStopRequested;
            
            console.log(`🎵 onPlayStep: playing ${steps.length} steps for bank ${currentBank} at beat ${currentBeat}`, {
              steps: steps.map(s => ({ note: s.note, beat: s.beat, gate: s.gate })),
              storeBeat: sequencerStoreRef.current.currentBeat,
              storeBank: sequencerStoreRef.current.currentBank,
              timestamp: Date.now(),
              stepsFromBeat: actualBeat,
              isLastBeat,
              isSoftStopRequested
            });
            
            // Group notes by beat to handle chords properly
            const notesByBeat = new Map<number, Array<{note: string, velocity: number, gate: number, step: SequencerStep}>>();
            
            steps.forEach((step) => {
              const beat = step.beat;
              if (!notesByBeat.has(beat)) {
                notesByBeat.set(beat, []);
              }
              notesByBeat.get(beat)!.push({
                note: step.note,
                velocity: step.velocity,
                gate: step.gate,
                step: step
              });
            });
            
            // Process each beat's notes as a chord
            notesByBeat.forEach((beatNotes, beat) => {
              // Calculate average velocity for new notes
              const avgVelocity = beatNotes.reduce((sum, n) => sum + n.velocity, 0) / beatNotes.length;
              
              // Process each note individually for legato logic
              const legatoNotes: string[] = [];
              const newNotes: string[] = [];
              const newNoteStopData: Array<{note: string, gate: number, hasNext: boolean}> = [];
              
              beatNotes.forEach(noteData => {
                const isLegatoContinuation = isPreviousBeatSameNote(noteData.step) && isPreviousStepFullGate(noteData.step);
                const hasNextSameNote = hasNextBeatSameNote(noteData.step);
                
                if (isLegatoContinuation) {
                  legatoNotes.push(noteData.note);
                  // Don't process stop logic for legato continuations - they're already managed by the original note
                } else {
                  newNotes.push(noteData.note);
                  // Only process stop logic for newly triggered notes
                  newNoteStopData.push({
                    note: noteData.note,
                    gate: noteData.gate,
                    hasNext: hasNextSameNote
                  });
                }
              });
              
              // Only trigger note-on for new notes (not legato continuations)
              if (newNotes.length > 0) {
                onPlayNotesRef.current(newNotes, avgVelocity, true);
                // Track playing notes for hard-stop
                newNotes.forEach(note => currentlyPlayingNotesRef.current.add(note));
              }
              
              // Handle note stopping only for newly triggered notes
              let maxGateTimeForSoftStop = 0; // Track longest gate time for soft-stop completion
              
              newNoteStopData.forEach(noteData => {
                const isFullGate = noteData.gate >= 1.0;
                const shouldDoLegato = isFullGate && noteData.hasNext;
                
                if (!shouldDoLegato) {
                  // Stop this note after its gate duration
                  const timing = SequencerService.calculateStepTiming(currentBPMRef.current, sequencerStoreRef.current.settings.speed);
                  const gateTime = timing.stepInterval * noteData.gate * 1000;
                  
                  // Add minimum and maximum gate times to prevent issues
                  const minGateTime = 50; // Minimum 50ms to ensure notes are heard
                  const maxGateTime = 2000; // Maximum 2s to prevent stuck notes
                  const safeGateTime = Math.max(minGateTime, Math.min(maxGateTime, gateTime));
                  
                  // Track the longest gate time for soft-stop completion
                  if (isLastBeat && isSoftStopRequested) {
                    maxGateTimeForSoftStop = Math.max(maxGateTimeForSoftStop, safeGateTime);
                  }
                  
                  setTimeout(() => {
                    console.log(`🎵 Stopping note after gate: ${noteData.note} (gate: ${noteData.gate})`);
                    onStopNotesRef.current([noteData.note]);
                    // Remove from tracking when notes stop
                    currentlyPlayingNotesRef.current.delete(noteData.note);
                  }, safeGateTime);
                  
                  // Emergency cleanup: force stop this note if still playing
                  const emergencyTimeout = safeGateTime + 1000; // 1s extra buffer
                  setTimeout(() => {
                    if (currentlyPlayingNotesRef.current.has(noteData.note)) {
                      console.warn(`🎵 Emergency cleanup: force stopping stuck note ${noteData.note} from beat ${beat}`);
                      onStopNotesRef.current([noteData.note]);
                      currentlyPlayingNotesRef.current.delete(noteData.note);
                    }
                  }, emergencyTimeout);
                }
              });
              
              // Handle soft-stop completion: stop sequencer after all notes from final beat finish
              if (isLastBeat && isSoftStopRequested) {
                // Ensure at least a minimum delay to let final beat notes start playing
                const completionDelay = Math.max(maxGateTimeForSoftStop, 50) + 100; // Add small buffer
                console.log(`🎵 Soft-stop: sequencer will complete in ${completionDelay}ms after final notes finish (maxGateTime: ${maxGateTimeForSoftStop})`);
                
                setTimeout(() => {
                  console.log(`🎵 Soft-stop complete: stopping sequencer and any remaining notes`);
                  
                  // Stop any notes that are still playing (including legato notes)
                  const remainingNotes = Array.from(currentlyPlayingNotesRef.current);
                  if (remainingNotes.length > 0) {
                    console.log(`🎵 Soft-stop: stopping ${remainingNotes.length} remaining notes:`, remainingNotes);
                    onStopNotesRef.current(remainingNotes);
                    currentlyPlayingNotesRef.current.clear();
                  }
                  
                  sequencerStoreRef.current.stop(); // Clean stop
                  if (sequencerServiceRef.current) {
                    sequencerServiceRef.current.stopPlayback();
                  }
                }, completionDelay);
              }
            });
            
            // Helper function to check if previous beat has the same note
            function isPreviousBeatSameNote(currentStep: any): boolean {
              const currentBankId = sequencerStoreRef.current.currentBank;
              if (!currentBankId) return false;
              
              const currentBank = sequencerStoreRef.current.banks[currentBankId];
              if (!currentBank) return false;
              
              // Bank isolation: No legato across bank boundaries (beat 0 = start of bank)
              if (currentStep.beat === 0) {
                console.log(`🎵 Legato check - Beat 0: no legato across bank boundaries`);
                return false;
              }
              
              const prevBeat = currentStep.beat - 1; // Only check previous beat within the same bank cycle
              
              const prevStepWithSameNote = currentBank.steps.find(step => 
                step.beat === prevBeat && 
                step.note === currentStep.note &&
                step.enabled
              );
              
              const hasPrevNote = !!prevStepWithSameNote;
              console.log(`🎵 Legato check - Previous beat: bank=${currentBankId}, beat=${prevBeat}, note=${currentStep.note}, hasPrevNote=${hasPrevNote}`);
              
              return hasPrevNote;
            }
            
            // Helper function to check if previous step has full gate
            function isPreviousStepFullGate(currentStep: any): boolean {
              const currentBankId = sequencerStoreRef.current.currentBank;
              if (!currentBankId) return false;
              
              const currentBank = sequencerStoreRef.current.banks[currentBankId];
              if (!currentBank) return false;
              
              // Bank isolation: No legato across bank boundaries (beat 0 = start of bank)
              if (currentStep.beat === 0) {
                return false;
              }
              
              const prevBeat = currentStep.beat - 1; // Only check previous beat within the same bank cycle
              
              const prevStep = currentBank.steps.find(step => 
                step.beat === prevBeat && 
                step.note === currentStep.note &&
                step.enabled
              );
              
              return prevStep ? prevStep.gate >= 1.0 : false;
            }
            
            // Helper function to check if next beat has the same note
            function hasNextBeatSameNote(currentStep: any): boolean {
              const currentBankId = sequencerStoreRef.current.currentBank;
              if (!currentBankId) return false;
              
              const currentBank = sequencerStoreRef.current.banks[currentBankId];
              if (!currentBank) return false;
              
              const nextBeat = (currentStep.beat + 1) % sequencerStoreRef.current.settings.length;
              
              const nextStepWithSameNote = currentBank.steps.find(step => 
                step.beat === nextBeat && 
                step.note === currentStep.note &&
                step.enabled
              );
              
              return !!nextStepWithSameNote;
            }
          },
          onMetronomeSync: () => {
            sequencerStoreRef.current.setWaitingForMetronome(false);
          },
          onError: (errorMessage) => {
            setError(errorMessage);
            console.error("Sequencer error:", errorMessage);
          },
        });

        await sequencerServiceRef.current.initialize();

        // Initialize metronome service if socket is available
        if (socket) {
          console.log("🎵 Creating metronome service with socket");
          metronomeServiceRef.current = new MetronomeSocketService(socket);
        } else {
          console.log("🎵 No socket available for metronome service");
        }

        setIsInitialized(true);
        setError(null);
      } catch (err) {
        const errorMessage = `Failed to initialize sequencer: ${err}`;
        setError(errorMessage);
        console.error(errorMessage);
      }
    };

    initializeServices();

    // Cleanup on unmount only
    return () => {
      if (sequencerServiceRef.current) {
        sequencerServiceRef.current.dispose();
        sequencerServiceRef.current = null;
      }
      if (metronomeServiceRef.current) {
        metronomeServiceRef.current.removeListeners();
        metronomeServiceRef.current = null;
      }
      // Cancel any pending debounced calls
      debouncedServiceUpdate.current.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once

  // Listen to metronome updates - run after services are initialized
  useEffect(() => {
    if (!metronomeServiceRef.current || !sequencerServiceRef.current || !isInitialized) return;

    console.log("🎵 Setting up metronome listeners...");

    const cleanupMetronomeState = metronomeServiceRef.current.onMetronomeState(
      ({ bpm }) => {
        console.log("🎵 Metronome state received:", { bpm });
        setCurrentBPM(bpm);
        if (sequencerServiceRef.current) {
          sequencerServiceRef.current.updateSettings(bpm, sequencerStoreRef.current.settings.speed, sequencerStoreRef.current.settings.length);
        }
      }
    );

    const cleanupMetronomeTick = metronomeServiceRef.current.onMetronomeTick(
      ({ timestamp, bpm }) => {
        // Only log occasionally to reduce spam
        if (Math.random() < 0.1) {
          console.log("🎵 Metronome tick received:", { timestamp, bpm });
        }
        setCurrentBPM(bpm);
        if (sequencerServiceRef.current) {
          sequencerServiceRef.current.syncWithMetronome(timestamp, bpm);
        }
      }
    );

    const cleanupMetronomeUpdated = metronomeServiceRef.current.onMetronomeUpdated(
      ({ bpm }) => {
        console.log("🎵 Metronome updated:", { bpm });
        setCurrentBPM(bpm);
        if (sequencerServiceRef.current) {
          sequencerServiceRef.current.updateSettings(bpm, sequencerStoreRef.current.settings.speed, sequencerStoreRef.current.settings.length);
        }
      }
    );

    // Request current metronome state
    console.log("🎵 Requesting metronome state...");
    metronomeServiceRef.current.requestMetronomeState();

    return () => {
      console.log("🎵 Cleaning up metronome listeners");
      cleanupMetronomeState();
      cleanupMetronomeTick();
      cleanupMetronomeUpdated();
    };
  }, [isInitialized]); // Run when services are initialized

  // Handle socket changes and create metronome service when available
  useEffect(() => {
    if (socket && !metronomeServiceRef.current) {
      console.log("🎵 Socket became available, creating metronome service");
      metronomeServiceRef.current = new MetronomeSocketService(socket);
      
      // Set up metronome listeners immediately
      if (sequencerServiceRef.current && isInitialized) {
        console.log("🎵 Setting up metronome listeners immediately...");

        // Request current metronome state
        console.log("🎵 Requesting metronome state (immediate)...");
        metronomeServiceRef.current.requestMetronomeState();
      }
    }
  }, [socket, isInitialized]);

  // Update sequencer service when settings change
  useEffect(() => {
    if (sequencerServiceRef.current && isInitialized) {
      sequencerServiceRef.current.updateSettings(
        currentBPM,
        sequencerStoreRef.current.settings.speed,
        sequencerStoreRef.current.settings.length
      );
    }
  }, [currentBPM, isInitialized]);

  // Update sequencer service when steps change
  useEffect(() => {
    if (sequencerServiceRef.current && isInitialized) {
      const currentBank = sequencerStore.banks[sequencerStore.currentBank];
      if (currentBank) {
        sequencerServiceRef.current.setSteps(currentBank.steps);
      }
    }
  }, [isInitialized, sequencerStore.banks, sequencerStore.currentBank]);

  // Playback control functions
  const handlePlay = useCallback(async () => {
    if (!sequencerServiceRef.current || !isInitialized) {
      console.log("🎵 Play blocked - service not ready:", { 
        hasService: !!sequencerServiceRef.current, 
        isInitialized 
      });
      return;
    }

    try {
      console.log("🎵 Starting sequencer playback (waiting for next metronome tick)...");
      // Reset playhead to beat 0 (first column) for consistent start
      sequencerStoreRef.current.setCurrentBeat(0);
      // Reset for fresh start
      hasStartedPlayingRef.current = false;
      // Mark UI state as playing and waiting for metronome
      sequencerStoreRef.current.play();
      // Schedule start to happen on the next websocket tick for alignment
      sequencerServiceRef.current.scheduleStartOnNextTick();
      // Initialize service state (manual mode sets isPlaying and waits for tick)
      await sequencerServiceRef.current.startPlayback();
    } catch (err) {
      const errorMessage = `Failed to start playback: ${err}`;
      setError(errorMessage);
      console.error(errorMessage);
    }
  }, [isInitialized]);

  const handleStop = useCallback(() => {
    if (!sequencerServiceRef.current) return;

    hasStartedPlayingRef.current = false; // Reset for next playback
    sequencerStoreRef.current.stop();
    sequencerServiceRef.current.stopPlayback();
  }, []);

  const handleSoftStop = useCallback(() => {
    if (!sequencerServiceRef.current) return;

    // Request soft-stop (will stop at end of current sequence)
    sequencerStoreRef.current.softStop();
  }, []);

  const handleCancelSoftStop = useCallback(() => {
    if (!sequencerServiceRef.current) return;

    // Cancel pending soft-stop request
    sequencerStoreRef.current.cancelSoftStop();
  }, []);

  const handleHardStop = useCallback(() => {
    if (!sequencerServiceRef.current) return;

    // Stop all currently playing notes immediately
    const playingNotes = Array.from(currentlyPlayingNotesRef.current);
    if (playingNotes.length > 0) {
      console.log(`🎵 Hard-stop: stopping ${playingNotes.length} playing notes:`, playingNotes);
      onStopNotesRef.current(playingNotes);
      currentlyPlayingNotesRef.current.clear();
    }

    hasStartedPlayingRef.current = false; // Reset for next playback
    sequencerStoreRef.current.hardStop();
    sequencerServiceRef.current.stopPlayback();
  }, []);

  const handlePause = useCallback(() => {
    if (!sequencerServiceRef.current) return;

    sequencerStoreRef.current.pause();
    sequencerServiceRef.current.pausePlayback();
  }, []);

  const handleTogglePlayback = useCallback(() => {
    if (sequencerStoreRef.current.isPlaying) {
      if (sequencerStoreRef.current.softStopRequested) {
        // If soft-stop is already requested, cancel it
        handleCancelSoftStop();
      } else {
        // Request soft-stop
        handleSoftStop();
      }
    } else {
      handlePlay();
    }
  }, [handlePlay, handleSoftStop, handleCancelSoftStop]);

  // Step management functions
  const handleStepToggle = useCallback(
    (beat: number, note: string) => {
      sequencerStoreRef.current.toggleStep(sequencerStoreRef.current.currentBank, beat, note);
    },
    []
  );

  const handleStepAdd = useCallback(
    (beat: number, note: string, velocity?: number, gate?: number) => {
      sequencerStoreRef.current.addStep(sequencerStoreRef.current.currentBank, beat, note, velocity, gate);
    },
    []
  );

  const handleStepRemove = useCallback(
    (stepId: string) => {
      sequencerStoreRef.current.removeStep(sequencerStoreRef.current.currentBank, stepId);
    },
    []
  );

  const handleClearBeat = useCallback(
    (beat: number) => {
      sequencerStoreRef.current.clearBeat(sequencerStoreRef.current.currentBank, beat);
    },
    []
  );

  const handleClearBank = useCallback(() => {
    sequencerStoreRef.current.clearBank(sequencerStoreRef.current.currentBank);
  }, []);

  // Bank management functions
  const handleBankSwitch = useCallback(
    (bankId: string) => {
      if (sequencerStoreRef.current.isPlaying) {
        // During playback (both single and continuous modes), queue the bank change for next loop
        sequencerStoreRef.current.setWaitingBankChange(bankId);
      } else {
        // Switch immediately when not playing
        sequencerStoreRef.current.switchBank(bankId);
      }
    },
    []
  );

  const handleBankToggleEnabled = useCallback(
    (bankId: string) => {
      sequencerStoreRef.current.toggleBankEnabled(bankId);
    },
    []
  );

  // Settings functions
  const handleSpeedChange = useCallback(
    (speed: SequencerSpeed) => {
      sequencerStoreRef.current.setSpeed(speed);
      // Use debounced update to prevent excessive service calls
      debouncedServiceUpdate.current(
        currentBPMRef.current,
        speed,
        sequencerStoreRef.current.settings.length
      );
    },
    []
  );

  const handleLengthChange = useCallback(
    (length: number) => {
      sequencerStoreRef.current.setLength(length);
      // Use debounced update to prevent excessive service calls
      debouncedServiceUpdate.current(
        currentBPMRef.current,
        sequencerStoreRef.current.settings.speed,
        length
      );
    },
    []
  );

  const handleBankModeChange = useCallback(
    (mode: BankMode) => {
      sequencerStoreRef.current.setBankMode(mode);
    },
    []
  );

  const handleDisplayModeChange = useCallback(
    (mode: DisplayMode) => {
      sequencerStoreRef.current.setDisplayMode(mode);
    },
    []
  );



  // Recording functions
  const handleToggleRecording = useCallback(() => {
    sequencerStoreRef.current.toggleRecording();
  }, []);

  const handleRecordNote = useCallback(
    (note: string, velocity?: number, gate?: number, isRealtime?: boolean) => {
      if (sequencerStoreRef.current.isRecording) {
        sequencerStoreRef.current.recordStep(note, velocity, gate, isRealtime);
      }
    },
    []
  );

  // Preset management functions
  const handleSavePreset = useCallback(
    (name: string) => {
      sequencerStoreRef.current.savePreset(name, currentCategory);
    },
    [currentCategory]
  );

  const handleLoadPreset = useCallback(
    (presetId: string) => {
      sequencerStoreRef.current.loadPreset(presetId);
    },
    []
  );

  // Bank shortcuts only (6,7,8,9 for A,B,C,D)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Bank shortcuts (6,7,8,9 for A,B,C,D)
      const bankShortcut = SEQUENCER_CONSTANTS.BANK_SHORTCUTS[event.key as keyof typeof SEQUENCER_CONSTANTS.BANK_SHORTCUTS];
      if (bankShortcut) {
        event.preventDefault();
        handleBankSwitch(bankShortcut);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBankSwitch]);

  return {
    // State - be selective to avoid unnecessary re-renders
    isInitialized,
    error,
    currentBPM,
    settings: sequencerStore.settings,
    banks: sequencerStore.banks,
    currentBank: sequencerStore.currentBank,
    currentBeat: sequencerStore.currentBeat,
    // Note: selectedBeat and editMode are now managed by the store
    isPlaying: sequencerStore.isPlaying,
    isPaused: sequencerStore.isPaused,
    isRecording: sequencerStore.isRecording,
    softStopRequested: sequencerStore.softStopRequested,
    waitingForMetronome: sequencerStore.waitingForMetronome,
    waitingBankChange: sequencerStore.waitingBankChange,
    getTotalStepsCount: sequencerStore.getTotalStepsCount,
    // Note: setSelectedBeat is now managed by the store
    setCurrentBeat: sequencerStore.setCurrentBeat,
    clearAllBanks: sequencerStore.clearAllBanks,

    // Playback controls
    handlePlay,
    handleStop,
    handleSoftStop,
    handleCancelSoftStop,
    handleHardStop,
    handlePause,
    handleTogglePlayback,

    // Step management
    handleStepToggle,
    handleStepAdd,
    handleStepRemove,
    handleClearBeat,
    handleClearBank,
    updateStep: (beat: number, note: string, updates: Partial<SequencerStep>) => 
      sequencerStoreRef.current.updateStep(sequencerStoreRef.current.currentBank, beat, note, updates),

    // Bank management
    handleBankSwitch,
    handleBankToggleEnabled,
            copyBank: (bankId: string) => sequencerStoreRef.current.copyBank(bankId),
        pasteBank: (bankId: string) => sequencerStoreRef.current.pasteBank(bankId),

    // Settings
    handleSpeedChange,
    handleLengthChange,
    handleBankModeChange,
    handleDisplayModeChange,
    // Note: handleEditModeChange is now managed by the store

    // Recording
    handleToggleRecording,
    handleRecordNote,

    // Presets
    handleSavePreset,
    handleLoadPreset,

    // Utility
    getCurrentBankSteps: () => sequencerStoreRef.current.banks[sequencerStoreRef.current.currentBank]?.steps || [],
    getBeatSteps: (beat: number) => sequencerStoreRef.current.getStepsForBeat(sequencerStoreRef.current.currentBank, beat),
    hasStepAt: (beat: number, note: string) => sequencerStoreRef.current.hasStepAtBeat(sequencerStoreRef.current.currentBank, beat, note),
    
    // Worker performance monitoring
    getWorkerStats: () => getSequencerWorker().getStats(),
  };
}; 