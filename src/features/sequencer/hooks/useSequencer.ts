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
            
            sequencerStoreRef.current.setCurrentBeat(beat);
            
            // Track that we've started playing (after the first beat)
            if (beat > 0) {
              hasStartedPlayingRef.current = true;
            }
            
            // Check for soft-stop at the last beat of the sequence
            const isLastBeat = beat === (sequencerStoreRef.current.settings.length - 1);
            if (isLastBeat && sequencerStoreRef.current.softStopRequested && hasStartedPlayingRef.current) {
              
              // Continue processing to let onPlayStep handle the final beat and set up completion logic
              // Don't return early - we need the final beat to be processed
            }
            
            // Handle bank switching when looping back to beat 0
            if (beat === 0 && hasStartedPlayingRef.current) {
              // Check soft-stop request FIRST to prevent bank switching after soft-stop
              if (sequencerStoreRef.current.softStopRequested) {
                
                // This should not happen anymore since we handle soft-stop at the last beat
                // But if we reach here, it means the completion logic didn't work, so stop immediately
                sequencerStoreRef.current.stop(); // Clean stop without cutting notes
                if (sequencerServiceRef.current) {
                  sequencerServiceRef.current.stopPlayback();
                }
                return; // Exit early to prevent further processing
              }
              
              
              
              // Priority 1: Handle queued bank changes (both single and continuous modes)
              if (sequencerStoreRef.current.waitingBankChange) {
                const waitingBank = sequencerStoreRef.current.waitingBankChange;
                
                
                // Bank isolation: Stop all playing notes when changing banks
                const playingNotes = Array.from(currentlyPlayingNotesRef.current);
                if (playingNotes.length > 0) {
                  
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
                  
                  
                  // Bank isolation: Stop all playing notes when changing banks
                  const playingNotes = Array.from(currentlyPlayingNotesRef.current);
                  if (playingNotes.length > 0) {
                    
                    onStopNotesRef.current(playingNotes);
                    currentlyPlayingNotesRef.current.clear();
                  }
                  
                  sequencerStoreRef.current.switchBank(nextBank);
                  
                  // Update the sequencer service with the new bank's steps
                  const newBank = sequencerStoreRef.current.banks[nextBank];
                  if (newBank && sequencerServiceRef.current) {
                    
                    sequencerServiceRef.current.setSteps(newBank.steps);
                  }
                }
              }
            }
            
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
              // Deduplicate notes to prevent duplicate processing
              const uniqueNotes = new Map<string, typeof beatNotes[0]>();
              beatNotes.forEach(noteData => {
                if (!uniqueNotes.has(noteData.note)) {
                  uniqueNotes.set(noteData.note, noteData);
                } else {
                  console.warn(`🎵 Duplicate note detected: ${noteData.note} at beat ${beat} - skipping duplicate`);
                }
              });
              
              // Process each unique note individually for legato logic
              const processedNotes = Array.from(uniqueNotes.values());
              const legatoNotes: string[] = [];
              const newNotes: string[] = [];
              const newNoteStopData: Array<{note: string, gate: number, velocity: number, isLegatoStart: boolean}> = [];
              
              // Pre-calculate legato groups for all notes to avoid repeated calculations
              const legatoAnalysis = new Map<string, ReturnType<typeof findLegatoGroup>>();
              processedNotes.forEach(noteData => {
                legatoAnalysis.set(noteData.note, findLegatoGroup(noteData.step));
              });
              
              processedNotes.forEach(noteData => {
                const legatoGroup = legatoAnalysis.get(noteData.note)!;
                const isLegatoContinuation = legatoGroup.isInMiddleOfGroup;
                
                // Debug logging only once per note
                console.log(`🎵 Legato analysis for ${noteData.note} at beat ${noteData.step.beat}:`, {
                  isGroupStart: legatoGroup.isGroupStart,
                  isGroupEnd: legatoGroup.isGroupEnd,
                  isInMiddleOfGroup: legatoGroup.isInMiddleOfGroup,
                  groupVelocity: legatoGroup.groupVelocity,
                  groupLength: legatoGroup.groupLength,
                  groupBeats: `${noteData.step.beat}`,
                  gate: noteData.gate
                });
                
                if (isLegatoContinuation) {
                  legatoNotes.push(noteData.note);
                  // Don't process stop logic for legato continuations - they're already managed by the original note
                } else {
                  newNotes.push(noteData.note);
                  // Only process stop logic for newly triggered notes
                  newNoteStopData.push({
                    note: noteData.note,
                    gate: noteData.gate,
                    velocity: legatoGroup.groupVelocity, // Use velocity from first 100% gate note in group
                    isLegatoStart: legatoGroup.isGroupStart
                  });
                }
              });
              
              // Only trigger note-on for new notes (not legato continuations)
              if (newNotes.length > 0) {
                // Calculate velocity for new notes - use individual note velocities
                const noteVelocities = newNoteStopData.map(nd => nd.velocity);
                const avgVelocity = noteVelocities.reduce((sum, v) => sum + v, 0) / noteVelocities.length;
                
                console.log(`🎵 Triggering ${newNotes.length} new notes:`, newNotes.map(note => {
                  const noteData = processedNotes.find(pn => pn.note === note);
                  const legato = legatoAnalysis.get(note);
                  return {
                    note,
                    velocity: noteData?.velocity,
                    gate: noteData?.gate,
                    isGroupStart: legato?.isGroupStart,
                    isGroupEnd: legato?.isGroupEnd
                  };
                }));
                
                onPlayNotesRef.current(newNotes, avgVelocity, true);
                // Track playing notes for hard-stop AND legato management
                newNotes.forEach(note => currentlyPlayingNotesRef.current.add(note));
              }
              
              // Log legato continuations for debugging
              if (legatoNotes.length > 0) {
                console.log(`🎵 Legato continuations (no note-on):`, legatoNotes.map(note => {
                  const noteData = processedNotes.find(pn => pn.note === note);
                  const legato = legatoAnalysis.get(note);
                  return {
                    note,
                    beat: noteData?.step?.beat,
                    isGroupEnd: legato?.isGroupEnd
                  };
                }));
              }
              
              // Handle note stopping for newly triggered notes AND legato group endings
              let maxGateTimeForSoftStop = 0; // Track longest gate time for soft-stop completion
              
              // Process stopping logic for all notes in this beat (both new and legato continuations)
              processedNotes.forEach(noteData => {
                const legatoGroup = legatoAnalysis.get(noteData.note)!;
                const isFullGate = noteData.gate >= 1.0;
                const isNewNote = newNotes.includes(noteData.note);
                const isLegatoContinuation = !isNewNote;
                
                // Determine if this note should continue (legato) or stop
                const shouldDoLegato = isFullGate && legatoGroup && !legatoGroup.isGroupEnd;
                
                // Stop note if:
                // 1. It's a new note with non-full gate
                // 2. It's a new note with full gate but at group end  
                // 3. It's a legato continuation but the group is ending
                const shouldStopNote = !shouldDoLegato;
                
                if (shouldStopNote) {
                  // Calculate gate time
                  const timing = SequencerService.calculateStepTiming(currentBPMRef.current, sequencerStoreRef.current.settings.speed);
                  let gateTime = timing.stepInterval * noteData.gate * 1000;
                  
                  // For legato continuations ending, use the gate time of the current step
                  if (isLegatoContinuation && legatoGroup.isGroupEnd) {
                    // For legato group endings, use the current step's gate time
                    gateTime = timing.stepInterval * noteData.gate * 1000;
                    
                  }
                  
                  // Add minimum and maximum gate times to prevent issues
                  const minGateTime = 50; // Minimum 50ms to ensure notes are heard
                  const maxGateTime = 2000; // Maximum 2s to prevent stuck notes
                  const safeGateTime = Math.max(minGateTime, Math.min(maxGateTime, gateTime));
                  
                  // Track the longest gate time for soft-stop completion
                  if (isLastBeat && isSoftStopRequested) {
                    maxGateTimeForSoftStop = Math.max(maxGateTimeForSoftStop, safeGateTime);
                  }
                  
                  // Schedule note stop after gate time
                  setTimeout(() => {
                    
                    onStopNotesRef.current([noteData.note]);
                    // Remove from tracking when notes stop
                    currentlyPlayingNotesRef.current.delete(noteData.note);
                  }, safeGateTime);
                  
                  // Shorter emergency cleanup: force stop this note if still playing
                  const emergencyTimeout = safeGateTime + 500; // Reduced from 1000ms to 500ms
                  setTimeout(() => {
                    if (currentlyPlayingNotesRef.current.has(noteData.note)) {
                      console.warn(`🎵 Emergency cleanup: force stopping stuck note ${noteData.note} from beat ${beat} (isNew: ${isNewNote}, isLegatoEnd: ${legatoGroup.isGroupEnd})`);
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
                
                
                setTimeout(() => {
                  
                  
                  // Stop any notes that are still playing (including legato notes)
                  const remainingNotes = Array.from(currentlyPlayingNotesRef.current);
                  if (remainingNotes.length > 0) {
                    
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
            
            // Helper function to find legato group information for a step
            // Implements the legato grouping rules:
            // 1. Adjacent cells with 100% gate = one long legato note
            // 2. Short gate notes break the chain but are included in current group
            // 3. Each group uses velocity of first 100% gate note
            function findLegatoGroup(currentStep: SequencerStep | undefined): {
              isInMiddleOfGroup: boolean;
              isGroupStart: boolean;
              isGroupEnd: boolean;
              groupVelocity: number;
              groupLength: number;
            } {
              if (!currentStep) {
                return {
                  isInMiddleOfGroup: false,
                  isGroupStart: true,
                  isGroupEnd: true,
                  groupVelocity: 1.0,
                  groupLength: 1
                };
              }
              
              const currentBankId = sequencerStoreRef.current.currentBank;
              if (!currentBankId) {
                return {
                  isInMiddleOfGroup: false,
                  isGroupStart: true,
                  isGroupEnd: true,
                  groupVelocity: currentStep.velocity,
                  groupLength: 1
                };
              }
              
              const currentBank = sequencerStoreRef.current.banks[currentBankId];
              if (!currentBank) {
                return {
                  isInMiddleOfGroup: false,
                  isGroupStart: true,
                  isGroupEnd: true,
                  groupVelocity: currentStep.velocity,
                  groupLength: 1
                };
              }
              
              // Get all steps for this note in the current bank, sorted by beat
              const noteSteps = currentBank.steps
                .filter(step => step.note === currentStep.note && step.enabled)
                .sort((a, b) => a.beat - b.beat);
              
              if (noteSteps.length === 0) {
                return {
                  isInMiddleOfGroup: false,
                  isGroupStart: true,
                  isGroupEnd: true,
                  groupVelocity: currentStep.velocity,
                  groupLength: 1
                };
              }
              
              // Find legato groups according to your rules
              const groups: Array<{
                startBeat: number;
                endBeat: number;
                velocity: number;
                steps: SequencerStep[];
              }> = [];
              
              let currentGroupSteps: SequencerStep[] = [];
              let groupStartVelocity = noteSteps[0]?.velocity || 1.0;
              
              for (let i = 0; i < noteSteps.length; i++) {
                const step = noteSteps[i];
                const prevStep = noteSteps[i - 1];
                const nextStep = noteSteps[i + 1];
                
                // Start a new group if:
                // 1. This is the first step
                // 2. There's a gap between this step and previous step
                // 3. Previous step had less than 100% gate (breaking the legato chain)
                const shouldStartNewGroup = 
                  i === 0 || 
                  !prevStep || 
                  step.beat !== prevStep.beat + 1 ||
                  prevStep.gate < 1.0;
                
                if (shouldStartNewGroup && currentGroupSteps.length > 0) {
                  // Finish the previous group
                  groups.push({
                    startBeat: currentGroupSteps[0].beat,
                    endBeat: currentGroupSteps[currentGroupSteps.length - 1].beat,
                    velocity: groupStartVelocity,
                    steps: [...currentGroupSteps]
                  });
                  currentGroupSteps = [];
                }
                
                if (shouldStartNewGroup) {
                  // Find the first 100% gate step in this potential group for velocity
                  groupStartVelocity = step.velocity;
                  for (let j = i; j < noteSteps.length; j++) {
                    const futureStep = noteSteps[j];
                    if (futureStep.beat !== step.beat + (j - i)) break; // No longer adjacent
                    if (futureStep.gate >= 1.0) {
                      groupStartVelocity = futureStep.velocity;
                      break;
                    }
                  }
                }
                
                currentGroupSteps.push(step);
                
                // End group if:
                // 1. This is the last step
                // 2. Next step has a gap
                // 3. This step has less than 100% gate and we're not continuing
                const shouldEndGroup = 
                  i === noteSteps.length - 1 ||
                  !nextStep ||
                  nextStep.beat !== step.beat + 1 ||
                  (step.gate < 1.0);
                
                if (shouldEndGroup && currentGroupSteps.length > 0) {
                  groups.push({
                    startBeat: currentGroupSteps[0].beat,
                    endBeat: currentGroupSteps[currentGroupSteps.length - 1].beat,
                    velocity: groupStartVelocity,
                    steps: [...currentGroupSteps]
                  });
                  currentGroupSteps = [];
                }
              }
              
              // Find which group contains the current step
              const matchingGroup = groups.find(group => 
                group.steps.some(step => step.beat === currentStep.beat)
              );
              
              if (!matchingGroup) {
                return {
                  isInMiddleOfGroup: false,
                  isGroupStart: true,
                  isGroupEnd: true,
                  groupVelocity: currentStep.velocity,
                  groupLength: 1
                };
              }
              
              const isGroupStart = matchingGroup.startBeat === currentStep.beat;
              const isGroupEnd = matchingGroup.endBeat === currentStep.beat;
              const isInMiddleOfGroup = !isGroupStart && matchingGroup.steps.length > 1;
              
              // Debug logging for legato logic
              console.log(`🎵 Legato analysis for ${currentStep.note} at beat ${currentStep.beat}:`, {
                isGroupStart,
                isGroupEnd,
                isInMiddleOfGroup,
                groupVelocity: matchingGroup.velocity,
                groupLength: matchingGroup.steps.length,
                groupBeats: `${matchingGroup.startBeat}-${matchingGroup.endBeat}`,
                groupSteps: matchingGroup.steps.map(s => `${s.beat}:${s.gate}`)
              });
              
              return {
                isInMiddleOfGroup,
                isGroupStart,
                isGroupEnd,
                groupVelocity: matchingGroup.velocity,
                groupLength: matchingGroup.steps.length
              };
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
          metronomeServiceRef.current = new MetronomeSocketService(socket);
        } else {
          console.warn("Metronome socket unavailable; skipping service initialization");
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

    // Capture debounced ref value for cleanup
    const debounced = debouncedServiceUpdate.current;
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
      // Cancel any pending debounced calls using captured ref
      debounced.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once

  // Listen to metronome updates - run after services are initialized
  useEffect(() => {
    if (!metronomeServiceRef.current || !sequencerServiceRef.current || !isInitialized) return;

    

    const cleanupMetronomeState = metronomeServiceRef.current.onMetronomeState(
      ({ bpm }) => {
        
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
          console.debug("Metronome tick", { timestamp, bpm });
        }
        setCurrentBPM(bpm);
        if (sequencerServiceRef.current) {
          sequencerServiceRef.current.syncWithMetronome(timestamp, bpm);
        }
      }
    );

    const cleanupMetronomeUpdated = metronomeServiceRef.current.onMetronomeUpdated(
      ({ bpm }) => {
        
        setCurrentBPM(bpm);
        if (sequencerServiceRef.current) {
          sequencerServiceRef.current.updateSettings(bpm, sequencerStoreRef.current.settings.speed, sequencerStoreRef.current.settings.length);
        }
      }
    );

    // Request current metronome state
    
    metronomeServiceRef.current.requestMetronomeState();

    return () => {
      
      cleanupMetronomeState();
      cleanupMetronomeTick();
      cleanupMetronomeUpdated();
    };
  }, [isInitialized]); // Run when services are initialized

  // Handle socket changes and create metronome service when available
  useEffect(() => {
    if (socket && !metronomeServiceRef.current) {
      
      metronomeServiceRef.current = new MetronomeSocketService(socket);
      
      // Set up metronome listeners immediately
      if (sequencerServiceRef.current && isInitialized) {
        

        // Request current metronome state
        
        metronomeServiceRef.current.requestMetronomeState();
      }
    }
  }, [socket, isInitialized]);

  // Update sequencer service when settings change
  useEffect(() => {
    const service = sequencerServiceRef.current;
    if (!service || !isInitialized) return;

    const { speed, length } = sequencerStoreRef.current.settings;
    service.updateSettings(currentBPM, speed, length);
    
  }, [currentBPM, isInitialized, sequencerStore.settings.speed, sequencerStore.settings.length]);

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

    // Stop all currently playing notes to prevent stuck notes
    const playingNotes = Array.from(currentlyPlayingNotesRef.current);
    if (playingNotes.length > 0) {
      
      onStopNotesRef.current(playingNotes);
      currentlyPlayingNotesRef.current.clear();
    }

    // Additional safety: Stop ALL possible notes to prevent phantom/stuck notes
    // This is a brute-force approach to ensure nothing gets stuck
    setTimeout(() => {
      const remainingNotes = Array.from(currentlyPlayingNotesRef.current);
      if (remainingNotes.length > 0) {
        console.warn(`🎵 Stop: emergency cleanup of ${remainingNotes.length} remaining notes:`, remainingNotes);
        onStopNotesRef.current(remainingNotes);
        currentlyPlayingNotesRef.current.clear();
      }
    }, 100); // Small delay to catch any notes that might have been triggered just before stop

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
      
      onStopNotesRef.current(playingNotes);
      currentlyPlayingNotesRef.current.clear();
    }

    // Additional safety: Multiple emergency stops to catch any missed notes
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const remainingNotes = Array.from(currentlyPlayingNotesRef.current);
        if (remainingNotes.length > 0) {
          console.warn(`🎵 Hard-stop: emergency cleanup ${i + 1}/3 of ${remainingNotes.length} remaining notes:`, remainingNotes);
          onStopNotesRef.current(remainingNotes);
          currentlyPlayingNotesRef.current.clear();
        }
      }, (i + 1) * 50); // 50ms, 100ms, 150ms intervals
    }

    hasStartedPlayingRef.current = false; // Reset for next playback
    sequencerStoreRef.current.hardStop();
    sequencerServiceRef.current.stopPlayback();
  }, []);

  // Legacy pause handler - now redirects to soft stop for backward compatibility
  const handlePause = useCallback(() => {
    
    handleSoftStop();
  }, [handleSoftStop]);

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
    isPaused: sequencerStore.softStopRequested, // isPaused now means "soft stop requested"
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