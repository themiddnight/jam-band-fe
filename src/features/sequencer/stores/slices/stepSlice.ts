import type { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import type { SequencerStore } from "../../types/store";
import type { SequencerStep } from "../../types";
import { stepsEqual, buildCategoryUpdate, arraysShallowEqual } from "../../utils/sequencerUtils";

export interface StepSlice {
  addStep: (bankId: string, beat: number, note: string, velocity?: number, gate?: number) => void;
  removeStep: (bankId: string, stepId: string) => void;
  updateStep: (bankId: string, beat: number, note: string, updates: Partial<SequencerStep>) => void;
  toggleStep: (bankId: string, beat: number, note: string) => void;
  clearBeat: (bankId: string, beat: number) => void;
  clearBank: (bankId: string) => void;
  clearAllBanks: () => void;
}

export const createStepSlice: StateCreator<SequencerStore, [], [], StepSlice> = (set, get) => ({
  addStep: (bankId, beat, note, velocity = SEQUENCER_CONSTANTS.DEFAULT_VELOCITY, gate = SEQUENCER_CONSTANTS.DEFAULT_GATE) => {
    set((state) => {
      const bank = state.banks[bankId];
      if (!bank) return state;

      const existingStepIndex = bank.steps.findIndex(
        step => step.beat === beat && step.note === note
      );

      let newSteps: SequencerStep[];

      if (existingStepIndex >= 0) {
        // Update existing step - only if values actually changed
        const existingStep = bank.steps[existingStepIndex];
        if (existingStep.velocity === velocity &&
          existingStep.gate === gate &&
          existingStep.enabled === true) {
          // No change needed
          return state;
        }

        newSteps = [...bank.steps];
        newSteps[existingStepIndex] = {
          ...existingStep,
          velocity,
          gate,
          enabled: true,
        };
      } else {
        // Add new step
        const newStep: SequencerStep = {
          id: uuidv4(),
          beat,
          note,
          velocity,
          gate,
          enabled: true,
        };
        newSteps = [...bank.steps, newStep];
      }

      // Check if steps actually changed
      if (stepsEqual(bank.steps, newSteps)) {
        return state;
      }

      const updatedBank = { ...bank, steps: newSteps };
      const updatedBanks = {
        ...state.banks,
        [bankId]: updatedBank,
      };

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        banks: updatedBanks,
      });

      return {
        banks: updatedBanks,
        categoryStates: nextCategoryStates,
      };
    });
  },

  removeStep: (bankId, stepId) => {
    set((state) => {
      const bank = state.banks[bankId];
      if (!bank) return state;

      const updatedBank = {
        ...bank,
        steps: bank.steps.filter(step => step.id !== stepId),
      };
      const updatedBanks = {
        ...state.banks,
        [bankId]: updatedBank,
      };

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        banks: updatedBanks,
      });

      return {
        banks: updatedBanks,
        categoryStates: nextCategoryStates,
      };
    });
  },

  updateStep: (bankId, beat, note, updates) => {
    set((state) => {
      const bank = state.banks[bankId];
      if (!bank) return state;

      const stepIndex = bank.steps.findIndex(step => step.beat === beat && step.note === note);
      if (stepIndex === -1) return state;

      const updatedSteps = [...bank.steps];
      updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], ...updates };

      const updatedBank = { ...bank, steps: updatedSteps };
      const updatedBanks = {
        ...state.banks,
        [bankId]: updatedBank,
      };

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        banks: updatedBanks,
      });

      return {
        banks: updatedBanks,
        categoryStates: nextCategoryStates,
      };
    });
  },

  toggleStep: (bankId, beat, note) => {
    const state = get();
    const bank = state.banks[bankId];
    if (!bank) return;

    const existingStep = bank.steps.find(
      step => step.beat === beat && step.note === note
    );

    if (existingStep) {
      state.removeStep(bankId, existingStep.id);
    } else {
      state.addStep(bankId, beat, note);
    }
  },

  clearBeat: (bankId, beat) => {
    set((state) => {
      const bank = state.banks[bankId];
      if (!bank) return state;

      const newSteps = bank.steps.filter(step => step.beat !== beat);

      // Check if steps actually changed
      if (arraysShallowEqual(bank.steps, newSteps)) {
        return state;
      }

      const updatedBank = {
        ...bank,
        steps: newSteps,
      };
      const updatedBanks = {
        ...state.banks,
        [bankId]: updatedBank,
      };

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        banks: updatedBanks,
      });

      return {
        banks: updatedBanks,
        categoryStates: nextCategoryStates,
      };
    });
  },

  clearBank: (bankId) => {
    set((state) => {
      const bank = state.banks[bankId];
      if (!bank) return state;

      const updatedBank = { ...bank, steps: [] };
      const updatedBanks = {
        ...state.banks,
        [bankId]: updatedBank,
      };

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        banks: updatedBanks,
      });

      return {
        banks: updatedBanks,
        categoryStates: nextCategoryStates,
      };
    });
  },

  clearAllBanks: () => {
    set((state) => {
      const updatedBanks = { ...state.banks };
      Object.keys(updatedBanks).forEach(bankId => {
        updatedBanks[bankId] = { ...updatedBanks[bankId], steps: [] };
      });

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        banks: updatedBanks,
      });

      return {
        banks: updatedBanks,
        categoryStates: nextCategoryStates,
      };
    });
  },
});
