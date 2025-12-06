import { useCallback, useRef, useEffect } from "react";
import { useSequencerStore } from "../stores/sequencerStore";
import { SequencerService } from "../services/SequencerService";
import type { SequencerStep } from "../types";
import type { RefObject } from "react";
import { useEvent } from "@/shared/hooks/useEvent";

interface UseSequencerLogicProps {
  sequencerServiceRef: RefObject<SequencerService | null>;
  bankGenerationRef: RefObject<number>;
  currentBPMRef: RefObject<number>;
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
}

export const useSequencerLogic = ({
  sequencerServiceRef,
  bankGenerationRef,
  currentBPMRef,
  onPlayNotes,
  onStopNotes,
}: UseSequencerLogicProps) => {
  const sequencerStoreRef = useRef(useSequencerStore.getState());
  const onPlayNotesStable = useEvent(onPlayNotes);
  const onStopNotesStable = useEvent(onStopNotes);
  const currentlyPlayingNotesRef = useRef<Set<string>>(new Set());
  const hasStartedPlayingRef = useRef(false);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = useSequencerStore.subscribe((state) => {
      sequencerStoreRef.current = state;
    });
    return () => unsubscribe();
  }, []);

  // Cache for legato analysis to avoid re-calculating on every step
  const legatoCacheRef = useRef<{
    bankId: string | null;
    steps: SequencerStep[] | null;
    analysis: Map<string, Map<number, ReturnType<typeof findLegatoGroup>>>;
  }>({ bankId: null, steps: null, analysis: new Map() });

  // Helper function to find legato group information for a single step (used for types/fallback)
  const findLegatoGroup = useCallback((
    currentStep: SequencerStep | undefined,
    // Optional: provide pre-calculated analysis
    analysis?: Map<number, any>
  ) => {
    if (!currentStep) {
      return {
        isInMiddleOfGroup: false,
        isGroupStart: true,
        isGroupEnd: true,
        groupVelocity: 1.0,
        groupLength: 1,
      };
    }

    // If we have pre-calculated analysis, use it (O(1))
    if (analysis && analysis.has(currentStep.beat)) {
      return analysis.get(currentStep.beat)!;
    }

    // Fallback to safe default if not found or not provided
    return {
      isInMiddleOfGroup: false,
      isGroupStart: true,
      isGroupEnd: true,
      groupVelocity: currentStep.velocity,
      groupLength: 1,
    };
  }, []);

  // Optimized function to analyze entire bank and cache results
  const getLegatoAnalysis = useCallback((bankId: string, bank: any) => {
    if (
      legatoCacheRef.current.bankId === bankId &&
      legatoCacheRef.current.steps === bank.steps
    ) {
      return legatoCacheRef.current.analysis;
    }

    const analysis = new Map<string, Map<number, ReturnType<typeof findLegatoGroup>>>();
    const stepsByNote = new Map<string, SequencerStep[]>();

    // Group steps by note (O(N))
    bank.steps.forEach((step: SequencerStep) => {
      if (!step.enabled) return;
      if (!stepsByNote.has(step.note)) stepsByNote.set(step.note, []);
      stepsByNote.get(step.note)!.push(step);
    });

    // Process each note's steps
    stepsByNote.forEach((steps, note) => {
      steps.sort((a, b) => a.beat - b.beat);
      const noteAnalysis = new Map<number, ReturnType<typeof findLegatoGroup>>();

      let currentGroupSteps: SequencerStep[] = [];
      let groupStartVelocity = steps[0]?.velocity || 1.0;

      const groups: Array<{
        startBeat: number;
        endBeat: number;
        velocity: number;
        steps: SequencerStep[];
      }> = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const prevStep = steps[i - 1];
        const nextStep = steps[i + 1];

        const shouldStartNewGroup =
          i === 0 ||
          !prevStep ||
          step.beat !== prevStep.beat + 1 ||
          prevStep.gate < 0.99;

        if (shouldStartNewGroup && currentGroupSteps.length > 0) {
          groups.push({
            startBeat: currentGroupSteps[0].beat,
            endBeat: currentGroupSteps[currentGroupSteps.length - 1].beat,
            velocity: groupStartVelocity,
            steps: [...currentGroupSteps],
          });
          currentGroupSteps = [];
        }

        if (shouldStartNewGroup) {
          groupStartVelocity = step.velocity;
          for (let j = i; j < steps.length; j++) {
            const futureStep = steps[j];
            if (futureStep.beat !== step.beat + (j - i)) break;
            if (futureStep.gate >= 0.99) {
              groupStartVelocity = futureStep.velocity;
              break;
            }
          }
        }

        currentGroupSteps.push(step);

        const shouldEndGroup =
          i === steps.length - 1 ||
          !nextStep ||
          nextStep.beat !== step.beat + 1 ||
          step.gate < 0.99;

        if (shouldEndGroup && currentGroupSteps.length > 0) {
          groups.push({
            startBeat: currentGroupSteps[0].beat,
            endBeat: currentGroupSteps[currentGroupSteps.length - 1].beat,
            velocity: groupStartVelocity,
            steps: [...currentGroupSteps],
          });
          currentGroupSteps = [];
        }
      }

      groups.forEach((group) => {
        group.steps.forEach((step) => {
          const isGroupStart = group.startBeat === step.beat;
          const isGroupEnd = group.endBeat === step.beat;
          const isInMiddleOfGroup = !isGroupStart && group.steps.length > 1;

          noteAnalysis.set(step.beat, {
            isInMiddleOfGroup,
            isGroupStart,
            isGroupEnd,
            groupVelocity: group.velocity,
            groupLength: group.steps.length,
          });
        });
      });

      analysis.set(note, noteAnalysis);
    });

    legatoCacheRef.current = { bankId, steps: bank.steps, analysis };
    return analysis;
  }, []);

  const onBeatChange = useCallback(
    (beat: number) => {
      sequencerStoreRef.current.setCurrentBeat(beat);

      if (beat > 0) {
        hasStartedPlayingRef.current = true;
      }

      if (beat === 0 && hasStartedPlayingRef.current) {
        if (sequencerStoreRef.current.softStopRequested) {
          sequencerStoreRef.current.stop();
          if (sequencerServiceRef.current) {
            sequencerServiceRef.current.stopPlayback();
          }
          return;
        }

        // Handle queued bank changes
        if (sequencerStoreRef.current.waitingBankChange) {
          const waitingBank = sequencerStoreRef.current.waitingBankChange;

          const playingNotes = Array.from(currentlyPlayingNotesRef.current);
          if (playingNotes.length > 0) {
            onStopNotesStable(playingNotes);
            currentlyPlayingNotesRef.current.clear();
          }

          bankGenerationRef.current++;
          sequencerStoreRef.current.setWaitingBankChange(null);
          sequencerStoreRef.current.switchBank(waitingBank);

          const newBank = sequencerStoreRef.current.banks[waitingBank];
          if (newBank && sequencerServiceRef.current) {
            sequencerServiceRef.current.setSteps(newBank.steps);
          }
        }
        // Handle automatic continuous mode
        else if (sequencerStoreRef.current.settings.bankMode === "continuous") {
          const nextBank = sequencerStoreRef.current.getNextEnabledBank();
          if (nextBank && nextBank !== sequencerStoreRef.current.currentBank) {
            const playingNotes = Array.from(currentlyPlayingNotesRef.current);
            if (playingNotes.length > 0) {
              onStopNotesStable(playingNotes);
              currentlyPlayingNotesRef.current.clear();
            }

            bankGenerationRef.current++;
            sequencerStoreRef.current.switchBank(nextBank);

            const newBank = sequencerStoreRef.current.banks[nextBank];
            if (newBank && sequencerServiceRef.current) {
              sequencerServiceRef.current.setSteps(newBank.steps);
            }
          }
        }
      }
    },
    [bankGenerationRef, sequencerServiceRef, onStopNotesStable]
  );

  const onPlayStep = useCallback(
    (steps: SequencerStep[]) => {
      const currentBeat = sequencerStoreRef.current.currentBeat;
      const actualBeat = steps.length > 0 ? steps[0].beat : currentBeat;
      const isLastBeat =
        actualBeat === sequencerStoreRef.current.settings.length - 1;
      const isSoftStopRequested = sequencerStoreRef.current.softStopRequested;

      // Get optimized legato analysis
      const currentBankId = sequencerStoreRef.current.currentBank;
      const currentBank = sequencerStoreRef.current.banks[currentBankId];
      let bankAnalysis: Map<string, Map<number, ReturnType<typeof findLegatoGroup>>> | null = null;
      
      if (currentBank) {
        bankAnalysis = getLegatoAnalysis(currentBankId, currentBank);
      }

      const notesByBeat = new Map<
        number,
        Array<{
          note: string;
          velocity: number;
          gate: number;
          step: SequencerStep;
        }>
      >();

      steps.forEach((step) => {
        const beat = step.beat;
        if (!notesByBeat.has(beat)) {
          notesByBeat.set(beat, []);
        }
        notesByBeat.get(beat)!.push({
          note: step.note,
          velocity: step.velocity,
          gate: step.gate,
          step: step,
        });
      });

      notesByBeat.forEach((beatNotes) => {
        const uniqueNotes = new Map<string, (typeof beatNotes)[0]>();
        beatNotes.forEach((noteData) => {
          if (!uniqueNotes.has(noteData.note)) {
            uniqueNotes.set(noteData.note, noteData);
          }
        });

        const processedNotes = Array.from(uniqueNotes.values());
        const newNotes: string[] = [];
        const newNoteStopData: Array<{
          note: string;
          gate: number;
          velocity: number;
          isLegatoStart: boolean;
        }> = [];

        const legatoAnalysis = new Map<
          string,
          ReturnType<typeof findLegatoGroup>
        >();
        
        processedNotes.forEach((noteData) => {
          // Use cached analysis if available
          const noteAnalysis = bankAnalysis?.get(noteData.note);
          legatoAnalysis.set(
            noteData.note, 
            findLegatoGroup(noteData.step, noteAnalysis)
          );
        });


        processedNotes.forEach((noteData) => {
          const legatoGroup = legatoAnalysis.get(noteData.note)!;
          const isLegatoContinuation = legatoGroup.isInMiddleOfGroup;

          if (!isLegatoContinuation) {
            newNotes.push(noteData.note);
            newNoteStopData.push({
              note: noteData.note,
              gate: noteData.gate,
              velocity: legatoGroup.groupVelocity,
              isLegatoStart: legatoGroup.isGroupStart,
            });
          }
        });

        if (newNotes.length > 0) {
          const noteVelocities = newNoteStopData.map((nd) => nd.velocity);
          const avgVelocity =
            noteVelocities.reduce((sum, v) => sum + v, 0) /
            noteVelocities.length;

          onPlayNotesStable(newNotes, avgVelocity, true);
          newNotes.forEach((note) =>
            currentlyPlayingNotesRef.current.add(note)
          );
        }

        let maxGateTimeForSoftStop = 0;

        processedNotes.forEach((noteData) => {
          const legatoGroup = legatoAnalysis.get(noteData.note)!;
          const isFullGate = noteData.gate >= 0.99;
          const isNewNote = newNotes.includes(noteData.note);
          const isLegatoContinuation = !isNewNote;

          const shouldDoLegato =
            isFullGate && legatoGroup && !legatoGroup.isGroupEnd;
          const shouldStopNote = !shouldDoLegato;

          if (shouldStopNote) {
            const timing = SequencerService.calculateStepTiming(
              currentBPMRef.current,
              sequencerStoreRef.current.settings.speed
            );
            let gateTime = timing.stepInterval * noteData.gate * 1000;

            if (isLegatoContinuation && legatoGroup.isGroupEnd) {
              gateTime = timing.stepInterval * noteData.gate * 1000;
            }

            const minGateTime = 50;
            const maxGateTime = 60000;
            const safeGateTime = Math.max(
              minGateTime,
              Math.min(maxGateTime, gateTime)
            );

            if (isLastBeat && isSoftStopRequested) {
              maxGateTimeForSoftStop = Math.max(
                maxGateTimeForSoftStop,
                safeGateTime
              );
            }

            const triggerGeneration = bankGenerationRef.current;

            setTimeout(() => {
              if (bankGenerationRef.current !== triggerGeneration) return;

              onStopNotesStable([noteData.note]);
              currentlyPlayingNotesRef.current.delete(noteData.note);
            }, safeGateTime);

            const emergencyTimeout = safeGateTime + 500;
            setTimeout(() => {
              if (bankGenerationRef.current !== triggerGeneration) return;
              if (currentlyPlayingNotesRef.current.has(noteData.note)) {
                onStopNotesStable([noteData.note]);
                currentlyPlayingNotesRef.current.delete(noteData.note);
              }
            }, emergencyTimeout);
          }
        });

        if (isLastBeat && isSoftStopRequested) {
          const completionDelay = Math.max(maxGateTimeForSoftStop, 50) + 100;

          setTimeout(() => {
            const remainingNotes = Array.from(currentlyPlayingNotesRef.current);
            if (remainingNotes.length > 0) {
              onStopNotesStable(remainingNotes);
              currentlyPlayingNotesRef.current.clear();
            }

            sequencerStoreRef.current.stop();
            if (sequencerServiceRef.current) {
              sequencerServiceRef.current.stopPlayback();
            }
          }, completionDelay);
        }
      });
    },
    [
      bankGenerationRef,
      currentBPMRef,
      sequencerServiceRef,
      onPlayNotesStable,
      onStopNotesStable,
      findLegatoGroup,
      getLegatoAnalysis,
    ]
  );

  return {
    onBeatChange,
    onPlayStep,
    currentlyPlayingNotesRef,
    hasStartedPlayingRef,
  };
};
