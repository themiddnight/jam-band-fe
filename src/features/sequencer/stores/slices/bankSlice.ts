import type { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { SequencerStore } from "../../types/store";
import type { SequencerStep } from "../../types";
import { buildCategoryUpdate } from "../../utils/sequencerUtils";

export interface BankSlice {
  switchBank: (bankId: string) => void;
  toggleBankEnabled: (bankId: string) => void;
  duplicateBank: (fromBankId: string, toBankId: string) => void;
  copyBank: (bankId: string) => void;
  pasteBank: (bankId: string) => void;
  clearClipboard: () => void;
}

export const createBankSlice: StateCreator<SequencerStore, [], [], BankSlice> = (set, get) => ({
  switchBank: (bankId) => {
    set((state) => {
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        currentBank: bankId,
      });

      return {
        currentBank: bankId,
        categoryStates: nextCategoryStates,
      };
    });
  },

  toggleBankEnabled: (bankId) => {
    set((state) => {
      const bank = state.banks[bankId];
      if (!bank) return state;

      const updatedBank = { ...bank, enabled: !bank.enabled };
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

  duplicateBank: (fromBankId, toBankId) => {
    set((state) => {
      const fromBank = state.banks[fromBankId];
      const toBank = state.banks[toBankId];
      if (!fromBank || !toBank) return state;

      const duplicatedSteps = fromBank.steps.map(step => ({
        ...step,
        id: uuidv4(), // Generate new IDs
      }));

      const updatedBank = {
        ...toBank,
        steps: duplicatedSteps,
      };
      const updatedBanks = {
        ...state.banks,
        [toBankId]: updatedBank,
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

  copyBank: (bankId) => {
    const state = get();
    const bank = state.banks[bankId];
    if (!bank) return;

    const copiedBankData = {
      steps: bank.steps.map(step => ({
        ...step,
        id: uuidv4(), // Generate new IDs for the copied data
      })),
      timestamp: Date.now(),
    };

    set((currentState) => {
      const { nextCategoryStates } = buildCategoryUpdate(currentState, {
        clipboard: copiedBankData,
      });

      return {
        clipboard: copiedBankData,
        categoryStates: nextCategoryStates,
      };
    });
  },

  pasteBank: (bankId) => {
    const state = get();
    const bank = state.banks[bankId];
    if (!bank) return;

    if (!state.clipboard) {
      return;
    }

    // Check if clipboard is still valid (within 1 hour)
    const clipboardAge = Date.now() - state.clipboard.timestamp;
    if (clipboardAge > 60 * 60 * 1000) {
      set((currentState) => {
        const { nextCategoryStates } = buildCategoryUpdate(currentState, {
          clipboard: null,
        });

        return {
          clipboard: null,
          categoryStates: nextCategoryStates,
        };
      });
      return;
    }

    try {
      const copiedSteps = state.clipboard.steps.map((step: SequencerStep) => ({
        ...step,
        id: uuidv4(), // Generate new IDs for the pasted data
      }));

      set((currentState) => {
        const currentBank = currentState.banks[bankId];
        if (!currentBank) {
          return currentState;
        }

        const updatedBank = {
          ...currentBank,
          steps: copiedSteps,
        };

        const updatedBanks = {
          ...currentState.banks,
          [bankId]: updatedBank,
        };

        const { nextCategoryStates } = buildCategoryUpdate(currentState, {
          banks: updatedBanks,
        });

        return {
          banks: updatedBanks,
          categoryStates: nextCategoryStates,
        };
      });
    } catch (error) {
      console.error('🎵 Error pasting bank data:', error);
    }
  },

  clearClipboard: () => {
    set((state) => {
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        clipboard: null,
      });

      return {
        clipboard: null,
        categoryStates: nextCategoryStates,
      };
    });
  },
});
