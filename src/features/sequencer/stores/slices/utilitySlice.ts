import type { StateCreator } from "zustand";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import type { SequencerStore } from "../../types/store";
import type { SequencerStep, BankName } from "../../types";

export interface UtilitySlice {
  getStepsForBeat: (bankId: string, beat: number) => SequencerStep[];
  getActiveStepsForBeat: (beat: number) => SequencerStep[];
  hasStepAtBeat: (bankId: string, beat: number, note: string) => boolean;
  getNextEnabledBank: () => string | null;
  getBeatStepsCount: (bankId: string, beat: number) => number;
  getTotalStepsCount: (bankId: string) => number;
}

export const createUtilitySlice: StateCreator<SequencerStore, [], [], UtilitySlice> = (_set, get) => ({
  getStepsForBeat: (bankId, beat) => {
    const bank = get().banks[bankId];
    return bank ? bank.steps.filter(step => step.beat === beat && step.enabled) : [];
  },

  getActiveStepsForBeat: (beat) => {
    const state = get();
    return state.getStepsForBeat(state.currentBank, beat);
  },

  hasStepAtBeat: (bankId, beat, note) => {
    const steps = get().getStepsForBeat(bankId, beat);
    return steps.some(step => step.note === note);
  },

  getNextEnabledBank: () => {
    const state = get();
    const bankNames = SEQUENCER_CONSTANTS.BANK_NAMES;

    // Get all enabled banks in order
    const enabledBanks = bankNames.filter(name => state.banks[name]?.enabled);

    if (enabledBanks.length === 0) {
      return null;
    }

    // Find current bank position in enabled banks list
    const currentIndex = enabledBanks.indexOf(state.currentBank as BankName);

    if (currentIndex === -1) {
      // Current bank is not enabled, return first enabled bank
      return enabledBanks[0];
    }

    // Get next enabled bank (cycle back to first if at end)
    const nextIndex = (currentIndex + 1) % enabledBanks.length;
    return enabledBanks[nextIndex];
  },

  getBeatStepsCount: (bankId, beat) => {
    return get().getStepsForBeat(bankId, beat).length;
  },

  getTotalStepsCount: (bankId) => {
    const bank = get().banks[bankId];
    return bank ? bank.steps.filter(step => step.enabled).length : 0;
  },
});
