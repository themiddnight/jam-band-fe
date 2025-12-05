import type { StateCreator } from "zustand";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import type { SequencerStore } from "../../types/store";
import type { SequencerSettings, BankMode, DisplayMode, EditMode, SequencerState } from "../../types";
import { shallowEqual, buildCategoryUpdate, ensureCategoryState, createInitialSequencerState } from "../../utils/sequencerUtils";

export interface SettingsSlice {
  updateSettings: (settings: Partial<SequencerSettings>) => void;
  setSpeed: (speed: number) => void;
  setLength: (length: number) => void;
  setBankMode: (mode: BankMode) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setEditMode: (mode: EditMode) => void;
  setSelectedBeat: (beat: number) => void;
  setWaitingForMetronome: (waiting: boolean) => void;
  setWaitingBankChange: (bankId: string | null) => void;
  setIsCollapsed: (isCollapsed: boolean) => void;
  reset: () => void;
  resetUI: () => void;
  setActiveCategory: (category: string) => void;
  toggleRecording: () => void;
  recordStep: (note: string, velocity?: number, gate?: number, isRealtime?: boolean) => void;
}

export const createSettingsSlice: StateCreator<SequencerStore, [], [], SettingsSlice> = (set, get) => ({
  updateSettings: (updates) => {
    set((state) => {
      const newSettings = { ...state.settings, ...updates };

      if (shallowEqual(state.settings, newSettings)) {
        return state;
      }

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        settings: newSettings,
      });

      return {
        settings: newSettings,
        categoryStates: nextCategoryStates,
      };
    });
  },

  setSpeed: (speed) => {
    set((state) => {
      const updatedSettings = { ...state.settings, speed };
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        settings: updatedSettings,
      });

      return {
        settings: updatedSettings,
        categoryStates: nextCategoryStates,
      };
    });
  },

  setLength: (length) => {
    const clampedLength = Math.max(SEQUENCER_CONSTANTS.MIN_BEATS, Math.min(SEQUENCER_CONSTANTS.MAX_BEATS, length));
    set((state) => {
      const updatedSettings = { ...state.settings, length: clampedLength };
      const updatedCurrentBeat = Math.min(state.currentBeat, clampedLength - 1);

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        settings: updatedSettings,
        currentBeat: updatedCurrentBeat,
      });

      return {
        settings: updatedSettings,
        currentBeat: updatedCurrentBeat,
        categoryStates: nextCategoryStates,
      };
    });
  },

  setBankMode: (bankMode) => {
    set((state) => {
      const updatedSettings = { ...state.settings, bankMode };
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        settings: updatedSettings,
      });

      return {
        settings: updatedSettings,
        categoryStates: nextCategoryStates,
      };
    });
  },

  setDisplayMode: (displayMode) => {
    set((state) => {
      const updatedSettings = { ...state.settings, displayMode };
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        settings: updatedSettings,
      });

      return {
        settings: updatedSettings,
        categoryStates: nextCategoryStates,
      };
    });
  },

  setEditMode: (editMode) => {
    set((state) => {
      const updatedSettings = { ...state.settings, editMode };
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        settings: updatedSettings,
      });

      return {
        settings: updatedSettings,
        categoryStates: nextCategoryStates,
      };
    });
  },

  setSelectedBeat: (beat) => {
    set((state) => {
      const maxBeat = state.settings.length - 1;
      const clampedBeat = Math.max(0, Math.min(maxBeat, beat));

      const { nextCategoryStates } = buildCategoryUpdate(state, {
        selectedBeat: clampedBeat,
      });

      return {
        selectedBeat: clampedBeat,
        categoryStates: nextCategoryStates,
      };
    });
  },

  setWaitingForMetronome: (waiting) => {
    set({ waitingForMetronome: waiting });
  },

  setWaitingBankChange: (bankId) => {
    set({ waitingBankChange: bankId });
  },

  setIsCollapsed: (isCollapsed) => set({ isCollapsed }),

  reset: () => {
    set(createInitialSequencerState());
  },

  resetUI: () => {
    set((state) => {
      const updatedSettings: SequencerSettings = {
        ...state.settings,
        editMode: "note" as EditMode,
      };
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        selectedBeat: 0,
        settings: updatedSettings,
      });

      return {
        selectedBeat: 0,
        settings: updatedSettings,
        categoryStates: nextCategoryStates,
      };
    });
  },


  setActiveCategory: (category) => {
    set((state) => {
      const { nextCategoryStates } = buildCategoryUpdate(state, {
        banks: state.banks,
        settings: state.settings,
        currentBank: state.currentBank,
        currentBeat: state.currentBeat,
        selectedBeat: state.selectedBeat,
        presets: state.presets,
        clipboard: state.clipboard,
      });

      const workingState: SequencerState = {
        ...state,
        categoryStates: nextCategoryStates,
      };

      const { categoryState, categoryStates } = ensureCategoryState(
        workingState,
        category
      );

      return {
        activeCategory: category,
        banks: categoryState.banks,
        settings: categoryState.settings,
        currentBank: categoryState.currentBank,
        currentBeat: categoryState.currentBeat,
        selectedBeat: categoryState.selectedBeat,
        presets: categoryState.presets,
        clipboard: categoryState.clipboard,
        isPlaying: false,
        isRecording: false,
        softStopRequested: false,
        waitingForMetronome: false,
        waitingBankChange: null,
        categoryStates,
      };
    });
  },

  toggleRecording: () => {
    set((state) => ({ isRecording: !state.isRecording }));
  },

  recordStep: (note, velocity, gate, isRealtime = false) => {
    const state = get();
    if (!state.isRecording) return;

    let finalGate: number;
    if (gate !== undefined) {
      finalGate = gate;
    } else if (isRealtime && state.isPlaying) {
      finalGate = 1.0;
    } else {
      finalGate = SEQUENCER_CONSTANTS.DEFAULT_GATE;
    }

    state.addStep(
      state.currentBank,
      state.currentBeat,
      note,
      velocity || SEQUENCER_CONSTANTS.DEFAULT_VELOCITY,
      finalGate
    );
  },
});
